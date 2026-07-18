/* ----------------------------------------------------------
   Lazy Groq
---------------------------------------------------------- */
let _groq = null;

const getGroq = () => {
  if (!process.env.GROQ_API_KEY) {
    const e = new Error("GROQ_API_KEY non configurée");
    e.status = 503;
    throw e;
  }

  if (!_groq) {
    const Groq = require("groq-sdk");
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }

  return _groq;
};

module.exports = { getGroq };
