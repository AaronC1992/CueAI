import fs from 'fs';
import path from 'path';
import { getStatus } from '../../../lib/modules/elevenlabs-generation-manager.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sound Audit' };

function loadCatalog() {
  const catalogPath = path.join(process.cwd(), 'public', 'saved-sounds.json');
  const data = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  return Array.isArray(data.files) ? data.files : [];
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item) || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function fmtTime(ms) {
  if (!ms) return 'n/a';
  return new Date(ms).toLocaleString();
}

function AiSoundStatusSection() {
  // Reads the manager's in-process cached status only — never forces a
  // fresh ElevenLabs credit check just because someone opened this page.
  const status = getStatus();
  const rows = [
    ['ElevenLabs', status.connected ? 'Connected' : 'Unavailable (no API key)'],
    ['AI Sound Generation', status.enabled ? 'Enabled' : 'Disabled'],
    ['Credit Status', status.credit.label],
    ['Last Credit Check', fmtTime(status.credit.checkedAt)],
    ['Next Scheduled Check', fmtTime(status.circuitBreaker.nextRecheckAt)],
    ['Circuit Breaker', status.circuitBreaker.open ? 'Open' : 'Closed'],
    ['Generated This Session', status.metrics.generatedThisSession],
    ['Generation Queue', status.metrics.generationQueueLength],
    ['Cache Hits', status.metrics.cacheHitsReported],
    ['AI Generations Avoided', status.metrics.aiGenerationsAvoided],
  ];

  return (
    <section style={{ border: '1px solid #273143', borderRadius: 8, padding: 16, background: '#111722', marginBottom: 24 }}>
      <h2 style={{ marginTop: 0 }}>AI Sound Generation (ElevenLabs Fallback)</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ border: '1px solid #273143', borderRadius: 6, padding: 10 }}>
            <div style={{ color: '#aeb7c4', fontSize: 12 }}>{label}</div>
            <strong style={{ fontSize: 16 }}>{String(value)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}


export default function SoundAuditPage() {
  const files = loadCatalog();
  const byType = countBy(files, (item) => item.type);
  const oldPrefix = files.filter((item) => String(item.file || '').startsWith('Saved sounds/'));
  const shortKeywords = files.filter((item) => (item.keywords || []).length < 5);
  const recent = files.slice(-40).reverse();
  const topKeywords = [...files.reduce((map, item) => {
    for (const keyword of item.keywords || []) map.set(keyword, (map.get(keyword) || 0) + 1);
    return map;
  }, new Map())].sort((a, b) => b[1] - a[1]).slice(0, 24);

  return (
    <main style={{ minHeight: '100vh', background: '#0b0d12', color: '#f4f7fb', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 34 }}>Sound Audit</h1>
        <p style={{ margin: '0 0 24px', color: '#aeb7c4' }}>Catalog health, recent library growth, and metadata coverage.</p>

        <AiSoundStatusSection />

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            ['Total', files.length],
            ['Music', byType.music || 0],
            ['SFX', byType.sfx || 0],
            ['Ambience', byType.ambience || 0],
            ['Old Prefix', oldPrefix.length],
            ['Short Tags', shortKeywords.length],
          ].map(([label, value]) => (
            <div key={label} style={{ border: '1px solid #273143', borderRadius: 8, padding: 14, background: '#111722' }}>
              <div style={{ color: '#aeb7c4', fontSize: 13 }}>{label}</div>
              <strong style={{ fontSize: 28 }}>{value}</strong>
            </div>
          ))}
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div style={{ border: '1px solid #273143', borderRadius: 8, padding: 16, background: '#111722' }}>
            <h2 style={{ marginTop: 0 }}>Recent Sounds</h2>
            <ul style={{ paddingLeft: 18, lineHeight: 1.7 }}>
              {recent.map((item) => <li key={item.file}>{item.name} <span style={{ color: '#7dd3fc' }}>{item.type}</span></li>)}
            </ul>
          </div>
          <div style={{ border: '1px solid #273143', borderRadius: 8, padding: 16, background: '#111722' }}>
            <h2 style={{ marginTop: 0 }}>Top Tags</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {topKeywords.map(([keyword, count]) => (
                <span key={keyword} style={{ border: '1px solid #273143', borderRadius: 999, padding: '6px 10px', color: '#d7f8ff' }}>
                  {keyword} {count}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
