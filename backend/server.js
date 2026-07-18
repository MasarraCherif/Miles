const express = require("express");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const config = require("./src/config");
const db = require("./src/db");

const { helmetMw, corsMw, originGuard } = require("./src/security/middleware");
const { globalLimiter, aiLimiter } = require("./src/security/rateLimit");
const securityRoutes = require("./src/security/routes");
const authRoutes = require("./src/auth/routes");
const mailRoutes = require("./src/mail/routes");
const clientsRoutes = require("./src/clients/routes");
const usersRoutes = require("./src/users/routes");
const notificationsRoutes = require("./src/notifications/routes");
const notificationsStore = require("./src/notifications/store");
const dashboardRoutes = require("./src/dashboard/routes");
const aiRoutes = require("./src/ai/routes");
const nodemailer = require("nodemailer");

const dbDown = (res) =>
  res.status(503).json({
    message: "Service indisponible — base de données hors ligne (mode mémoire).",
  });

const app = express();

/* ----------------------------------------------------------
   Core middleware
---------------------------------------------------------- */
app.set("trust proxy", 1);
app.use(helmetMw);
app.use(corsMw);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser(config.cookies.secret));
app.use(morgan(config.isProd ? "combined" : "dev"));
app.use(originGuard);
app.use(globalLimiter);

/* ----------------------------------------------------------
   Public health
---------------------------------------------------------- */
app.get("/", (req, res) => {
  res.send("MILES Smart Recovery Platform API is running");
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    db: db.mode,
    smtp: config.smtp.host ? "smtp" : "outbox",
    timestamp: new Date().toISOString(),
  });
});

