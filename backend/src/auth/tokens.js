const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const config = require("../config");
const db = require("../db");

const issueAccessToken = (user) =>
  jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    config.jwt.accessSecret,
    {
      expiresIn: config.jwt.accessTtl,
      issuer: config.jwt.issuer,
      jwtid: crypto.randomUUID(),
    }
  );

const issueRefreshToken = (user) => {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { sub: user.id, type: "refresh" },
    config.jwt.refreshSecret,
    {
      expiresIn: config.jwt.refreshTtl,
      issuer: config.jwt.issuer,
      jwtid: jti,
    }
  );
  db.store.refreshTokens.save(jti, {
    userId: user.id,
    expiresAt: Date.now() + parseTtlMs(config.jwt.refreshTtl),
    revoked: false,
  });
  return { token, jti };
};

const verifyAccess = (token) =>
  jwt.verify(token, config.jwt.accessSecret, { issuer: config.jwt.issuer });

const verifyRefresh = (token) =>
  jwt.verify(token, config.jwt.refreshSecret, { issuer: config.jwt.issuer });

const parseTtlMs = (s) => {
  const m = String(s).match(/^(\d+)([smhd])$/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return { s: 1e3, m: 60e3, h: 3600e3, d: 86400e3 }[m[2]] * n;
};

const setRefreshCookie = (res, token) => {
  res.cookie(config.cookies.refreshName, token, {
    httpOnly: true,
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite,
    path: "/api/auth",
    maxAge: parseTtlMs(config.jwt.refreshTtl),
    signed: true,
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie(config.cookies.refreshName, { path: "/api/auth" });
};

module.exports = {
  issueAccessToken,
  issueRefreshToken,
  verifyAccess,
  verifyRefresh,
  setRefreshCookie,
  clearRefreshCookie,
};
