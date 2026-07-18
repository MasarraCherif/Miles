const express = require("express");
const { body, validationResult } = require("express-validator");
const db = require("../db");
const { requireAuth, requireRole } = require("../auth/middleware");
const mail = require("./service");

const router = express.Router();

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ message: "Données invalides", errors: errors.array() });
    return false;
  }
  return true;
};

router.get("/status", requireAuth, (req, res) => {
  res.json({ mode: mail.mode, outbox: mail.mode === "outbox" });
});

router.get("/clients", requireAuth, (req, res) => {
  const { situation } = req.query;
  res.json({ clients: db.store.clients.list(situation ? { situation } : {}) });
});

router.post(
  "/send",
  requireAuth,
  requireRole("admin"),
  body("clientId").isInt(),
  body("situation").optional().isString(),
  body("language").optional().isIn(["fr", "en", "ar"]),
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const result = await mail.sendPersonalized({
        clientId: req.body.clientId,
        situation: req.body.situation,
        language: req.body.language,
        customVars: req.body.vars || {},
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

router.post(
  "/bulk",
  requireAuth,
  requireRole("admin"),
  body("situation").optional().isString(),
  body("language").optional().isIn(["fr", "en", "ar"]),
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const result = await mail.sendBulk({
        situation: req.body.situation,
        language: req.body.language,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

router.post(
  "/preview",
  requireAuth,
  body("template").isString(),
  body("lang").optional().isIn(["fr", "en", "ar"]),
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const html = mail.renderEmail({
        template: req.body.template,
        lang: req.body.lang || "fr",
        subject: req.body.subject || "Aperçu",
        vars: req.body.vars || {
          nom_client: "Client Démo",
          nom: "Démo",
          montant: "1 234 €",
          numero_contrat: "CTR-DEMO",
          code: "123456",
          validityMinutes: 5,
          payUrl: "#",
          contactUrl: "#",
          resetUrl: "#",
        },
      });
      res.type("html").send(html);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

module.exports = router;
