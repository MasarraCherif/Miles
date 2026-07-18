const express = require("express");
const { body, param, validationResult } = require("express-validator");

const db = require("../db");
const { requireAuth, requireRole } = require("../auth/middleware");
const { hashPassword, validatePasswordPolicy } = require("../auth/hash");
const { logAuth } = require("../auth/audit");
const { sendMail } = require("../mail/service");

const router = express.Router();

const sanitize = (u) => ({
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

/* ---------------- LIST USERS ---------------- */
router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const users = await db.store.users.list();
    res.json({ data: users.map(sanitize) });
  } catch (e) {
    console.error("GET /api/users:", e);
    res.status(500).json({ message: e.message });
  }
});

/* ---------------- GET ONE ---------------- */
router.get(
  "/:id",
  requireAuth,
  requireRole("admin"),
  param("id").toInt().isInt(),
  async (req, res) => {
    if (!validate(req, res)) return;
    const u = await db.store.users.findById(req.params.id);
    if (!u) return res.status(404).json({ message: "Utilisateur introuvable" });
    res.json({ data: sanitize(u) });
  }
);

/* ---------------- CREATE ---------------- */
router.post(
  "/",
  requireAuth,
  requireRole("admin"),
  body("email").isEmail().normalizeEmail(),
  body("nom").isString().trim().isLength({ min: 1, max: 80 }),
  body("prenom").isString().trim().isLength({ min: 1, max: 80 }),
  body("mot_de_passe").isString(),
  body("role").optional().isIn(["admin", "manager", "agent", "viewer"]),
  async (req, res) => {
    if (!validate(req, res)) return;

    const { email, nom, prenom, mot_de_passe, role } = req.body;
    if (await db.store.users.findByEmail(email))
      return res.status(409).json({ message: "Email déjà utilisé" });

    const policy = validatePasswordPolicy(mot_de_passe);
    if (!policy.ok)
      return res.status(400).json({ message: "Mot de passe trop faible", errors: policy.errors });

    const password_hash = await hashPassword(mot_de_passe);
    const user = await db.store.users.create({
      email,
      nom,
      prenom,
      password_hash,
      role: role || "agent",
    });
    logAuth(req, "admin_user_created", { userId: user.id, by: req.user.id });

    try {
      await sendMail({
        to: user.email,
        subject: "Bienvenue sur MILES Smart Recovery",
        template: "welcome",
        lang: "fr",
        vars: { nom: user.prenom },
      });
    } catch (_) {}

    res.status(201).json({ data: sanitize(user) });
  }
);

/* ---------------- UPDATE ---------------- */
router.put(
  "/:id",
  requireAuth,
  requireRole("admin"),
  param("id").toInt().isInt(),
  body("email").optional().isEmail().normalizeEmail(),
  body("nom").optional().isString().isLength({ min: 1, max: 80 }),
  body("prenom").optional().isString().isLength({ min: 1, max: 80 }),
  body("role").optional().isIn(["admin", "manager", "agent", "viewer"]),
  body("statut").optional().isIn(["actif", "inactif", "suspendu"]),
  body("mot_de_passe").optional().isString(),
  async (req, res) => {
    if (!validate(req, res)) return;
    const id = req.params.id;
    const target = await db.store.users.findById(id);
    if (!target) return res.status(404).json({ message: "Utilisateur introuvable" });

    const patch = {};
    for (const k of ["email", "nom", "prenom", "role", "statut"]) {
      if (k in req.body) patch[k] = req.body[k];
    }
    if (req.body.mot_de_passe) {
      const policy = validatePasswordPolicy(req.body.mot_de_passe);
      if (!policy.ok)
        return res.status(400).json({ message: "Mot de passe trop faible", errors: policy.errors });
      patch.password_hash = await hashPassword(req.body.mot_de_passe);
    }

    const updated = await db.store.users.update(id, patch);
    logAuth(req, "admin_user_updated", { userId: id, by: req.user.id });
    res.json({ data: sanitize(updated) });
  }
);

/* ---------------- DELETE (soft) ---------------- */
router.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  param("id").toInt().isInt(),
  async (req, res) => {
    if (!validate(req, res)) return;
    const id = req.params.id;
    if (id === req.user.id)
      return res.status(400).json({ message: "Impossible de supprimer son propre compte" });

    const target = await db.store.users.findById(id);
    if (!target) return res.status(404).json({ message: "Utilisateur introuvable" });

    const updated = await db.store.users.update(id, { statut: "inactif" });
    logAuth(req, "admin_user_disabled", { userId: id, by: req.user.id });
    res.json({ data: sanitize(updated) });
  }
);

module.exports = router;
