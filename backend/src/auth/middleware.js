const { verifyAccess } = require("./tokens");
const db = require("../db");

const requireAuth = async (req, res, next) => {
  const header = req.get("authorization") || "";
  const m = header.match(/^Bearer\s+(.+)$/i);

  if (!m) {
    return res.status(401).json({ message: "Token manquant" });
  }

  try {
    const payload = verifyAccess(m[1]);
    const user = await db.store.users.findById(payload.sub);

    if (!user) {
      return res.status(401).json({ message: "Utilisateur introuvable" });
    }

    if (user.statut !== "actif") {
      return res.status(403).json({ message: "Compte inactif" });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      statut: user.statut,
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: "Token invalide ou expiré" });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Non authentifié" });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  next();
};

module.exports = { requireAuth, requireRole };
