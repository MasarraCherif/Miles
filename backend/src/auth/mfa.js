const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const config = require("../config");
const db = require("../db");
const { sendMail } = require("../mail/service");

const generateEmailCode = () =>
  String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

const newChallenge = async (user, type) => {
  const challengeId = crypto.randomUUID();
  let codeHash = null;
  let code = null;

  if (type === "email") {
    code = generateEmailCode();
    codeHash = await bcrypt.hash(code, 10);
    await sendMail({
      to: user.email,
      subject: "Code de vérification MILES",
      template: "mfa_code",
      lang: "fr",
      vars: {
        nom: user.prenom || user.nom || "",
        code,
        validityMinutes: Math.round(config.auth.mfa.emailCodeTtlMs / 60000),
      },
    });
  }

  db.store.mfaChallenges.save(challengeId, {
    userId: user.id,
    type,
    codeHash,
    expiresAt: Date.now() + config.auth.mfa.challengeTtlMs,
  });

  return { challengeId };
};

const availableMethods = (user) => {
  const methods = [];
  if (user.mfa_email_enabled) methods.push("email");
  if (user.mfa_totp_secret) methods.push("totp");
  return methods;
};

const verifyChallenge = async (challengeId, type, code, user) => {
  const ch = db.store.mfaChallenges.get(challengeId);
  if (!ch) return { ok: false, reason: "challenge_invalid" };
  if (ch.userId !== user.id) return { ok: false, reason: "challenge_mismatch" };
  if (Date.now() > ch.expiresAt) {
    db.store.mfaChallenges.delete(challengeId);
    return { ok: false, reason: "challenge_expired" };
  }

  if (type === "email") {
    if (ch.type !== "email") return { ok: false, reason: "type_mismatch" };
    const ok = await bcrypt.compare(String(code || ""), ch.codeHash || "");
    if (!ok) return { ok: false, reason: "code_invalid" };
    db.store.mfaChallenges.delete(challengeId);
    return { ok: true };
  }

  if (type === "totp") {
    if (!user.mfa_totp_secret) return { ok: false, reason: "totp_not_enrolled" };
    const ok = speakeasy.totp.verify({
      secret: user.mfa_totp_secret,
      encoding: "base32",
      token: String(code || "").replace(/\s+/g, ""),
      window: 1,
    });
    if (!ok) return { ok: false, reason: "code_invalid" };
    db.store.mfaChallenges.delete(challengeId);
    return { ok: true };
  }

  return { ok: false, reason: "type_unknown" };
};

const enrollTotp = async (user) => {
  const secret = speakeasy.generateSecret({
    name: `${config.auth.mfa.issuer} (${user.email})`,
    issuer: config.auth.mfa.issuer,
    length: 20,
  });
  const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);
  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url,
    qrDataUrl,
  };
};

const verifyTotpEnrollment = (secret, token) =>
  speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: String(token || "").replace(/\s+/g, ""),
    window: 1,
  });

module.exports = {
  newChallenge,
  verifyChallenge,
  availableMethods,
  enrollTotp,
  verifyTotpEnrollment,
};
