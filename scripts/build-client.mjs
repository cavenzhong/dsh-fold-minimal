#!/usr/bin/env node
/**
 * Build the single browser bundle from src/.
 *
 * The bundle is still one IIFE-free `window.__ModuleLoader__.load({...})`
 * registration: DSH loads exactly one client.js and the runtime has no build
 * step or third-party dependency. `src/` is only the authoring layout.
 *
 * Usage:
 *   node scripts/build-client.mjs          # write client.js
 *   node scripts/build-client.mjs --check  # verify client.js is current
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'src');
const target = path.join(root, 'client.js');
const checkOnly = process.argv.includes('--check');

function fail(message) {
  console.error(`build-client: ${message}`);
  process.exit(1);
}

const manifestPath = path.join(sourceDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) fail('missing src/manifest.json');

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (error) {
  fail(`cannot parse src/manifest.json: ${error.message}`);
}
if (!manifest || !Array.isArray(manifest.modules) || manifest.modules.length === 0) {
  fail('src/manifest.json must contain a non-empty "modules" array');
}
if (manifest.modules[manifest.modules.length - 1].file !== '99-exports.js') {
  fail('99-exports.js must be the last manifest module');
}

const seen = new Set();
const fragments = [];
for (const entry of manifest.modules) {
  if (!entry || typeof entry.file !== 'string' || entry.file.length === 0) {
    fail('every manifest module needs a file');
  }
  if (seen.has(entry.file)) fail(`duplicate module: ${entry.file}`);
  seen.add(entry.file);
  const file = path.join(sourceDir, entry.file);
  if (!fs.existsSync(file)) fail(`missing module: src/${entry.file}`);
  const source = fs.readFileSync(file, 'utf8');
  if (/^\s*(?:import|export)\s/m.test(source)) {
    fail(`src/${entry.file} contains import/export; modules are concatenated into one factory`);
  }
  const body = source.replace(/\s+$/, '');
  if (body.length === 0) fail(`src/${entry.file} is empty`);
  const description = typeof entry.description === 'string' && entry.description.length > 0
    ? ` — ${entry.description}`
    : '';
  fragments.push(`    /* ── src/${entry.file}${description} ── */\n${body}`);
}

const output = `/**
 * dsh-fold-minimal — browser half.
 *
 * GENERATED FILE — edit src/*.js and run \`npm run build\`.
 * The shipped artifact is still one zero-dependency client.js.
 */
window.__ModuleLoader__.load({
  id: 'dsh-fold-minimal',
  factory: function (require) {
${fragments.join('\n\n')}
  },
});
`;

if (checkOnly) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (current !== output) {
    fail('client.js is stale; run `npm run build` and commit the generated file');
  }
  console.log(`build-client: client.js is current (${manifest.modules.length} modules)`);
  process.exit(0);
}

fs.writeFileSync(target, output);
console.log(`build-client: wrote client.js (${manifest.modules.length} modules, ${output.length} bytes)`);
