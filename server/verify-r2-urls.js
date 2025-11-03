#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const catalogPath = path.join(__dirname, 'soundCatalog.json');

function head(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD' }, (res) => {
      resolve({ url, status: res.statusCode });
    });
    req.on('error', () => resolve({ url, status: 0 }));
    req.end();
  });
}

async function main() {
  const data = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
  const targets = data.filter(s => typeof s.src === 'string' && s.src.startsWith('https://'));
  console.log(`Checking ${targets.length} URLs...`);
  const missing = [];

  // Limit concurrency
  const concurrency = 16;
  let i = 0;
  async function worker() {
    while (i < targets.length) {
      const idx = i++;
      const u = targets[idx].src;
      const res = await head(encodeURI(u));
      if (res.status !== 200) {
        missing.push({ id: targets[idx].id, type: targets[idx].type, status: res.status, src: u });
        process.stdout.write('x');
      } else {
        process.stdout.write('.');
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  console.log(`\nMissing or non-200: ${missing.length}`);
  if (missing.length) {
    // Group by status
    const byStatus = missing.reduce((acc, m) => {
      acc[m.status] = acc[m.status] || [];
      acc[m.status].push(m);
      return acc;
    }, {});
    for (const [status, list] of Object.entries(byStatus)) {
      console.log(`\nStatus ${status}: ${list.length}`);
      list.slice(0, 50).forEach(m => console.log(`- [${m.type}] ${m.id} -> ${m.src}`));
      if (list.length > 50) console.log(`...and ${list.length - 50} more`);
    }
    // Write full report
    const reportPath = path.join(__dirname, 'r2-missing-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(missing, null, 2));
    console.log(`\nReport saved to ${reportPath}`);
  } else {
    console.log('All URLs returned 200.');
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
