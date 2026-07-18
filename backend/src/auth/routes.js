const crypto = require("crypto");
const express = require("express");
const { body, validationResult } = require("express-validator");

const config = require("../config");
const db = require("../db");
const { hashPassword, verifyPassword, validatePasswordPolicy } = require("./hash");
const {
  issueAccessToken,
  issueRefreshToken,
  verifyRefresh,
  setRefreshCookie,
  clearRefreshCookie,
} = require("./tokens");
const mfa = require("./mfa");
const { logAuth } = require("./audit");
const { requireAuth, requireRole } = require("./middleware");
const { loginLimiter } = require("../security/rateLimit");
const { sendMail } = require("../mail/service");

const router = express.Router();

const sanitizeUser = (u) => ({
  id: u.id,
  nom: u.nom,
  prenom: u.prenom,
  email: u.email,
  role: u.role,
  statut: u.statut,
  mfa_email_enabled: !!u.mfa_email_enabled,
  mfa_totp_enabled: !!u.mfa_totp_secret,
  date_creation: u.date_creation,
});

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ message: "Données invalides", errors: errors.array() });
    return false;
  }
  return true;
};

const isLocked = (user) => user.locked_until && new Date(user.locked_until) > new Date();

/* ---------------- LOGIN ---------------- */
router.post(
  "/login",
  loginLimiter,
  body("email").isEmail().normalizeEmail(),
  body("mot_de_passe").isString().isLength({ min: 1, max: 200 }),
  async (req, res) => {
    if (!validate(req, res)) return;

    const { email, mot_de_passe } = req.body;
    const user = await db.store.users.findByEmail(email);


    if (!user) {
      logAuth(req, "login_failed_no_user", { email });
      await new Promise((r) => setTimeout(r, 250));
      return res.status(401).json({ message: "Identifiants invalides" });
    }

    if (isLocked(user)) {
      logAuth(req, "login_locked", { userId: user.id });
      return res.status(423).json({
        message: "Compte temporairement verrouillé. Réessayez plus tard.",
      });
    }

    if (user.statut !== "actif") {
      logAuth(req, "login_inactive", { userId: user.id });
      return res.status(403).json({ message: "Compte inactif" });
    }

    const ok = await verifyPassword(mot_de_passe, user.password_hash);
    if (!ok) {
      const failed = (user.failed_attempts || 0) + 1;
      const patch = { failed_attempts: failed };
      if (failed >= config.auth.loginMaxAttempts) {
        patch.locked_until = new Date(Date.now() + config.auth.lockoutMs).toISOString();
        patch.failed_attempts = 0;
      }
      db.store.users.update(user.id, patch);
      logAuth(req, "login_failed_password", { userId: user.id, failed });
      return res.status(401).json({ message: "Identifiants invalides" });
    }

    db.store.users.update(user.id, { failed_attempts: 0, locked_until: null });

    const methods = mfa.availableMethods(user);
    if (methods.length > 0) {
      const preferred = methods.includes("totp") ? "totp" : "email";
      const { challengeId } = await mfa.newChallenge(user, preferred);
      logAuth(req, "login_mfa_challenge", { userId: user.id, type: preferred });
      return res.json({
        mfaRequired: true,
        challengeId,
        availableMethods: methods,
        activeMethod: preferred,
      });
    }

    const access = issueAccessToken(user);
    const { token: refresh } = issueRefreshToken(user);
    setRefreshCookie(res, refresh);
    logAuth(req, "login_success", { userId: user.id });
    res.json({ accessToken: access, user: sanitizeUser(user) });
  }
);

