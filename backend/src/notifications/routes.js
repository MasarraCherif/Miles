const express = require("express");
const { body, param, query, validationResult } = require("express-validator");

const db = require("../db");
const store = require("./store");
const { requireAuth } = require("../auth/middleware");
const { verifyAccess } = require("../auth/tokens");

const router = express.Router();

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ message: "Données invalides", errors: errors.array() });
    return false;
  }
  return true;
};

/* List notifications for the current user */
router.get(
  "/",
  requireAuth,
  query("limit").optional().isInt({ min: 1, max: 200 }),
  query("offset").optional().isInt({ min: 0 }),
  query("unread").optional().isBoolean(),
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const result = await store.list(req.user.id, {
        limit: parseInt(req.query.limit || "50", 10),
        offset: parseInt(req.query.offset || "0", 10),
        unreadOnly: req.query.unread === "true",
      });
      res.json(result);
    } catch (e) {
      console.error("GET /api/notifications:", e);
      res.status(500).json({ message: e.message });
    }
  }
);

/* Unread count */
router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const result = await store.list(req.user.id, { limit: 1, offset: 0 });
    res.json({ unread: result.unread, total: result.total });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/* Mark one as read */
router.post(
  "/:id/read",
  requireAuth,
  param("id").isString().isLength({ min: 1 }),
  async (req, res) => {
    if (!validate(req, res)) return;
    const r = await store.markRead(req.user.id, req.params.id);
    if (!r) return res.status(404).json({ message: "Notification introuvable" });
    res.json({ data: r });
  }
);

/* Mark all as read */
router.post("/read-all", requireAuth, async (req, res) => {
  const n = await store.markAllRead(req.user.id);
  res.json({ updated: n });
});

/* Delete one */
router.delete(
  "/:id",
  requireAuth,
  param("id").isString().isLength({ min: 1 }),
  async (req, res) => {
    if (!validate(req, res)) return;
    const ok = await store.remove(req.user.id, req.params.id);
    if (!ok) return res.status(404).json({ message: "Notification introuvable" });
    res.json({ message: "Notification supprimée" });
  }
);

/* Query-token auth for SSE (EventSource can't set Authorization header) */
const requireAuthQuery = async (req, res, next) => {
  let token = null;
  const header = req.get("authorization") || "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (m) token = m[1];
  if (!token && req.query._t) token = String(req.query._t);
  if (!token) return res.status(401).json({ message: "Token manquant" });

  try {
    const payload = verifyAccess(token);
    const user = await db.store.users.findById(payload.sub);

    if (!user || user.statut !== "actif") {
      return res.status(401).json({ message: "Session invalide" });
    }

    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (_) {
    return res.status(401).json({ message: "Token invalide ou expiré" });
  }
};

/* SSE stream — real-time push */router.get("/stream", requireAuthQuery, (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  res.flushHeaders?.();
  res.write(`event: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const unsubscribe = store.subscribe(req.user.id, (event) => {
    res.write(`event: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`);
  });

  const heartbeat = setInterval(() => res.write(`: ping\n\n`), 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

/* Admin / system can emit a notification (auth required) */
router.post(
  "/emit",
  requireAuth,
  body("title").isString().isLength({ min: 1, max: 180 }),
  body("type").optional().isString().isLength({ max: 40 }),
  body("severity").optional().isIn(["info", "success", "warning", "danger", "critical"]),
  body("recipients").optional().isArray(),
  async (req, res) => {
    if (!validate(req, res)) return;

    const { title, message, type, severity, clientId, amount, meta, recipients } =
      req.body;

    let users;
    if (Array.isArray(recipients) && recipients.length) {
      users = recipients.map((x) => Number(x)).filter(Number.isFinite);
    } else {
      const all = await db.store.users.list();
      users = all.filter((u) => u.statut === "actif").map((u) => u.id);
    }

    const created = await store.fanout(users, {
      type: type || "system",
      severity: severity || "info",
      title,
      message,
      clientId,
      amount,
      meta,
    });

    res.status(201).json({ count: created.length });
  }
);

/* Generate real risk alerts from database */router.post("/generate-risk-alerts", requireAuth, async (req, res) => {
  try {
    const users = await db.store.users.list();
    const adminUsers = users.filter(
      (u) => u.statut === "actif" && (u.role === "admin" || u.role === "manager")
    );

    if (!adminUsers.length) {
      return res.status(404).json({ message: "Aucun administrateur actif trouvé" });
    }

    const result = await db.query(`
      SELECT
        c.customer_id,
        c.nom_client,
        c.email,
        COALESCE(r.niveau_risque, 'Inconnu') AS niveau_risque,
        COALESCE(MAX(f.nb_jours_retard), 0) AS nb_jours_retard,
        COALESCE(SUM(f.montant_impaye), 0) AS total_impaye
      FROM fact_impayes f
      LEFT JOIN dim_client c ON c.customer_id = f.client_id::varchar
      LEFT JOIN dim_risque r ON r.risque_id = f.risque_id
      GROUP BY
        c.customer_id,
        c.nom_client,
        c.email,
        r.niveau_risque
      HAVING
        COALESCE(SUM(f.montant_impaye), 0) > 5000
        OR COALESCE(MAX(f.nb_jours_retard), 0) > 60
        OR LOWER(COALESCE(r.niveau_risque, '')) IN ('eleve', 'élevé', 'critique', 'high')
      ORDER BY total_impaye DESC
      LIMIT 20
    `);

    let createdCount = 0;

    for (const row of result.rows) {
      for (const admin of adminUsers) {
        const severity =
          ["critique", "high"].includes(String(row.niveau_risque || "").toLowerCase())
            ? "danger"
            : "warning";

        await store.create({
          userId: admin.id,
          type: "risk_alert",
          severity,
          title: `Alerte client risqué : ${row.nom_client || "Client inconnu"}`,
          message: `Le client ${row.nom_client || "inconnu"} présente un dossier prioritaire.`,
          clientId: row.customer_id,
          amount: row.total_impaye,
          meta: {
            clientName: row.nom_client,
            clientEmail: row.email,
            riskLevel: row.niveau_risque,
            daysLate: row.nb_jours_retard,
          },
        });

        createdCount++;
      }
    }

    res.status(201).json({
      message: "Notifications de risque générées avec succès",
      count: createdCount,
      sourceRows: result.rows.length,
    });
  } catch (error) {
    console.error("POST /api/notifications/generate-risk-alerts:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
