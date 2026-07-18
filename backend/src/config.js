require("dotenv").config();
const crypto = require("crypto");

const isProd = process.env.NODE_ENV === "production";

const requireEnv = (name) => {
  const v = process.env[name];
  if (!v) {
    if (isProd) throw new Error(`${name} is required in production`);
    const fallback = crypto.randomBytes(48).toString("hex");
    console.warn(
      `[config] ${name} missing — using ephemeral random value (DEV ONLY).`
    );
    return fallback;
  }
  return v;
};

const config = {
  env: process.env.NODE_ENV || "development",
  isProd,
  port: parseInt(process.env.PORT || "5000", 10),

  // Frontend origin for CORS
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",

  // DB — if DB_HOST not set, the adapter falls back to in-memory mock
  db: {
    host: process.env.DB_HOST || null,
    port: parseInt(process.env.DB_PORT || "5432", 10),
    name: process.env.DB_NAME || null,
    user: process.env.DB_USER || null,
    password: process.env.DB_PASSWORD || null,
    // Managed Postgres (Supabase, RDS, etc.) requires TLS. Defaults to on
    // for any non-local host; set DB_SSL=false to force it off.
    ssl: process.env.DB_SSL
      ? process.env.DB_SSL === "true"
      : !["localhost", "127.0.0.1"].includes(process.env.DB_HOST || "localhost"),
  },

  // JWT secrets — must be set in prod, randomized in dev
  jwt: {
    accessSecret: requireEnv("JWT_ACCESS_SECRET"),
    refreshSecret: requireEnv("JWT_REFRESH_SECRET"),
    accessTtl: process.env.JWT_ACCESS_TTL || "15m",
    refreshTtl: process.env.JWT_REFRESH_TTL || "7d",
    issuer: "miles-smart-recovery",
  },

  // Cookies (refresh token)
  cookies: {
    refreshName: "miles_rt",
    secret: requireEnv("COOKIE_SECRET"),
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
  },

  // Auth policy
  auth: {
    bcryptRounds: 12,
    pwMinLength: 12,
    loginMaxAttempts: 5,
    loginWindowMs: 15 * 60 * 1000,
    lockoutMs: 15 * 60 * 1000,
    mfa: {
      issuer: "MILES Smart Recovery",
      emailCodeTtlMs: 5 * 60 * 1000,
      challengeTtlMs: 10 * 60 * 1000,
    },
  },

  // SMTP — if not set, mail service runs in mock-outbox mode
  smtp: {
    host: process.env.SMTP_HOST || null,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || null,
    password: process.env.SMTP_PASSWORD || null,
    from: process.env.SMTP_FROM || "MILES Recovery <no-reply@miles.io>",
  },
};

module.exports = config;
