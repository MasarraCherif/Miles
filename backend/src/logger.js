const winston = require("winston");
const config = require("./config");

const logger = winston.createLogger({
  level: config.isProd ? "info" : "debug",
  format: config.isProd
    ? winston.format.combine(winston.format.timestamp(), winston.format.json())
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: "HH:mm:ss" }),
        winston.format.printf(
          ({ timestamp, level, message, ...meta }) =>
            `${timestamp} ${level}: ${message}${
              Object.keys(meta).length ? " " + JSON.stringify(meta) : ""
            }`
        )
      ),
  transports: [new winston.transports.Console()],
});

module.exports = logger;
