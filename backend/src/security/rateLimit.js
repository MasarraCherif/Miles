const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");
const config = require("../config");

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Trop de requêtes. Réessayez plus tard." },
});

const loginLimiter = rateLimit({
  windowMs: config.auth.loginWindowMs,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Trop de tentatives. Réessayez plus tard." },
  keyGenerator: (req, res) =>
    `${ipKeyGenerator(req, res)}:${(req.body && req.body.email) || ""}`,
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Trop d'appels IA. Réessayez dans une minute." },
});

module.exports = { globalLimiter, loginLimiter, aiLimiter };
