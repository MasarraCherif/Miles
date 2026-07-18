const express = require("express");
const { query, validationResult } = require("express-validator");

const db = require("../db");
const logger = require("../logger");
const { requireAuth } = require("../auth/middleware");

const router = express.Router();

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ message: "Paramètres invalides", errors: errors.array() });
    return false;
  }
  return true;
};

const dbDown = (res) =>
  res.status(503).json({
    message: "Service indisponible — base de données hors ligne.",
  });

/* -----------------------------------------------------------
   GET /api/dashboard/overview
   KPIs + Month-over-Month deltas
----------------------------------------------------------- */
router.get("/overview", requireAuth, async (req, res) => {
  if (db.isMemory()) return dbDown(res);

  try {
    const r = await db.query(`
      WITH base AS (
        SELECT
          COALESCE(SUM(montant_impaye), 0)::numeric AS total_impayes,
          COUNT(*)::int AS nombre_impayes,
          COUNT(DISTINCT client_id)::int AS nombre_clients,
          COALESCE(AVG(montant_impaye), 0)::numeric AS montant_moyen
        FROM fact_impayes
      ),
      this_month AS (
        SELECT
          COALESCE(SUM(montant_impaye), 0)::numeric AS total,
          COUNT(*)::int AS nb
        FROM fact_impayes
        WHERE date_constat::date >= date_trunc('month', CURRENT_DATE)::date
      ),
      last_month AS (
        SELECT
          COALESCE(SUM(montant_impaye), 0)::numeric AS total,
          COUNT(*)::int AS nb
        FROM fact_impayes
        WHERE date_constat::date >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date
          AND date_constat::date < date_trunc('month', CURRENT_DATE)::date
      ),
      recovered AS (
        SELECT
          COALESCE(SUM(montant_recouvre), 0)::numeric AS rec,
          COALESCE(SUM(montant_impaye), 0)::numeric AS tot
        FROM fact_impayes
      )
      SELECT
        b.total_impayes,
        b.nombre_impayes,
        b.nombre_clients,
        b.montant_moyen,
        t.total AS month_total,
        t.nb AS month_nb,
        l.total AS prev_total,
        l.nb AS prev_nb,
        CASE
          WHEN r.tot > 0 THEN (r.rec / r.tot) * 100
          ELSE 0
        END AS taux_recouvrement
      FROM base b, this_month t, last_month l, recovered r;
    `);

    const row = r.rows[0] || {};

    const pct = (cur, prev) =>
      Number(prev) > 0 ? ((Number(cur) - Number(prev)) / Number(prev)) * 100 : 0;

    res.json({
      total_impayes: Number(row.total_impayes || 0),
      nombre_impayes: Number(row.nombre_impayes || 0),
      nombre_clients: Number(row.nombre_clients || 0),
      montant_moyen: Number(row.montant_moyen || 0),
      taux_recouvrement: Number(row.taux_recouvrement || 0),
      deltas: {
        montant: pct(row.month_total, row.prev_total),
        nombre: pct(row.month_nb, row.prev_nb),
      },
    });
  } catch (e) {
    logger.error("GET /api/dashboard/overview:", e);
    res.status(500).json({ message: e.message });
  }
});
router.get("/risk-clients-by-month", requireAuth, async (req, res) => {
  try {
    const month = req.query.month;

    if (!month) {
      return res.status(400).json({ message: "Le paramètre month est obligatoire (format YYYY-MM)" });
    }

    const result = await db.query(
      `
      SELECT
        c.customer_id,
        c.nom_client,
        c.email,
        COALESCE(r.niveau_risque, 'Inconnu') AS niveau_risque,
        COALESCE(SUM(f.montant_impaye), 0) AS montant_impaye,
        COALESCE(MAX(f.nb_jours_retard), 0) AS nb_jours_retard,
        COUNT(f.impaye_id) AS nb_dossiers
      FROM fact_impayes f
      LEFT JOIN dim_client c ON c.customer_id = f.client_id::varchar
      LEFT JOIN dim_risque r ON r.risque_id = f.risque_id
      WHERE TO_CHAR(f.date_constat::date, 'YYYY-MM') = $1
      GROUP BY
        c.customer_id,
        c.nom_client,
        c.email,
        r.niveau_risque
      HAVING
        COALESCE(SUM(f.montant_impaye), 0) > 0
      ORDER BY montant_impaye DESC
      `,
      [month]
    );

    res.json({
      month,
      data: result.rows,
    });
  } catch (error) {
    logger.error("GET /api/dashboard/risk-clients-by-month:", error);
    res.status(500).json({ message: error.message });
  }
});


