const bcrypt = require("bcryptjs");
const config = require("../config");

const hashPassword = (plain) => bcrypt.hash(plain, config.auth.bcryptRounds);
const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

const PW_RULES = [
  { test: (p) => p.length >= config.auth.pwMinLength, msg: `Au moins ${config.auth.pwMinLength} caractères` },
  { test: (p) => /[a-z]/.test(p), msg: "Au moins une minuscule" },
  { test: (p) => /[A-Z]/.test(p), msg: "Au moins une majuscule" },
  { test: (p) => /[0-9]/.test(p), msg: "Au moins un chiffre" },
  { test: (p) => /[^A-Za-z0-9]/.test(p), msg: "Au moins un caractère spécial" },
];

const validatePasswordPolicy = (plain) => {
  const errors = PW_RULES.filter((r) => !r.test(String(plain || ""))).map((r) => r.msg);
  return { ok: errors.length === 0, errors };
};

module.exports = { hashPassword, verifyPassword, validatePasswordPolicy };
