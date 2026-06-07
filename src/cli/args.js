'use strict';

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const [rawKey, inlineValue] = token.slice(2).split(/=(.*)/s);
    const key = rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    if (inlineValue !== undefined) {
      append(args, key, inlineValue);
    } else if (argv[index + 1] && !argv[index + 1].startsWith('--')) {
      append(args, key, argv[index + 1]);
      index += 1;
    } else {
      append(args, key, true);
    }
  }
  return args;
}

function append(args, key, value) {
  if (args[key] === undefined) {
    args[key] = value;
    return;
  }
  if (!Array.isArray(args[key])) args[key] = [args[key]];
  args[key].push(value);
}

function required(args, key) {
  if (args[key] === undefined || args[key] === true || args[key] === '') {
    throw new Error(`Missing required --${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`);
  }
  return args[key];
}

module.exports = { parseArgs, required };
