const crypto = require("crypto");

const db = require("../db");
const logger = require("../logger");

const memStore = new Map();
const subscribers = new Map();

const uid = () => crypto.randomUUID();

const ensureSchema = async () => {
  if (db.isMemory()) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id           UUID PRIMARY KEY,
      user_id      INTEGER NOT NULL,
      type         VARCHAR(40) NOT NULL,
      severity     VARCHAR(20) NOT NULL DEFAULT 'info',
      title        VARCHAR(180) NOT NULL,
      message      TEXT,
      client_id    VARCHAR(64),
      amount       NUMERIC(14,2),
      read_at      TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      meta         JSONB
    );
    CREATE INDEX IF NOT EXISTS idx_notif_user_created
      ON notifications(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notif_user_unread
      ON notifications(user_id) WHERE read_at IS NULL;
  `);
};

ensureSchema().catch((e) =>
  logger.error("[notifications] schema init failed:", e.message)
);

const memListFor = (userId) =>
  Array.from(memStore.values())
    .filter((n) => n.user_id === userId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

const notify = (userId, event) => {
  const subs = subscribers.get(userId);
  if (!subs) return;
  for (const cb of subs) {
    try { cb(event); } catch (_) {}
  }
};

const store = {
  subscribe(userId, cb) {
    if (!subscribers.has(userId)) subscribers.set(userId, new Set());
    subscribers.get(userId).add(cb);
    return () => subscribers.get(userId)?.delete(cb);
  },

  async create({ userId, type, severity, title, message, clientId, amount, meta }) {
    const row = {
      id: uid(),
      user_id: userId,
      type,
      severity: severity || "info",
      title,
      message: message || null,
      client_id: clientId || null,
      amount: amount == null ? null : Number(amount),
      read_at: null,
      created_at: new Date().toISOString(),
      meta: meta || null,
    };

    if (db.isMemory()) {
      memStore.set(row.id, row);
    } else {
      await db.query(
        `INSERT INTO notifications
           (id,user_id,type,severity,title,message,client_id,amount,read_at,created_at,meta)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          row.id, row.user_id, row.type, row.severity, row.title,
          row.message, row.client_id, row.amount, row.read_at, row.created_at,
          row.meta ? JSON.stringify(row.meta) : null,
        ]
      );
    }
    notify(userId, { kind: "created", notification: row });
    return row;
  },

  async list(userId, { limit = 50, offset = 0, unreadOnly = false } = {}) {
    if (db.isMemory()) {
      let rows = memListFor(userId);
      if (unreadOnly) rows = rows.filter((r) => !r.read_at);
      return {
        data: rows.slice(offset, offset + limit),
        total: rows.length,
        unread: rows.filter((r) => !r.read_at).length,
      };
    }
    const where = unreadOnly
      ? "WHERE user_id = $1 AND read_at IS NULL"
      : "WHERE user_id = $1";
    const r = await db.query(
      `SELECT * FROM notifications ${where}
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    const c = await db.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE read_at IS NULL) AS unread
       FROM notifications WHERE user_id = $1`,
      [userId]
    );
    return {
      data: r.rows,
      total: Number(c.rows[0].total),
      unread: Number(c.rows[0].unread),
    };
  },

  async markRead(userId, id) {
    if (db.isMemory()) {
      const n = memStore.get(id);
      if (!n || n.user_id !== userId) return null;
      n.read_at = new Date().toISOString();
      notify(userId, { kind: "read", id });
      return n;
    }
    const r = await db.query(
      `UPDATE notifications SET read_at = NOW()
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId]
    );
    if (r.rows[0]) notify(userId, { kind: "read", id });
    return r.rows[0] || null;
  },

  async markAllRead(userId) {
    if (db.isMemory()) {
      let n = 0;
      for (const row of memListFor(userId)) {
        if (!row.read_at) { row.read_at = new Date().toISOString(); n++; }
      }
      notify(userId, { kind: "read_all" });
      return n;
    }
    const r = await db.query(
      `UPDATE notifications SET read_at = NOW()
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );
    notify(userId, { kind: "read_all" });
    return r.rowCount;
  },

  async remove(userId, id) {
    if (db.isMemory()) {
      const n = memStore.get(id);
      if (!n || n.user_id !== userId) return false;
      memStore.delete(id);
      notify(userId, { kind: "deleted", id });
      return true;
    }
    const r = await db.query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (r.rowCount) notify(userId, { kind: "deleted", id });
    return r.rowCount > 0;
  },

  async fanout(userIds, payload) {
    const created = [];
    for (const uid of userIds) {
      created.push(await store.create({ ...payload, userId: uid }));
    }
    return created;
  },
};

module.exports = store;
