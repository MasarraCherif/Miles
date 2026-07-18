const helmet = require("helmet");
const cors = require("cors");
const config = require("../config");

const helmetMw = helmet({
  contentSecurityPolicy: false,   // SPA serves its own CSP via meta in prod
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: config.isProd ? undefined : false,
});

const corsMw = cors({
  origin: config.frontendOrigin,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

// Lightweight CSRF defense for state-changing requests:
// Verify the Origin / Referer matches the configured frontend origin.
// Combined with SameSite=Strict cookie, this is solid against CSRF.
const originGuard = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin") || req.get("referer") || "";
  if (!origin) return next();
  if (origin.startsWith(config.frontendOrigin)) return next();
  return res.status(403).json({ message: "Origine non autorisée" });
};

module.exports = { helmetMw, corsMw, originGuard };
