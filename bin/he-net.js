#!/usr/bin/env node
require('../src/cli/main').main(process.argv.slice(2)).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
