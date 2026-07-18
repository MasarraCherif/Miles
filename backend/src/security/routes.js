const express = require("express");
const config = require("../config");
const db = require("../db");
const { requireAuth, requireRole } = require("../auth/middleware");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    ok: true,
    env: config.env,
    db: { mode: db.mode, reachable: !db.isMemory() ? "depends" : "memory-mock" },
    smtp: { mode: config.smtp.host ? "live" : "mock-outbox" },
    security: {
      helmet: true,
      rateLimit: true,
      corsOrigin: config.frontendOrigin,
      cookies: { sameSite: config.cookies.sameSite, secure: config.cookies.secure },
      originGuard: true,
    },
    auth: {
      jwt: { accessTtl: config.jwt.accessTtl, refreshTtl: config.jwt.refreshTtl },
      mfa: { totp: true, email: true },
      passwordPolicy: { minLength: config.auth.pwMinLength, complexity: true },
      lockout: {
        maxAttempts: config.auth.loginMaxAttempts,
        lockoutMs: config.auth.lockoutMs,
      },
    },
    timestamp: new Date().toISOString(),
  });
});

router.get("/audit", requireAuth, requireRole("admin"), (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || "100", 10), 500);
  res.json({ entries: db.store.audit.list(limit) });
});

module.exports = router;
