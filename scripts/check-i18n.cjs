#!/usr/bin/env node
/**
 * i18n completeness check (Wave 14 DS3). Run via `npm run check:i18n` (also part of `npm test`).
 *
 * Fails when
 *   1. a translation module lacks a key in German or English (DE/EN are complete by contract),
 *   2. the `{{placeholders}}` of a key differ between DE and EN,
 *   3. a literal `t('some.key')` in src/ has no German or English text (typo / forgotten translation).
 * Other languages (fr, es, pt, it, nl, pl, ru, ja, zh-Hans) are reported as an informational count only: they fall
 * back to English per key at runtime (see LanguageContext `t()`), so a missing key is a prioritisation question, not
 * an error. Dynamic keys (`t(`a.${x}`)`) are not checked.
 */
/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const transDir = path.join(root, 'src', 'contexts', 'translation');
const OTHER = ['fr', 'es', 'pt', 'it', 'nl', 'pl', 'ru', 'ja', 'zh-Hans'];

const cache = new Map();
function loadModule(file) {
  if (cache.has(file)) return cache.get(file);
  const src = fs.readFileSync(file, 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  cache.set(file, mod.exports);
  const req = (spec) => {
    if (!spec.startsWith('.')) return {};
    const resolved = path.resolve(path.dirname(file), spec);
    return fs.existsSync(`${resolved}.ts`) ? loadModule(`${resolved}.ts`) : {};
  };
  vm.runInNewContext(out, { module: mod, exports: mod.exports, require: req });
  cache.set(file, mod.exports);
  return mod.exports;
}
const load = (file) => loadModule(file).default;

const errors = [];
const merged = { de: {}, en: {} };
const missingOther = Object.fromEntries(OTHER.map((l) => [l, 0]));
let totalKeys = 0;

const placeholders = (s) => [...String(s).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(',');

for (const f of fs.readdirSync(transDir).filter((n) => /Translation\.ts$/.test(n)).sort()) {
  const mod = load(path.join(transDir, f));
  if (!mod || !mod.de || !mod.en) {
    errors.push(`${f}: no default export with de/en`);
    continue;
  }
  const de = Object.keys(mod.de);
  const en = Object.keys(mod.en);
  totalKeys += en.length;
  for (const k of de) if (!(k in mod.en)) errors.push(`${f}: "${k}" missing in en`);
  for (const k of en) if (!(k in mod.de)) errors.push(`${f}: "${k}" missing in de`);
  for (const k of de) {
    if (k in mod.en && placeholders(mod.de[k]) !== placeholders(mod.en[k])) errors.push(`${f}: "${k}" has different {{placeholders}} in de and en`);
  }
  for (const l of OTHER) if (mod[l]) missingOther[l] += en.filter((k) => !(k in mod[l])).length;
  Object.assign(merged.de, mod.de);
  Object.assign(merged.en, mod.en);
}

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(tsx?|ts)$/.test(e.name) && !/\.test\./.test(e.name) && !p.startsWith(transDir)) acc.push(p);
  }
  return acc;
}

const KEY = /\bt\(\s*(['"])([a-z0-9][\w.-]*\.[\w.-]+)\1/g;
for (const file of walk(path.join(root, 'src'), [])) {
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(KEY)) {
    const key = m[2];
    if (!(key in merged.de) || !(key in merged.en)) errors.push(`${path.relative(root, file)}: t('${key}') has no ${key in merged.de ? 'en' : 'de'} text`);
  }
}

console.log(`i18n: ${totalKeys} keys, de/en parity checked.`);
const info = OTHER.filter((l) => missingOther[l] > 0).map((l) => `${l}: ${missingOther[l]}`);
if (info.length) console.log(`i18n: untranslated keys fall back to English (${info.join(', ')}).`);
if (errors.length) {
  console.error(`i18n: ${errors.length} problem(s):\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
