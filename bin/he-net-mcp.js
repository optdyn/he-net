#!/usr/bin/env node
require('../src/mcp/server').main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
