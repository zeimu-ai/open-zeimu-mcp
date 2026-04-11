#!/usr/bin/env node

import { loadEnv } from "./config/env.js";
import { createServer } from "./server.js";

async function main() {
  const env = loadEnv();
  const server = await createServer({ env });
  await server.start();
}

main().catch((err) => {
  console.error("[open-zeimu-mcp] fatal:", err);
  process.exit(1);
});
