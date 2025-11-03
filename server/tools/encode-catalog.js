#!/usr/bin/env node
/**
 * Encode catalog URLs per-segment to avoid 404s on Cloudflare R2.
 * - Ensures base: https://pub-b8fe695f5b4b490ebe0dc151042193e2.r2.dev/cueai-media/
 * - Extracts path starting at (music|sfx|ambience)/...
 * - Percent-encodes each segment with encodeURIComponent
 * - Writes back to server/soundCatalog.json preserving other fields
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const catalogPath = path.join(__dirname, '..', 'soundCatalog.json');
const BASE = 'https://pub-b8fe695f5b4b490ebe0dc151042193e2.r2.dev';
const PREFIX = `${BASE}/cueai-media`;

function fullyDecode(seg) {
  let prev = seg;
  for (let i = 0; i < 5; i++) { // prevent infinite loop
    try {
      const dec = decodeURIComponent(prev);
      if (dec === prev) break;
      prev = dec;
    } catch (_) {
      break;
    }
  }
  return prev;
}

function encodePath(p) {
  // Split into segments, decode fully then encode each to avoid double-encoding
  return p.split('/').map(seg => encodeURIComponent(fullyDecode(seg))).join('/');
}

function normalizeSrc(src) {
  if (!src || typeof src !== 'string') return src;
  let pathname = '';
  try {
    // If absolute URL, use URL API to get pathname
    if (/^https?:\/\//i.test(src)) {
      const u = new URL(src);
      pathname = u.pathname; // starts with '/'
    } else {
      // Treat as path
      pathname = src;
    }
  } catch (_) {
    pathname = src;
  }

  // Find path starting at (music|sfx|ambience)/...
  const m = pathname.match(/\/(?:cueai-media\/)?(music|sfx|ambience)\/(.+)$/i);
  if (!m) {
    // Try to find /media/... as fallback
  const m2 = pathname.match(/\/(?:media\/)?(music|sfx|ambience)\/(.+)$/i);
    if (!m2) {
      return `${PREFIX}/${encodePath(pathname.replace(/^\//,''))}`;
    }
    const p2 = `${m2[1]}/${m2[2]}`;
    return `${PREFIX}/${encodePath(p2)}`;
  }

  const p = `${m[1]}/${m[2]}`;
  return `${PREFIX}/${encodePath(p)}`;
}

function main() {
  const raw = fs.readFileSync(catalogPath, 'utf-8');
  const catalog = JSON.parse(raw);
  let changed = 0;
  for (const item of catalog) {
    const oldSrc = item.src;
    const newSrc = normalizeSrc(oldSrc);
    if (newSrc && newSrc !== oldSrc) {
      item.src = newSrc;
      changed++;
    }
  }
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf-8');
  console.log(`Updated ${changed} entries. Saved to ${catalogPath}`);
}

main();
