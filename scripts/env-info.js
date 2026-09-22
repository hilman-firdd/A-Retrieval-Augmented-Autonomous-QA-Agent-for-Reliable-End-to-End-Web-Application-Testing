#!/usr/bin/env node
// Mencatat lingkungan eksekusi untuk Bagian 4.5 (Implementation) naskah.
const os = require('os');
const fs = require('fs');
const path = require('path');
const pkg = (n) => { try { return require(`${n}/package.json`).version; } catch { return null; } };
const info = {
  os: `${os.type()} ${os.release()} (${os.platform()} ${os.arch()})`,
  cpu: `${os.cpus()[0]?.model} x ${os.cpus().length}`,
  memoryGB: +(os.totalmem() / 2 ** 30).toFixed(1),
  node: process.version,
  playwright: pkg('@playwright/test'),
  axeCore: pkg('@axe-core/playwright'),
  recordedAt: new Date().toISOString(),
};
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync(path.join('results', 'env-info.json'), JSON.stringify(info, null, 2));
console.log(JSON.stringify(info, null, 2));
