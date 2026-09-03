/**
 * ===== GENERATED SOUND CACHE/STORE (server-side only) =====
 *
 * Persists ElevenLabs-generated sounds so the same missing cue is never
 * regenerated. Backed by a Supabase `generated_sounds` table + Cloudflare R2
 * for the audio bytes, reusing the exact clients the rest of the app already
 * uses (lib/supabase.js, lib/r2.js) — no new storage system.
 *
 * If the `generated_sounds` table hasn't been created yet (see the SQL at
 * the bottom of this file), lookups/writes fall back to an in-memory Map so
 * the feature still works — just without persistence across server restarts.
 * This degrade-gracefully behavior is intentional: a missing table must
 * never break normal sound playback.
 *
 * Fuzzy lookups reuse the same tfidfMatch scoring already used for the main
 * sound library, so "similar cue already generated" doesn't need a second
 * matching implementation.
 *
 * A generated sound is promoted into the shared `sounds` catalog automatically
 * once it has been reused AI_SOUND_AUTO_PROMOTE_HITS times, so only cues that
 * prove useful become permanent library entries.
 */

import crypto from 'crypto';
import { supabaseAdmin } from './supabase.js';
import { uploadFile, IMMUTABLE_CACHE_CONTROL } from './r2.js';
import { tfidfMatch } from './modules/trigger-system.js';

const TABLE = 'generated_sounds';
const memoryStore = new Map(); // normalizedCue -> record

// A generated sound joins the shared `sounds` catalog once it has proven itself
// by being reused this many times, so one-off oddities never pollute the library.
const AUTO_PROMOTE_HITS = Math.max(2, Number(process.env.AI_SOUND_AUTO_PROMOTE_HITS) || 3);

function slugify(text) {
  return String(text || 'sound')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'sound';
}

function toRow(record) {
  return {
    normalized_cue: record.normalizedCue,
    original_cue: record.originalCue,
    generation_prompt: record.generationPrompt,
    file: record.file,
    duration: record.duration,
    type: record.type,
    tags: record.tags || [],
    source: record.source || 'elevenlabs-generated',
    generation_model: record.generationModel || null,
    generation_settings: record.generationSettings || null,
    use_count: record.useCount ?? 1,
    promoted_at: record.promotedAt || null,
    created_at: record.createdAt,
    last_used_at: record.lastUsedAt,
  };
}

function fromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    normalizedCue: row.normalized_cue,
    originalCue: row.original_cue,
    generationPrompt: row.generation_prompt,
    file: row.file,
    duration: row.duration,
    type: row.type,
    tags: row.tags || [],
    source: row.source || 'elevenlabs-generated',
    generationModel: row.generation_model,
    generationSettings: row.generation_settings,
    useCount: row.use_count ?? 1,
    promotedAt: row.promoted_at || null,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

/**
 * Look up an existing generated sound for a cue: exact normalized match
 * first, then a fuzzy tfidf pass over the same type's recent generations.
 */
export async function findCachedGeneratedSound(cue, type, normalizedCue) {
  const exactMemory = memoryStore.get(normalizedCue);
  if (exactMemory && exactMemory.type === type) return touchLastUsed(exactMemory);

  let rows = null;
  try {
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select('*')
      .eq('type', type)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    rows = data || [];
  } catch (err) {
    // Table missing / Supabase unreachable — fall back to the in-memory set.
    rows = null;
  }

  if (rows) {
    const exact = rows.find((r) => r.normalized_cue === normalizedCue);
    if (exact) return touchLastUsed(fromRow(exact));

    const asFiles = rows.map((r) => ({ type: r.type, name: r.original_cue, keywords: r.tags || [], file: r.id }));
    const match = tfidfMatch(cue, type, asFiles);
    if (match) {
      const row = rows.find((r) => r.id === match.file);
      if (row) return touchLastUsed(fromRow(row));
    }
    return null;
  }

  // In-memory fallback fuzzy pass
  const candidates = Array.from(memoryStore.values()).filter((r) => r.type === type);
  const asFiles = candidates.map((r) => ({ type: r.type, name: r.originalCue, keywords: r.tags || [], file: r.normalizedCue }));
  const match = tfidfMatch(cue, type, asFiles);
  if (match) {
    const record = candidates.find((r) => r.normalizedCue === match.file);
    if (record) return touchLastUsed(record);
  }
  return null;
}