/* ---------------- MFA verify ---------------- */
router.post(
  "/mfa/verify",
  loginLimiter,
  body("challengeId").isString().notEmpty(),
  body("type").isIn(["email", "totp"]),
  body("code").isString().isLength({ min: 4, max: 10 }),
  async (req, res) => {
    if (!validate(req, res)) return;

    const { challengeId, type, code } = req.body;
    const ch = db.store.mfaChallenges.get(challengeId);
    if (!ch) return res.status(400).json({ message: "Challenge invalide" });

    const user = await db.store.users.findById(ch.userId);

    if (!user) return res.status(400).json({ message: "Utilisateur introuvable" });

    const result = await mfa.verifyChallenge(challengeId, type, code, user);
    if (!result.ok) {
      logAuth(req, "mfa_failed", { userId: user.id, reason: result.reason });
      return res.status(401).json({ message: "Code invalide ou expiré" });
    }

    const access = issueAccessToken(user);
    const { token: refresh } = issueRefreshToken(user);
    setRefreshCookie(res, refresh);
    logAuth(req, "login_success_mfa", { userId: user.id, type });
    res.json({ accessToken: access, user: sanitizeUser(user) });
  }
);

/* ---------------- MFA resend (email only) ---------------- */
router.post(
  "/mfa/resend",
  loginLimiter,
  body("challengeId").isString().notEmpty(),
  async (req, res) => {
    if (!validate(req, res)) return;
    const ch = db.store.mfaChallenges.get(req.body.challengeId);
    if (!ch) return res.status(400).json({ message: "Challenge invalide" });
    const user = await db.store.users.findById(ch.userId);

    if (!user) return res.status(400).json({ message: "Utilisateur introuvable" });

    const { challengeId } = await mfa.newChallenge(user, "email");
    res.json({ challengeId, message: "Nouveau code envoyé" });
  }
);

/* ---------------- TOTP enrollment (authenticated) ---------------- */
router.post("/mfa/totp/setup", requireAuth, async (req, res) => {
 const user = await db.store.users.findById(req.user.id);

  const setup = await mfa.enrollTotp(user);
  db.store.users.update(user.id, { mfa_totp_pending_secret: setup.secret });
  res.json({ otpauthUrl: setup.otpauthUrl, qrDataUrl: setup.qrDataUrl });
});

router.post(
  "/mfa/totp/confirm",
  requireAuth,
  body("code").isString().isLength({ min: 6, max: 8 }),
  async (req, res) => {
    if (!validate(req, res)) return;
    const user = await db.store.users.findById(req.user.id);

    const secret = user.mfa_totp_pending_secret;
    if (!secret) return res.status(400).json({ message: "Aucune configuration TOTP en cours" });
    if (!mfa.verifyTotpEnrollment(secret, req.body.code))
      return res.status(401).json({ message: "Code invalide" });

    db.store.users.update(user.id, {
      mfa_totp_secret: secret,
      mfa_totp_pending_secret: null,
    });
    logAuth(req, "mfa_totp_enrolled", { userId: user.id });
    res.json({ message: "TOTP activé" });
  }
);

router.post("/mfa/totp/disable", requireAuth, async (req, res) => {
  db.store.users.update(req.user.id, { mfa_totp_secret: null });
  logAuth(req, "mfa_totp_disabled", { userId: req.user.id });
  res.json({ message: "TOTP désactivé" });
});

router.post(
  "/mfa/email/toggle",
  requireAuth,
  body("enabled").isBoolean(),
  async (req, res) => {
    if (!validate(req, res)) return;
    db.store.users.update(req.user.id, { mfa_email_enabled: !!req.body.enabled });
    logAuth(req, "mfa_email_toggled", { userId: req.user.id, enabled: req.body.enabled });
    res.json({ message: "Préférence MFA email mise à jour" });
  }
);

/* ---------------- Refresh ---------------- */
router.post("/refresh", async (req, res) => {
  const cookieToken = req.signedCookies[config.cookies.refreshName];
  if (!cookieToken) return res.status(401).json({ message: "Refresh token manquant" });

  let payload;
  try { payload = verifyRefresh(cookieToken); }
  catch { return res.status(401).json({ message: "Refresh token invalide" }); }

  const stored = db.store.refreshTokens.get(payload.jti);
  if (!stored || stored.revoked || stored.expiresAt < Date.now())
    return res.status(401).json({ message: "Refresh token révoqué" });

  const user = await db.store.users.findById(payload.sub);

  if (!user || user.statut !== "actif")
    return res.status(401).json({ message: "Utilisateur invalide" });

  db.store.refreshTokens.revoke(payload.jti);
  const access = issueAccessToken(user);
  const { token: refresh } = issueRefreshToken(user);
  setRefreshCookie(res, refresh);
  res.json({ accessToken: access });
});

