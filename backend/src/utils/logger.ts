import pino, { type Logger } from "pino";

import type { Env } from "../config/env.js";

const REDACTED_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers['set-cookie']",
  "password",
  "*.password",
  "currentPassword",
  "*.currentPassword",
  "newPassword",
  "*.newPassword",
  "token",
  "*.token",
  "accessCode",
  "*.accessCode",
  "sessionToken",
  "*.sessionToken",
  "password_hash",
  "*.password_hash",
  "access_code_hash",
  "*.access_code_hash",
  "token_hash",
  "*.token_hash",
  "signedUrl",
  "*.signedUrl",
];

export function createLogger(env: Env): Logger {
  return pino({
    level: env.LOG_LEVEL,
    base: {
      service: "rollo-api",
      env: env.NODE_ENV,
    },
    redact: {
      paths: REDACTED_PATHS,
      censor: "[REDACTED]",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
