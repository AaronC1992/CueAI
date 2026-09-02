/**
 * POST /api/generate-sound
 *
 * Last-resort ElevenLabs fallback for a sound cue the normal SuiteRhythm
 * library couldn't match. Priority order enforced here:
 *   1. previously generated/cached sound for this (or a very similar) cue
 *   2. a fresh ElevenLabs generation, gated by credits/circuit breaker/cooldown
 *   3. nothing — the client falls back to silence, never to a bad match
 *
 * All ElevenLabs calls, credit checks, and quota handling live in
 * lib/modules/elevenlabs-generation-manager.js — this route only validates
 * the request, checks the generated-sound cache, and wires the two
 * together. Never exposes ELEVENLABS_API_KEY or raw ElevenLabs responses.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/api-auth.js';
import { checkRateLimit, rateLimitHeaders } from '../../../lib/rate-limit.js';
import {
  generateSound,
  normalizeCue,
  reportCacheHit,
} from '../../../lib/modules/elevenlabs-generation-manager.js';
import { findCachedGeneratedSound, saveGeneratedSound } from '../../../lib/generated-sound-store.js';

const MAX_CUE_LENGTH = 140;
const VALID_TYPES = new Set(['sfx', 'ambience']);

export async function POST(request) {
  const denied = requireAuth(request);
  if (denied) return denied;

  const rate = checkRateLimit(request, {
    namespace: 'generate-sound',
    limit: 12,
    windowMs: 5 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, reason: 'rate_limited' },
      { status: 429, headers: rateLimitHeaders(rate) }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_json' }, { status: 400 });
  }

  const cue = typeof body?.cue === 'string' ? body.cue.trim() : '';
  const type = VALID_TYPES.has(body?.type) ? body.type : 'sfx';

  if (!cue || cue.length < 3) {
    return NextResponse.json({ ok: false, reason: 'invalid_cue' }, { status: 400 });
  }
  if (cue.length > MAX_CUE_LENGTH) {
    return NextResponse.json({ ok: false, reason: 'cue_too_long' }, { status: 400 });
  }

  const normalized = normalizeCue(cue);

  // Tier 1: already generated / cached — never call ElevenLabs for this.
  try {
    const cached = await findCachedGeneratedSound(cue, type, normalized);
    if (cached) {
      reportCacheHit();
      console.info(`[AI Sound] Cache hit: "${cue}"`);
      return NextResponse.json(
        { ok: true, file: cached.file, cached: true, id: cached.id },
        { headers: rateLimitHeaders(rate) }
      );
    }
  } catch (err) {
    console.warn('[AI Sound] Cache lookup failed (continuing to generation):', err?.message || err);
  }

  console.info(`[AI Sound] Library miss: "${cue}"`);

  // Tier 2: generate via ElevenLabs, subject to credits/circuit breaker/cooldown.
  const result = await generateSound({ cue, type });
  if (!result.ok) {
    console.info(`[AI Sound] Generation skipped — reason: ${result.reason}`);
    return NextResponse.json(
      { ok: false, reason: result.reason },
      { headers: rateLimitHeaders(rate) }
    );
  }

  try {
    const record = await saveGeneratedSound({
      originalCue: cue,
      normalizedCue: normalized,
      generationPrompt: result.prompt,
      audio: result.audio,
      duration: result.durationSeconds,
      type,
      tags: cue.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
      generationModel: result.generationModel,
      generationSettings: { promptInfluence: result.promptInfluence, durationSeconds: result.durationSeconds },
    });
    console.info(`[AI Sound] Generated + cached: "${cue}" -> ${record.file}`);
    return NextResponse.json(
      { ok: true, file: record.file, cached: false, id: record.id },
      { headers: rateLimitHeaders(rate) }
    );
  } catch (err) {
    console.error('[AI Sound] Failed to persist generated sound:', err?.message || err);
    return NextResponse.json({ ok: false, reason: 'storage_error' }, { headers: rateLimitHeaders(rate) });
  }
}
