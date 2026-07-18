const fs = require("fs");
const path = require("path");
const multer = require("multer");

/* ----------------------------------------------------------
   CREATE uploads folder if not exists
---------------------------------------------------------- */
const uploadDir = path.join(__dirname, "..", "..", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

/* ----------------------------------------------------------
   MULTER CONFIG
---------------------------------------------------------- */
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = { upload, uploadDir };