function touchLastUsed(record) {
  if (!record) return null;
  const lastUsedAt = new Date().toISOString();
  record.lastUsedAt = lastUsedAt;
  record.useCount = (record.useCount ?? 1) + 1;
  memoryStore.set(record.normalizedCue, record);
  if (record.id) {
    supabaseAdmin
      .from(TABLE)
      .update({ last_used_at: lastUsedAt, use_count: record.useCount })
      .eq('id', record.id)
      .then(() => {}, () => {});

    if (!record.promotedAt && record.useCount >= AUTO_PROMOTE_HITS) {
      // Fire and forget: a promotion failure must never block playback.
      record.promotedAt = new Date().toISOString();
      promoteGeneratedSound(record.id).then(
        (res) => console.info(`[AI Sound] Auto-promoted to library: "${res.name}"`),
        (err) => {
          record.promotedAt = null;
          console.warn('[AI Sound] Auto-promotion failed:', err?.message || err);
        }
      );
    }
  }
  return record;
}

/**
 * Upload generated audio to R2 and persist its metadata. Always writes to
 * the in-memory cache (fast path, survives a misconfigured Supabase) and
 * best-effort writes to Supabase for durability across restarts.
 */
export async function saveGeneratedSound({ originalCue, normalizedCue, generationPrompt, audio, duration, type, tags = [], generationModel, generationSettings }) {
  const hash = crypto.createHash('sha1').update(normalizedCue).digest('hex').slice(0, 8);
  const key = `sounds/generated/${type}/${slugify(originalCue)}-${hash}.mp3`;

  await uploadFile(key, audio, 'audio/mpeg', IMMUTABLE_CACHE_CONTROL);

  const nowIso = new Date().toISOString();
  const record = {
    id: null,
    normalizedCue,
    originalCue,
    generationPrompt,
    file: key,
    duration,
    type,
    tags,
    source: 'elevenlabs-generated',
    generationModel,
    generationSettings,
    useCount: 1,
    promotedAt: null,
    createdAt: nowIso,
    lastUsedAt: nowIso,
  };

  try {
    const { data, error } = await supabaseAdmin.from(TABLE).insert(toRow(record)).select('id').single();
    if (error) throw error;
    record.id = data?.id ?? null;
  } catch (err) {
    console.warn('[AI Sound] Could not persist generated_sounds row (using in-memory cache only):', err?.message || err);
  }

  memoryStore.set(normalizedCue, record);
  if (memoryStore.size > 500) {
    const oldestKey = memoryStore.keys().next().value;
    memoryStore.delete(oldestKey);
  }
  return record;
}

/** Promote a generated sound into the permanent `sounds` catalog table. */
export async function promoteGeneratedSound(id) {
  const { data: row, error } = await supabaseAdmin.from(TABLE).select('*').eq('id', id).single();
  if (error || !row) throw new Error('Generated sound not found');

  const record = fromRow(row);
  const name = record.originalCue
    .split(' ')
    .filter(Boolean)
    .slice(0, 8)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');

  const { data: existing } = await supabaseAdmin
    .from('sounds')
    .select('id')
    .eq('file', record.file)
    .maybeSingle();

  if (!existing) {
    const { error: insertError } = await supabaseAdmin.from('sounds').insert({
      type: record.type === 'ambience' ? 'ambience' : 'sfx',
      name,
      file: record.file,
      keywords: record.tags,
      loop: record.type === 'ambience',
    });
    if (insertError) throw insertError;
  }

  await supabaseAdmin
    .from(TABLE)
    .update({ promoted_at: new Date().toISOString() })
    .eq('id', id)
    .then(() => {}, () => {});

  return { name, file: record.file, alreadyInLibrary: !!existing };
}

export function resetGeneratedSoundStoreForTests() {
  memoryStore.clear();
}

/*
 * SQL to run once in the Supabase SQL editor to persist generated sounds
 * across restarts (optional — the feature degrades to an in-memory cache
 * without this table):
 *
 * create table if not exists generated_sounds (
 *   id uuid primary key default gen_random_uuid(),
 *   normalized_cue text not null,
 *   original_cue text not null,
 *   generation_prompt text not null,
 *   file text not null,
 *   duration numeric,
 *   type text not null default 'sfx',
 *   tags text[] default '{}',
 *   source text not null default 'elevenlabs-generated',
 *   generation_model text,
 *   generation_settings jsonb,
 *   use_count integer not null default 1,
 *   promoted_at timestamptz,
 *   created_at timestamptz not null default now(),
 *   last_used_at timestamptz
 * );
 * create index if not exists generated_sounds_type_idx on generated_sounds (type, created_at desc);
 * create index if not exists generated_sounds_normalized_cue_idx on generated_sounds (normalized_cue);
 *
 * If the table already exists from an earlier deploy, add the auto-promotion columns:
 *
 * alter table generated_sounds add column if not exists use_count integer not null default 1;
 * alter table generated_sounds add column if not exists promoted_at timestamptz;
 */
