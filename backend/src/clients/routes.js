const express = require("express");
const { body, param, query, validationResult } = require("express-validator");

const db = require("../db");
const { requireAuth, requireRole } = require("../auth/middleware");

const router = express.Router();

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ message: "Données invalides", errors: errors.array() });
    return false;
  }
  return true;
};

const dbDown = (res) =>
  res.status(503).json({
    message: "Service indisponible — base de données hors ligne.",
  });

/* ---------------------------------------------
   GET /api/clients  — list with search + pagination
--------------------------------------------- */
router.get(
  "/",
  requireAuth,
  query("limit").optional().isInt({ min: 1, max: 500 }),
  query("offset").optional().isInt({ min: 0 }),
  query("search").optional().isString().isLength({ max: 120 }),
  async (req, res) => {
    if (!validate(req, res)) return;
    if (db.isMemory()) return dbDown(res);

    try {
      const limit = parseInt(req.query.limit || "50", 10);
      const offset = parseInt(req.query.offset || "0", 10);
      const search = (req.query.search || "").trim();

      const params = [limit, offset];
      let where = "";
      if (search) {
        params.push(`%${search}%`);
        where = `WHERE LOWER(c.nom_client) LIKE LOWER($3) OR LOWER(c.email) LIKE LOWER($3)`;
      }

      const sql = `
        SELECT
          c.customer_id,
          c.nom_client,
          c.email,
          c.telephone,
          c.adresse,
          c.ville,
          c.pays,
          c.langue,
          c.segment,
          c.date_creation,
          COALESCE(SUM(f.montant_impaye), 0) AS total_du,
          COUNT(f.impaye_id) AS nb_impayes,
          MAX(rk.niveau_risque) AS dernier_risque
        FROM dim_client c
        LEFT JOIN fact_impayes f ON c.customer_id = f.client_id::varchar
        LEFT JOIN dim_risque rk ON f.risque_id = rk.risque_id
        ${where}
        GROUP BY c.customer_id, c.nom_client, c.email, c.telephone,
                 c.adresse, c.ville, c.pays, c.langue, c.segment, c.date_creation
        ORDER BY c.nom_client ASC
        LIMIT $1 OFFSET $2
      `;

      const r = await db.query(sql, params);

      const countSql = search
        ? `SELECT COUNT(*) AS total FROM dim_client c
           WHERE LOWER(c.nom_client) LIKE LOWER($1) OR LOWER(c.email) LIKE LOWER($1)`
        : `SELECT COUNT(*) AS total FROM dim_client`;
      const cParams = search ? [`%${search}%`] : [];
      const cRes = await db.query(countSql, cParams);

      res.json({
        data: r.rows,
        total: Number(cRes.rows[0].total),
        limit,
        offset,
      });
    } catch (error) {
      console.error("GET /api/clients:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

/* ---------------------------------------------
   GET /api/clients/:id  — single client w/ history
--------------------------------------------- */
router.get(
  "/:id",
  requireAuth,
  param("id").isString().isLength({ min: 1, max: 64 }),
  async (req, res) => {
    if (!validate(req, res)) return;
    if (db.isMemory()) return dbDown(res);

    try {
      const id = req.params.id;
      const client = await db.query(
        `SELECT * FROM dim_client WHERE customer_id = $1 LIMIT 1`,
        [id]
      );
      if (!client.rows.length)
        return res.status(404).json({ message: "Client introuvable" });

      const history = await db.query(
        `
        SELECT f.impaye_id, f.montant_impaye, f.statut_paiement,
               f.date_constat, rk.niveau_risque, f.contrat_id
        FROM fact_impayes f
        LEFT JOIN dim_risque rk ON f.risque_id = rk.risque_id
        WHERE f.client_id::varchar = $1
        ORDER BY f.date_constat DESC
        LIMIT 50
        `,
        [id]
      );

      const stats = await db.query(
        `
        SELECT
          COALESCE(SUM(montant_impaye),0) AS total_du,
          COUNT(*) AS nb_impayes,
          COALESCE(AVG(montant_impaye),0) AS montant_moyen
        FROM fact_impayes WHERE client_id::varchar = $1
        `,
        [id]
      );

      res.json({
        client: client.rows[0],
        history: history.rows,
        stats: stats.rows[0],
      });
    } catch (error) {
      console.error("GET /api/clients/:id:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

/* ---------------------------------------------
   POST /api/clients  — create
--------------------------------------------- */
router.post(
  "/",
  requireAuth,
  body("nom_client").isString().trim().isLength({ min: 2, max: 160 }),
  body("email").optional({ checkFalsy: true }).isEmail(),
  body("telephone").optional().isString().isLength({ max: 40 }),
  body("adresse").optional().isString().isLength({ max: 240 }),
  body("ville").optional().isString().isLength({ max: 80 }),
  body("pays").optional().isString().isLength({ max: 80 }),
  body("langue").optional().isString().isLength({ max: 5 }),
  body("segment").optional().isString().isLength({ max: 60 }),
  async (req, res) => {
    if (!validate(req, res)) return;
    if (db.isMemory()) return dbDown(res);

    try {
      const {
        customer_id,
        nom_client,
        email,
        telephone,
        adresse,
        ville,
        pays,
        langue,
        segment,
      } = req.body;

      const id = customer_id || `CLI-${Date.now()}`;

      const r = await db.query(
        `
        INSERT INTO dim_client
          (customer_id, nom_client, email, telephone, adresse, ville, pays, langue, segment, date_creation)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, CURRENT_DATE)
        RETURNING *
        `,
        [
          id,
          nom_client,
          email || null,
          telephone || null,
          adresse || null,
          ville || null,
          pays || "TN",
          langue || "fr",
          segment || "Particulier",
        ]
      );

      res.status(201).json({ data: r.rows[0] });
    } catch (error) {
      console.error("POST /api/clients:", error);
      if (error.code === "23505")
        return res.status(409).json({ message: "Client existant (customer_id en double)" });
      res.status(500).json({ message: error.message });
    }
  }
);

/* ---------------------------------------------
   PUT /api/clients/:id  — update
--------------------------------------------- */
router.put(
  "/:id",
  requireAuth,
  param("id").isString().isLength({ min: 1, max: 64 }),
  body("nom_client").optional().isString().isLength({ min: 2, max: 160 }),
  body("email").optional({ checkFalsy: true }).isEmail(),
  async (req, res) => {
    if (!validate(req, res)) return;
    if (db.isMemory()) return dbDown(res);

    try {
      const allowed = [
        "nom_client", "email", "telephone", "adresse",
        "ville", "pays", "langue", "segment",
      ];
      const patch = {};
      for (const k of allowed) {
        if (k in req.body) patch[k] = req.body[k] === "" ? null : req.body[k];
      }
      if (!Object.keys(patch).length)
        return res.status(400).json({ message: "Aucun champ à mettre à jour" });

      const sets = Object.keys(patch).map((k, i) => `${k} = $${i + 1}`).join(", ");
      const values = Object.values(patch);
      values.push(req.params.id);

      const r = await db.query(
        `UPDATE dim_client SET ${sets} WHERE customer_id = $${values.length} RETURNING *`,
        values
      );

      if (!r.rows.length)
        return res.status(404).json({ message: "Client introuvable" });

      res.json({ data: r.rows[0] });
    } catch (error) {
      console.error("PUT /api/clients/:id:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

/* ---------------------------------------------
   DELETE /api/clients/:id  — delete (admin)
--------------------------------------------- */
router.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  param("id").isString().isLength({ min: 1, max: 64 }),
  async (req, res) => {
    if (!validate(req, res)) return;
    if (db.isMemory()) return dbDown(res);

    try {
      const check = await db.query(
        `SELECT COUNT(*) AS n FROM fact_impayes WHERE client_id::varchar = $1`,
        [req.params.id]
      );
      if (Number(check.rows[0].n) > 0) {
        return res.status(409).json({
          message: "Impossible de supprimer : ce client a des impayés liés.",
        });
      }

      const r = await db.query(
        `DELETE FROM dim_client WHERE customer_id = $1 RETURNING customer_id`,
        [req.params.id]
      );

      if (!r.rows.length)
        return res.status(404).json({ message: "Client introuvable" });

      res.json({ message: "Client supprimé", id: r.rows[0].customer_id });
    } catch (error) {
      console.error("DELETE /api/clients/:id:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;
