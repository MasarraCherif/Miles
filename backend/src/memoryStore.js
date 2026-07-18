const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const uuid = () => crypto.randomUUID();

const seededAdminHash = bcrypt.hashSync("AdminMILES2026!", 12);

const users = [
  {
    id: 1,
    nom: "Admin",
    prenom: "MILES",
    email: "admin@miles.io",
    password_hash: seededAdminHash,
    role: "admin",
    statut: "actif",
    mfa_email_enabled: true,
    mfa_totp_secret: null,
    failed_attempts: 0,
    locked_until: null,
    date_creation: new Date().toISOString(),
  },
];

const clients = [
  { id: 101, nom_client: "Atlas Trading SARL",      email: "contact@atlas-trading.tn",   situation: "CRITIQUE", montant_du: 18450, langue: "fr" },
  { id: 102, nom_client: "Boutique Lumière",        email: "hello@boutique-lumiere.com", situation: "ÉLEVÉ",    montant_du: 3210,  langue: "fr" },
  { id: 103, nom_client: "Mehdi Khelifi",           email: "mehdi.khelifi@example.com",  situation: "PAYÉ",     montant_du: 0,     langue: "fr" },
  { id: 104, nom_client: "Café du Coin",            email: "manager@cafeducoin.fr",      situation: "ÉLEVÉ",    montant_du: 5420,  langue: "fr" },
  { id: 105, nom_client: "Imen Ben Salah",          email: "imen.bensalah@example.com",  situation: "MOYEN",    montant_du: 1675,  langue: "fr" },
  { id: 106, nom_client: "Société Nour Industries", email: "billing@nour-industries.tn", situation: "CRITIQUE", montant_du: 22100, langue: "fr" },
  { id: 107, nom_client: "Yassine Trabelsi",        email: "y.trabelsi@example.com",     situation: "PAYÉ",     montant_du: 0,     langue: "fr" },
  { id: 108, nom_client: "Pharmacie Centrale",      email: "contact@pharma-centrale.tn", situation: "MOYEN",    montant_du: 4890,  langue: "fr" },
];

const auditLog = [];
const refreshTokens = new Map();   // jti -> { userId, expiresAt, revoked }
const mfaChallenges = new Map();   // challengeId -> { userId, type, codeHash, expiresAt }
const passwordResetTokens = new Map(); // token -> { userId, expiresAt }

const memoryStore = {
  users: {
    findByEmail: (email) =>
      users.find((u) => u.email.toLowerCase() === String(email).toLowerCase()),
    findById: (id) => users.find((u) => u.id === Number(id)),
    update: (id, patch) => {
      const u = users.find((x) => x.id === Number(id));
      if (!u) return null;
      Object.assign(u, patch);
      return u;
    },
    create: (data) => {
      const id = users.length ? Math.max(...users.map((u) => u.id)) + 1 : 1;
      const user = {
        id,
        statut: "actif",
        role: "admin",
        mfa_email_enabled: false,
        mfa_totp_secret: null,
        failed_attempts: 0,
        locked_until: null,
        date_creation: new Date().toISOString(),
        ...data,
      };
      users.push(user);
      return user;
    },
    list: () => users.map(({ password_hash, mfa_totp_secret, ...u }) => u),
  },

  clients: {
    list: ({ situation } = {}) =>
      situation ? clients.filter((c) => c.situation === situation) : clients.slice(),
    findById: (id) => clients.find((c) => c.id === Number(id)),
  },

  audit: {
    add: (entry) => {
      auditLog.push({ ...entry, ts: new Date().toISOString(), id: uuid() });
      if (auditLog.length > 1000) auditLog.shift();
    },
    list: (limit = 100) => auditLog.slice(-limit).reverse(),
  },

  refreshTokens: {
    save: (jti, payload) => refreshTokens.set(jti, payload),
    get: (jti) => refreshTokens.get(jti),
    revoke: (jti) => {
      const t = refreshTokens.get(jti);
      if (t) t.revoked = true;
    },
    revokeAllForUser: (userId) => {
      for (const [jti, t] of refreshTokens) {
        if (t.userId === userId) t.revoked = true;
      }
    },
  },

  mfaChallenges: {
    save: (id, data) => mfaChallenges.set(id, data),
    get: (id) => mfaChallenges.get(id),
    delete: (id) => mfaChallenges.delete(id),
  },

  passwordResetTokens: {
    save: (token, data) => passwordResetTokens.set(token, data),
    get: (token) => passwordResetTokens.get(token),
    delete: (token) => passwordResetTokens.delete(token),
  },
};

module.exports = memoryStore;