/* ---------------- Logout ---------------- */
router.post("/logout", async (req, res) => {
  const cookieToken = req.signedCookies[config.cookies.refreshName];
  if (cookieToken) {
    try {
      const payload = verifyRefresh(cookieToken);
      db.store.refreshTokens.revoke(payload.jti);
    } catch {}
  }
  clearRefreshCookie(res);
  res.json({ message: "Déconnecté" });
});

/* ---------------- Me ---------------- */
router.get("/me", requireAuth, async (req, res) => {

  const user = await db.store.users.findById(req.user.id);

  if (!user) return res.status(404).json({ message: "Introuvable" });
  res.json({ user: sanitizeUser(user) });
});

/* ---------------- Register (admin-only) ---------------- */
router.post(
  "/register",
  requireAuth,
  requireRole("admin"),
  body("email").isEmail().normalizeEmail(),
  body("nom").isString().trim().isLength({ min: 1, max: 80 }),
  body("prenom").isString().trim().isLength({ min: 1, max: 80 }),
  body("mot_de_passe").isString(),
  async (req, res) => {
    if (!validate(req, res)) return;
    const { email, nom, prenom, mot_de_passe } = req.body;

    if (await db.store.users.findByEmail(email))

      return res.status(409).json({ message: "Email déjà utilisé" });

    const policy = validatePasswordPolicy(mot_de_passe);
    if (!policy.ok)
      return res.status(400).json({ message: "Mot de passe trop faible", errors: policy.errors });

    const password_hash = await hashPassword(mot_de_passe);
    const user = await db.store.users.create({

      email, nom, prenom, password_hash, role: "admin",
    });
    logAuth(req, "user_registered", { userId: user.id, by: req.user.id });

    await sendMail({
      to: user.email,
      subject: "Bienvenue sur MILES Smart Recovery",
      template: "welcome",
      lang: "fr",
      vars: { nom: user.prenom },
    });

    res.status(201).json({ user: sanitizeUser(user) });
  }
);

/* ---------------- Forgot / Reset password ---------------- */
router.post(
  "/forgot-password",
  body("email").isEmail().normalizeEmail(),
  async (req, res) => {
    if (!validate(req, res)) return;
    const user = db.store.users.findByEmail(req.body.email);
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      db.store.passwordResetTokens.save(token, {
        userId: user.id,
        expiresAt: Date.now() + 30 * 60 * 1000,
      });
      await sendMail({
        to: user.email,
        subject: "Réinitialisation de votre mot de passe",
        template: "password_reset",
        lang: "fr",
        vars: {
          nom: user.prenom || user.nom || "",
          resetUrl: `${config.frontendOrigin}/reset-password?token=${token}`,
          validityMinutes: 30,
        },
      });
      logAuth(req, "password_reset_requested", { userId: user.id });
    }
    res.json({ message: "Si un compte existe, un email a été envoyé." });
  }
);

router.post(
  "/reset-password",
  body("token").isString().isLength({ min: 32 }),
  body("mot_de_passe").isString(),
  async (req, res) => {
    if (!validate(req, res)) return;
    const data = db.store.passwordResetTokens.get(req.body.token);
    if (!data || data.expiresAt < Date.now()) {
      if (data) db.store.passwordResetTokens.delete(req.body.token);
      return res.status(400).json({ message: "Lien invalide ou expiré" });
    }
    const policy = validatePasswordPolicy(req.body.mot_de_passe);
    if (!policy.ok)
      return res.status(400).json({ message: "Mot de passe trop faible", errors: policy.errors });

    const password_hash = await hashPassword(req.body.mot_de_passe);
    db.store.users.update(data.userId, { password_hash });
    db.store.users.findById(data.userId) &&
      db.store.refreshTokens.revokeAllForUser(data.userId);
    db.store.passwordResetTokens.delete(req.body.token);
    logAuth(req, "password_reset_done", { userId: data.userId });
    res.json({ message: "Mot de passe mis à jour" });
  }
);

module.exports = router;
