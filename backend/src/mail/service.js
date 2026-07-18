const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");
const nodemailer = require("nodemailer");
const config = require("../config");
const db = require("../db");
const logger = require("../logger");

const TEMPLATES_DIR = path.join(__dirname, "templates");
const OUTBOX_DIR = path.join(__dirname, "..", "..", "mail-outbox");

let transporter = null;
const mode = config.smtp.host ? "smtp" : "outbox";

if (mode === "smtp") {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.password },
  });
  logger.info(`[mail] SMTP transport active (${config.smtp.host}:${config.smtp.port})`);
} else {
  if (!fs.existsSync(OUTBOX_DIR)) fs.mkdirSync(OUTBOX_DIR, { recursive: true });
  logger.warn(`[mail] SMTP not configured — using mock outbox at ${OUTBOX_DIR}`);
}

const templateCache = new Map();

const loadTemplate = (lang, name) => {
  const key = `${lang}/${name}`;
  if (templateCache.has(key)) return templateCache.get(key);

  const candidates = [
    path.join(TEMPLATES_DIR, lang, `${name}.hbs`),
    path.join(TEMPLATES_DIR, "fr", `${name}.hbs`), // fallback locale
  ];
  const file = candidates.find((p) => fs.existsSync(p));
  if (!file) throw new Error(`Template introuvable: ${name}`);

  const tpl = Handlebars.compile(fs.readFileSync(file, "utf8"));
  templateCache.set(key, tpl);
  return tpl;
};

const layout = Handlebars.compile(
  fs.readFileSync(path.join(TEMPLATES_DIR, "_layout.hbs"), "utf8")
);

const SITUATION_MAP = {
  CRITIQUE: "critique",
  "ÉLEVÉ": "eleve",
  ELEVE: "eleve",
  MOYEN: "moyen",
  BAS: "bas",
  PAYÉ: "paye",
  PAYE: "paye",
};

const formatCurrency = (v, lang = "fr") =>
  Number(v || 0).toLocaleString(lang === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

const renderEmail = ({ template, lang = "fr", subject, vars = {} }) => {
  const tpl = loadTemplate(lang, template);
  const body = tpl(vars);
  return layout({ subject, body, lang });
};

const sendMail = async ({ to, subject, template, lang = "fr", vars = {} }) => {
  const html = renderEmail({ template, lang, subject, vars });

  if (mode === "outbox") {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeTo = String(to).replace(/[^a-z0-9_.@-]/gi, "_");
    const file = path.join(OUTBOX_DIR, `${stamp}__${template}__${safeTo}.html`);
    fs.writeFileSync(
      file,
      `<!-- to: ${to} | subject: ${subject} | template: ${template} | lang: ${lang} -->\n${html}`,
      "utf8"
    );
    return { mode, file };
  }

  const info = await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject,
    html,
  });
  return { mode, messageId: info.messageId };
};

const sendPersonalized = async ({ clientId, situation, language, customVars = {} }) => {
  const client = db.store.clients.findById(clientId);
  if (!client) throw new Error("Client introuvable");
  const sit = situation || client.situation;
  const tplName = SITUATION_MAP[sit];
  if (!tplName) throw new Error(`Situation inconnue: ${sit}`);

  const lang = language || client.langue || "fr";
  const subjectMap = {
    fr: {
      critique: "Action requise — situation critique",
      eleve: "Relance — paiement attendu",
      moyen: "Rappel de paiement",
      bas: "Petit rappel amical",
      paye: "Merci pour votre paiement",
    },
    en: {
      critique: "Action required — critical situation",
      eleve: "Reminder — payment expected",
      moyen: "Payment reminder",
      bas: "Friendly reminder",
      paye: "Thank you for your payment",
    },
  };
  const subject =
    (subjectMap[lang] && subjectMap[lang][tplName]) ||
    subjectMap.fr[tplName];

  return sendMail({
    to: client.email,
    subject,
    template: tplName,
    lang,
    vars: {
      nom_client: client.nom_client,
      montant: formatCurrency(client.montant_du, lang),
      numero_contrat: client.numero_contrat || `CTR-${client.id}`,
      payUrl: `${config.frontendOrigin}/pay/${client.id}`,
      contactUrl: `${config.frontendOrigin}/contact/${client.id}`,
      ...customVars,
    },
  });
};

const sendBulk = async ({ situation, language }) => {
  const targets = db.store.clients.list(situation ? { situation } : {});
  const results = [];
  for (const c of targets) {
    if (situation && c.situation !== situation) continue;
    try {
      const r = await sendPersonalized({
        clientId: c.id,
        situation: c.situation,
        language,
      });
      results.push({ clientId: c.id, ok: true, ...r });
    } catch (err) {
      results.push({ clientId: c.id, ok: false, error: err.message });
    }
  }
  return { mode, count: results.length, results };
};

module.exports = {
  mode,
  sendMail,
  sendPersonalized,
  sendBulk,
  renderEmail,
};