/* ----------------------------------------------------------
   Modular routes
---------------------------------------------------------- */
app.use("/api/auth", authRoutes);
app.use("/api/security", securityRoutes);
app.use("/api/mail", mailRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api", aiRoutes);

/* ----------------------------------------------------------
   DB TEST
---------------------------------------------------------- */
app.get("/api/db-test", async (req, res) => {
  if (db.isMemory()) return dbDown(res);

  try {
    const result = await db.query("SELECT NOW()");
    res.json({ status: "ok", time: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ status: "error", error: error.message });
  }
});

/* ----------------------------------------------------------
   IMPAYES LIST
---------------------------------------------------------- */
app.get("/api/impayes", async (req, res) => {
  if (db.isMemory()) return dbDown(res);

  try {
    const limit = parseInt(req.query.limit || "50", 10);
    const offset = parseInt(req.query.offset || "0", 10);

    const r = await db.query(
      `
      SELECT
        f.impaye_id,
        f.montant_impaye,
        f.statut_paiement,
        f.date_constat AS date_impaye,
        c.nom_client,
        rk.niveau_risque,
        CAST(f.contrat_id AS TEXT) AS numero_contrat
      FROM fact_impayes f
      LEFT JOIN dim_client c ON f.client_id::varchar = c.customer_id
      LEFT JOIN dim_risque rk ON f.risque_id = rk.risque_id
      ORDER BY f.date_constat DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );

    res.json({ data: r.rows });
  } catch (error) {
    console.error("Erreur /api/impayes :", error);
    res.status(500).json({ message: error.message });
  }
});

/* ----------------------------------------------------------
   ADD IMPAYE
---------------------------------------------------------- */
app.post("/api/impayes", async (req, res) => {
  if (db.isMemory()) return dbDown(res);

  try {
    const {
      nom_client,
      numero_contrat,
      montant_impaye,
      statut_paiement,
      niveau_risque,
    } = req.body;

    if (!nom_client || !montant_impaye) {
      return res.status(400).json({
        message: "Nom client et montant obligatoires",
      });
    }

    const clientResult = await db.query(
      `
      SELECT customer_id
      FROM dim_client
      WHERE LOWER(nom_client) LIKE LOWER($1)
      LIMIT 1
      `,
      [`%${nom_client}%`]
    );

    if (!clientResult.rows.length) {
      return res.status(404).json({
        message: "Client introuvable dans dim_client",
      });
    }

    const client_id = clientResult.rows[0].customer_id;

    let risque_id = null;

    if (niveau_risque) {
      const risqueResult = await db.query(
        `
        SELECT risque_id
        FROM dim_risque
        WHERE UPPER(niveau_risque) = UPPER($1)
        LIMIT 1
        `,
        [niveau_risque]
      );

      if (risqueResult.rows.length) {
        risque_id = risqueResult.rows[0].risque_id;
      }
    }

    const insertResult = await db.query(
      `
      INSERT INTO fact_impayes (
        client_id,
        contrat_id,
        risque_id,
        montant_impaye,
        statut_paiement,
        date_constat
      )
      VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
      RETURNING *
      `,
      [
        client_id,
        numero_contrat || null,
        risque_id,
        Number(montant_impaye),
        statut_paiement || "IMPAYÉ",
      ]
    );

    try {
      const all = await db.store.users.list();
      const recipients = all.filter((u) => u.statut === "actif").map((u) => u.id);
      const severity =
        (niveau_risque || "").toUpperCase().match(/^(CRITIQUE|HIGH|ÉLEVÉ|ELEVE)$/)
          ? "danger"
          : "warning";
      await notificationsStore.fanout(recipients, {
        type: "new_impaye",
        severity,
        title: `Nouvel impayé : ${nom_client}`,
        message: `Montant ${Number(montant_impaye).toLocaleString("fr-FR")} TND — risque ${niveau_risque || "N/A"}.`,
        clientId: client_id,
        amount: Number(montant_impaye),
        meta: { contrat: numero_contrat || null },
      });
    } catch (e) {
      console.warn("notification fanout failed:", e.message);
    }

    res.status(201).json({
      message: "Dossier ajouté avec succès",
      data: insertResult.rows[0],
    });
  } catch (error) {
    console.error("Erreur POST /api/impayes :", error);
    res.status(500).json({
      message: error.message,
    });
  }
});

/* ----------------------------------------------------------
   ALERTES
---------------------------------------------------------- */
app.get("/api/alertes", async (req, res) => {
  if (db.isMemory()) return dbDown(res);

  try {
    const r = await db.query(`
      SELECT f.impaye_id, f.montant_impaye, f.statut_paiement, c.nom_client, r.niveau_risque
      FROM fact_impayes f
      LEFT JOIN dim_client c ON f.client_id::varchar = c.customer_id
      LEFT JOIN dim_risque r ON f.risque_id = r.risque_id
      ORDER BY f.montant_impaye DESC LIMIT 10
    `);

    res.json(r.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ----------------------------------------------------------
   NOTIFICATIONS RISQUE
---------------------------------------------------------- */
app.get("/api/notifications-risque", async (req, res) => {
  if (db.isMemory()) return dbDown(res);

  try {
    const r = await db.query(`
      SELECT c.nom_client, r.niveau_risque, f.montant_impaye
      FROM fact_impayes f
      LEFT JOIN dim_client c ON f.client_id::varchar = c.customer_id
      LEFT JOIN dim_risque r ON f.risque_id = r.risque_id
      WHERE LOWER(r.niveau_risque) IN ('high','élevé','eleve','critique')
      ORDER BY f.montant_impaye DESC LIMIT 5
    `);

    const notifications = r.rows.map((row, i) => ({
      id: i + 1,
      type: "risque",
      niveau: row.niveau_risque,
      client: row.nom_client,
      montant: row.montant_impaye,
      message: `Le client ${row.nom_client} présente un niveau ${row.niveau_risque} avec un impayé de ${Number(row.montant_impaye || 0).toLocaleString("fr-FR")} €.`,
      date: new Date().toISOString().split("T")[0],
    }));

    res.json({ total: notifications.length, notifications });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ----------------------------------------------------------
   MAIL — CLIENT REMINDER
---------------------------------------------------------- */
app.post("/api/mail/send-client-reminder", async (req, res) => {
  try {
    const TEST_EMAIL = "teamwillmasarra@gmail.com";

    const { clientName, amount, riskLevel } = req.body;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const subject = `Rappel de paiement - ${clientName || "Client"}`;

    const html = `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <h2 style="color: #b91c1c;">Rappel de paiement</h2>
        <p>Bonjour <strong>${clientName || "Client"}</strong>,</p>
        <p>Nous vous contactons concernant un dossier de paiement nécessitant votre attention.</p>
        <div style="background: #f9fafb; padding: 16px; border-radius: 10px; border: 1px solid #e5e7eb;">
          <p><strong>Montant impayé :</strong> ${Number(amount || 0).toLocaleString("fr-FR")} TND</p>
          <p><strong>Niveau de risque :</strong> ${riskLevel || "Non précisé"}</p>
        </div>
        <p style="margin-top: 16px;">Nous vous invitons à prendre contact avec notre service de recouvrement dans les meilleurs délais afin de régulariser votre situation.</p>
        <p>Merci pour votre compréhension.</p>
        <p style="margin-top: 24px;">Cordialement,<br /><strong>Équipe MILES Smart Recovery Platform</strong></p>
      </div>
    `;

    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: TEST_EMAIL,
      subject,
      html,
    });

    res.json({
      message: "Email de relance envoyé avec succès",
      sentTo: TEST_EMAIL,
      messageId: info.messageId,
    });
  } catch (error) {
    console.error("POST /api/mail/send-client-reminder:", error);
    res.status(500).json({ message: error.message });
  }
});

/* ----------------------------------------------------------
   404 + global error handling
---------------------------------------------------------- */
app.use((req, res) => {
  res.status(404).json({ message: "Route non trouvée" });
});

app.use((err, req, res, next) => {
  console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err);
  res.status(err.status || 500).json({
    message: config.isProd ? "Erreur serveur interne" : err.message || "Erreur serveur interne",
  });
});

/* ----------------------------------------------------------
   START SERVER
---------------------------------------------------------- */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 MILES API running on http://localhost:${PORT}`);
  console.log(`🔧 Mode: ${config.isProd ? "production" : "development"}`);
  console.log(`🤖 Groq IA activee - Analyse intelligente des donnees`);
});