/* -----------------------------------------------------------
   GET /api/dashboard/trend?range=3M|6M|12M
   monthly time-series of impayés
----------------------------------------------------------- */
router.get(
  "/trend",
  requireAuth,
  query("range").optional().isIn(["3M", "6M", "12M"]),
  async (req, res) => {
    if (!validate(req, res)) return;
    if (db.isMemory()) return dbDown(res);
    try {
      const range = req.query.range || "6M";
      const months = range === "3M" ? 3 : range === "12M" ? 12 : 6;

      const r = await db.query(
        `
        WITH months AS (
          SELECT generate_series(
            date_trunc('month', CURRENT_DATE) - (($1 - 1) || ' months')::interval,
            date_trunc('month', CURRENT_DATE),
            INTERVAL '1 month'
          )::date AS m
        )
        SELECT
          to_char(m.m, 'YYYY-MM')                        AS month_key,
          COALESCE(SUM(f.montant_impaye), 0)::numeric    AS total,
          COUNT(f.impaye_id)                             AS nb
        FROM months m
        LEFT JOIN fact_impayes f
          ON date_trunc('month', f.date_constat::date) = m.m

        GROUP BY m.m
        ORDER BY m.m ASC
        `,
        [months]
      );

      res.json({
        range,
        labels: r.rows.map((x) => x.month_key),
        totals: r.rows.map((x) => Number(x.total)),
        counts: r.rows.map((x) => Number(x.nb)),
      });
    } catch (e) {
      logger.error("GET /api/dashboard/trend:", e);
      res.status(500).json({ message: e.message });
    }
  }
);

/* -----------------------------------------------------------
   GET /api/dashboard/distribution
   buckets by risk level + by status
----------------------------------------------------------- */
router.get("/distribution", requireAuth, async (req, res) => {
  if (db.isMemory()) return dbDown(res);
  try {
    const byRisk = await db.query(`
      SELECT COALESCE(rk.niveau_risque,'INCONNU') AS niveau,
             COUNT(*) AS nb,
             COALESCE(SUM(f.montant_impaye),0) AS total
      FROM fact_impayes f
      LEFT JOIN dim_risque rk ON f.risque_id = rk.risque_id
      GROUP BY rk.niveau_risque
      ORDER BY total DESC
    `);

    const byStatus = await db.query(`
      SELECT COALESCE(statut_paiement,'IMPAYÉ') AS statut,
             COUNT(*) AS nb,
             COALESCE(SUM(montant_impaye),0) AS total
      FROM fact_impayes
      GROUP BY statut_paiement
      ORDER BY total DESC
    `);

    res.json({
      risk:   byRisk.rows.map((r) => ({
        niveau: r.niveau, nb: Number(r.nb), total: Number(r.total),
      })),
      status: byStatus.rows.map((r) => ({
        statut: r.statut, nb: Number(r.nb), total: Number(r.total),
      })),
    });
  } catch (e) {
    logger.error("GET /api/dashboard/distribution:", e);
    res.status(500).json({ message: e.message });
  }
});

/* -----------------------------------------------------------
   GET /api/dashboard/top-risk
   top clients by exposure / risk
----------------------------------------------------------- */
router.get(
  "/top-risk",
  requireAuth,
  query("limit").optional().isInt({ min: 1, max: 50 }),
  async (req, res) => {
    if (!validate(req, res)) return;
    if (db.isMemory()) return dbDown(res);
    try {
      const limit = parseInt(req.query.limit || "5", 10);
      const r = await db.query(
        `
        SELECT
          c.customer_id,
          c.nom_client,
          COALESCE(SUM(f.montant_impaye),0)::numeric AS total_du,
          COUNT(f.impaye_id) AS nb_impayes,
          MAX(rk.niveau_risque) AS niveau_risque,
          MAX(f.contrat_id::text) AS dernier_contrat
        FROM fact_impayes f
        LEFT JOIN dim_client c ON f.client_id::varchar = c.customer_id
        LEFT JOIN dim_risque rk ON f.risque_id = rk.risque_id
        GROUP BY c.customer_id, c.nom_client
        ORDER BY total_du DESC
        LIMIT $1
        `,
        [limit]
      );
      res.json({
        data: r.rows.map((x) => ({
          ...x,
          total_du: Number(x.total_du),
          nb_impayes: Number(x.nb_impayes),
        })),
      });
    } catch (e) {
      logger.error("GET /api/dashboard/top-risk:", e);
      res.status(500).json({ message: e.message });
    }
  }
);

/* -----------------------------------------------------------
   GET /api/dashboard/activity
   recent activity feed
----------------------------------------------------------- */
router.get(
  "/activity",
  requireAuth,
  query("limit").optional().isInt({ min: 1, max: 100 }),
  async (req, res) => {
    if (!validate(req, res)) return;
    if (db.isMemory()) return dbDown(res);
    try {
      const limit = parseInt(req.query.limit || "10", 10);
      const r = await db.query(
        `
        SELECT
          f.impaye_id,
          f.montant_impaye,
          f.statut_paiement,
          f.date_constat,
          c.nom_client,
          rk.niveau_risque
        FROM fact_impayes f
        LEFT JOIN dim_client c ON f.client_id::varchar = c.customer_id
        LEFT JOIN dim_risque rk ON f.risque_id = rk.risque_id
        ORDER BY f.date_constat DESC, f.impaye_id DESC
        LIMIT $1
        `,
        [limit]
      );
      res.json({ data: r.rows });
    } catch (e) {
      logger.error("GET /api/dashboard/activity:", e);
      res.status(500).json({ message: e.message });
    }
  }
);

module.exports = router;
