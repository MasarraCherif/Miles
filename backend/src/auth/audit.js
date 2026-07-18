const db = require("../db");

const logAuth = (req, event, extra = {}) => {
  db.store.audit.add({
    event,
    ip: req.ip,
    ua: req.get("user-agent") || "",
    ...extra,
  });
};

module.exports = { logAuth };
