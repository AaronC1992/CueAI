/**
 * Measures instant-keyword preload coverage against real R2 file sizes:
 * how many trigger keywords the startup preload actually warms, and what it costs.
 *
 * Usage: node scripts/measure-audio-coverage.mjs
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { buildTriggerMap, rankInstantPreloadFiles, PRELOAD_PRIORITY_CATEGORIES } from '../lib/modules/trigger-system.js';
import { normalizeAudioUrl, joinAudioUrlBase } from '../lib/modules/audio-url.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

// Mirrors getInstantPreloadBudget() in engine/SuiteRhythm.js.
const MAX_FILE_BYTES = 512 * 1024;
const BYTE_BUDGET = 4 * 1024 * 1024;

const R2_BASE = String(
  process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_CDN_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '',
).trim().replace(/\/+$/, '');

const savedSounds = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'saved-sounds.json'), 'utf8'));
const triggerMap = buildTriggerMap(savedSounds);
const totalKeywords = Object.keys(triggerMap).length;
const ranked = rankInstantPreloadFiles(triggerMap);

console.log('=== TRIGGER MAP ===');
console.log(`keywords:            ${totalKeywords}`);
console.log(`distinct files:      ${ranked.length}`);

if (!R2_BASE) {
  console.log('\nNo R2 base URL configured; skipping size probe.');
  process.exit(0);
}

async function head(file) {
  const url = joinAudioUrlBase(R2_BASE, normalizeAudioUrl(file));
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return {
      file,
      ok: res.ok,
      status: res.status,
      bytes: Number(res.headers.get('content-length') || 0),
      cacheControl: res.headers.get('cache-control') || '',
    };
  } catch (err) {
    return { file, ok: false, status: 0, bytes: 0, cacheControl: '', error: err.message };
  }
}

const files = ranked.map((r) => r.file);
const results = [];
const CONCURRENCY = 12;
for (let i = 0; i < files.length; i += CONCURRENCY) {
  results.push(...(await Promise.all(files.slice(i, i + CONCURRENCY).map(head))));
}

const okResults = results.filter((r) => r.ok);
const missing = results.filter((r) => !r.ok);
const bytesByFile = new Map(okResults.map((r) => [r.file, r.bytes]));
const totalBytes = okResults.reduce((sum, r) => sum + r.bytes, 0);
const noImmutable = okResults.filter((r) => !/immutable/.test(r.cacheControl));
const mb = (b) => (b / 1024 / 1024).toFixed(2);

console.log(`\n=== SIZE PROBE (${R2_BASE}) ===`);
console.log(`reachable:           ${okResults.length}/${results.length}`);
console.log(`missing / errored:   ${missing.length}`);
console.log(`whole library:       ${mb(totalBytes)} MB`);
console.log(`mean file size:      ${okResults.length ? mb(totalBytes / okResults.length) : 0} MB`);
console.log(`missing immutable:   ${noImmutable.length} files`);

if (missing.length) {
  console.log('\n--- unreachable files ---');
  for (const r of missing.slice(0, 40)) console.log(`  ${r.status || r.error}  ${r.file}`);
}

// Legacy ordering: category priority only, first 30 files.
const categoryRank = (category) => {
  const i = PRELOAD_PRIORITY_CATEGORIES.indexOf(category || '');
  return i === -1 ? 99 : i;
};
const legacy = [...ranked]
  .sort((a, b) => categoryRank(a.category) - categoryRank(b.category))
  .slice(0, 30);

function simulate(entries, { maxFileBytes = Infinity, byteBudget = Infinity, cap = Infinity } = {}) {
  let bytes = 0;
  let keywords = 0;
  const picked = [];
  for (const entry of entries) {
    if (picked.length >= cap) break;
    const size = bytesByFile.get(entry.file) || 0;
    if (size > maxFileBytes) continue;
    if (bytes + size > byteBudget) continue;
    bytes += size;
    keywords += entry.keywordCount;
    picked.push(entry);
  }
  return { files: picked.length, keywords, bytes, picked, pct: ((keywords / totalKeywords) * 100).toFixed(1) };
}

const before = simulate(legacy);
const after = simulate(ranked, { maxFileBytes: MAX_FILE_BYTES, byteBudget: BYTE_BUDGET, cap: 120 });

console.log('\n=== PRELOAD COVERAGE ===');
const row = (label, s) =>
  console.log(`${label.padEnd(24)} files=${String(s.files).padStart(3)}  keywords=${String(s.keywords).padStart(3)} (${s.pct}%)  ${mb(s.bytes)} MB`);
row('legacy (category, 30)', before);
row('current (impact + budget)', after);

const catCount = (s) => {
  const m = new Map();
  for (const e of s.picked) m.set(e.category || 'uncategorized', (m.get(e.category || 'uncategorized') || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}:${n}`).join(' ');
};
console.log(`\nlegacy categories:   ${catCount(before)}`);
console.log(`current categories:  ${catCount(after)}`);

console.log('\n=== LARGEST TRIGGER FILES (above the size cap) ===');
for (const r of [...okResults].sort((a, b) => b.bytes - a.bytes).slice(0, 8)) {
  console.log(`  ${mb(r.bytes).padStart(6)} MB  ${r.file}`);
}
