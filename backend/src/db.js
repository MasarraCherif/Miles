const config = require("./config");
const memoryStore = require("./memoryStore");
const logger = require("./logger");

let mode = "memory";
let pgPool = null;

if (config.db.host) {
  try {
    const { Pool } = require("pg");
    pgPool = new Pool({
      host: config.db.host,
      port: config.db.port,
      database: config.db.name,
      user: config.db.user,
      password: config.db.password,
      ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
    });
    mode = "postgres";
    logger.info(`[db] PostgreSQL adapter active (${config.db.host}:${config.db.port})`);
  } catch (err) {
    logger.error("[db] Failed to init PostgreSQL — falling back to memory:", err.message);
    mode = "memory";
  }
} else {
  logger.warn("[db] DB_HOST not set — using IN-MEMORY mock store. Seeded admin: admin@miles.io / AdminMILES2026!");
}

const pgUsersStore = {
  findByEmail: async (email) => {
    const result = await pgPool.query(
      `SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email]
    );
    return result.rows[0] || null;
  },

  findById: async (id) => {
    const result = await pgPool.query(
      `SELECT * FROM users WHERE id = $1 LIMIT 1`,
      [id]
    );
    return result.rows[0] || null;
  },

  update: async (id, patch) => {
    const fields = Object.keys(patch);
    if (fields.length === 0) return await pgUsersStore.findById(id);

    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(", ");
    const values = fields.map((field) => patch[field]);

    const result = await pgPool.query(
      `UPDATE users SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, id]
    );

    return result.rows[0] || null;
  },

  create: async (data) => {
    const fields = Object.keys(data);
    const placeholders = fields.map((_, index) => `$${index + 1}`).join(", ");
    const columns = fields.join(", ");
    const values = fields.map((field) => data[field]);

    const result = await pgPool.query(
      `INSERT INTO users (${columns}) VALUES (${placeholders}) RETURNING *`,
      values
    );

    return result.rows[0];
  },

  list: async () => {
    const result = await pgPool.query(
      `SELECT id, nom, prenom, email, role, statut, mfa_email_enabled, mfa_totp_secret, date_creation FROM users ORDER BY id`
    );
    return result.rows;
  },
};

module.exports = {
  mode,
  pgPool,
  store: {
    ...memoryStore,
    users: mode === "postgres" ? pgUsersStore : memoryStore.users,
  },
  isMemory: () => mode === "memory",
  query: (...args) => {
    if (!pgPool) throw new Error("PostgreSQL not available — in-memory mode");
    return pgPool.query(...args);
  },
};
