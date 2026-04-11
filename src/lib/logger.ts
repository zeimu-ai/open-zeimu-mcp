import pino from "pino";

import type { Env } from "../config/env.js";

export function createLogger(env: Env) {
  return pino(
    {
      level: env.logLevel,
      redact: {
        paths: [
          "*.token",
          "*.authorization",
          "*.secret",
          "*.password",
          "*.apiKey",
        ],
        censor: "[REDACTED]",
      },
      base: {
        service: "open-zeimu-mcp",
      },
    },
    pino.destination(2),
  );
}

export type Logger = ReturnType<typeof createLogger>;
