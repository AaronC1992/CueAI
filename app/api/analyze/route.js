/**
 * POST /api/analyze
 * Analyzes a story transcript via OpenAI and returns a sound decision.
 * The API key lives server-side only — never exposed to the browser.
 * Protected by HMAC token auth via requireAuth().
 */

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import crypto from 'crypto';
import { MODE_CONTEXTS, MODE_RULES } from '../../../lib/modules/ai-director.js';
import { requireAuth } from '../../../lib/api-auth.js';
import { classifyLocal } from '../../../lib/modules/local-classifier.js';
import { buildCatalogSummary, SFX_EVENT_EVIDENCE } from '../../../lib/server-catalog.js';
import { addTimingHeaders, logApiMetric } from '../../../lib/server-observability.js';
import { checkRateLimit, rateLimitHeaders } from '../../../lib/rate-limit.js';

// Confidence floor below which a reported "missingSound" is discarded rather
// than handed to the (paid) ElevenLabs generation fallback. Single source of
// truth — nothing else in the codebase should hardcode this threshold.
const SOUND_MATCH_THRESHOLD = Number(process.env.SOUND_MATCH_THRESHOLD ?? 0.55);

let _openai;
function getOpenAI() {
  return (_openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
}

// --- Response cache (hash-based dedup for identical transcripts) ---
const CACHE_TTL_MS = 30_000; // 30 seconds
const MAX_CACHE_SIZE = 500;
const responseCache = new Map(); // hash -> { data, expiresAt }

function getCacheKey(transcript, mode, context) {
  const raw = JSON.stringify({ transcript: transcript.trim().toLowerCase(), mode, context });
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

function getCache(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  // Evict oldest entries if over limit
  if (responseCache.size >= MAX_CACHE_SIZE) {
    const firstKey = responseCache.keys().next().value;
    responseCache.delete(firstKey);
  }
  responseCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

const SYSTEM_PROMPT = `You are SuiteRhythm, an AI sound director for live narration sessions.
Given a transcript and a list of available sounds, respond with a JSON object that drives a layered audio engine.

RESPONSE FORMAT (strict JSON):
{
  "scene": "short description of the current scene/setting",
  "mood": {
    "primary": "one of: calm, tense, happy, sad, angry, fearful, mysterious, excited, ominous, neutral",
    "intensity": 0.0 to 1.0
  },
  "confidence": 0.0 to 1.0,
  "missingSound": "a short (under 12 words) description of a sound the scene clearly calls for that has NO match in the AVAILABLE lists, or null",
  "worldState": {
    "location": "short location tag if detected, else null",
    "weather": "clear|rain|storm|snow|fog|wind|null",
    "timeOfDay": "dawn|day|dusk|night|null"
  },
  "music": {
    "id": "exact name from AVAILABLE MUSIC list, or null",
    "action": "play_or_continue",
    "volume": 0.0 to 1.0
  },
  "sfx": [
    {
      "id": "exact name from AVAILABLE SFX list",
      "intent": "event | state | continuing",
      "when": "immediate",
      "volume": 0.0 to 1.0,
      "tags": ["keyword1", "keyword2"],
      "confidence": 0.0 to 1.0
    }
  ]
}

CRITICAL RULES:
- You MUST pick sounds from the AVAILABLE lists below. Use the EXACT name as the "id". Do NOT invent sound names.
- "scene" drives ambient bed selection only when the transcript clearly establishes a setting. Use descriptive keywords only when evidenced: forest, cave, tavern, cottage, castle, ocean, rain, battle, etc.
- "worldState.weather" MUST track the CURRENT weather only, not history. If the transcript says the rain/storm stopped, cleared, ended, or the character moved indoors and it's no longer mentioned as audible, set weather to "clear" immediately — do not keep reporting "storm"/"rain" just because it was mentioned earlier in the scene history.
- Do not repeat past-tense/historical weather or setting words in "scene" once they're no longer current (e.g. don't keep writing "storm" in the scene description after the story says the storm cleared).
- "mood.primary" + "mood.intensity" drive the emotional arc. Be consistent — don't flip moods every response.
- "confidence" reflects how certain you are. Set 0.3-0.5 when transcript is ambiguous.
- "music" — only change when scene/mood shifts significantly. Use null if current music should keep playing. Pick music that matches the mood and setting.
- "sfx" — max 2 per response. Only include sounds CLEARLY described or implied in the transcript. Never hallucinate sounds not mentioned.
- "missingSound" — only set this when a real, current sound event is clearly happening (not past tense, not figurative) and nothing in the AVAILABLE SFX/MUSIC lists is even a loose match. Describe ONE sound only, focused on the physical event (e.g. "large wolf claws scratching heavy wooden door"), never a full sentence, never character names or dialogue. Leave it null far more often than not — most scenes are covered by the AVAILABLE lists or don't need a new sound at all.

VERB TENSE & INTENT (important for not repeating one-shot sounds):
- "intent": "event"      — a NEW discrete action happening now ("a door slams", "the train passes"). Play once.
- "intent": "state"      — an ongoing condition ("it is raining", "fire crackles"). Engine will loop it.
- "intent": "continuing" — already established ambience that should keep going. Rarely needed; prefer omitting sfx entirely.
- If a transcript is PAST TENSE describing something that already finished ("the train passed", "the door had slammed"), DO NOT include an sfx for it. Those are narration of past events, not current events.
- If a sound id appears in "activeSfx" (currently playing) or "consumedEvents" (already fired recently), DO NOT pick it again. Choose silence, a related-but-different sound, or an ambient bed instead.
- If a sound id appears in "recentSounds" (played in the last few turns), only pick it again if the transcript clearly describes a NEW instance of that event.

OTHER RULES:
- Prioritize accuracy over atmosphere. Do not add ambience just because the line is quiet or neutral.
- Treat the current Transcript/newSpeech as stronger evidence than scene history for new sound choices.
- If the transcript describes indoor/object actions without an explicit outdoor setting, never infer forest, birds, wind, footsteps, tavern, cave, or weather ambience.
- If the AVAILABLE lists only contain weak or nearby matches, prefer null music and an empty sfx array over choosing the closest unrelated sound.
- Never include sounds that contradict the scene (no crowd noise in a lonely forest, no birds in a dungeon).
- If no SFX are warranted, return an empty array. Silence is better than wrong sounds.
- When "sceneStabilityMs" is low (< 10000), be cautious: set sfx confidence 0.5+ only if you are sure, else drop the sfx.
- When "creatorMode" is true (live streamer context), you may be slightly more responsive with SFX, but still never duplicate active or consumed sounds.`;

function buildSystemPrompt(transcript, mode, context) {
  return SYSTEM_PROMPT + buildCatalogSummary({ transcript, mode, context });
}

function buildUserMessage(transcript, mode, context) {
  const modeContext = MODE_CONTEXTS[mode] || MODE_CONTEXTS.auto;
  const modeRule = MODE_RULES[mode] || MODE_RULES.auto;

  const parts = [
    `Transcript: "${transcript.trim()}"`,
    `Mode: ${mode || 'auto'} (${modeContext})`,
    modeRule,
  ];

  if (context) {
    if (context.sceneState) parts.push(`Current scene state: ${context.sceneState}`);
    if (context.sceneMemory) parts.push(`Scene history: ${context.sceneMemory}`);
    if (context.moodHistory) parts.push(`Mood history: ${context.moodHistory}`);
    if (context.recentMusic) parts.push(`Currently playing music: ${context.recentMusic}`);
    if (context.recentSounds?.length) parts.push(`recentSounds (played in last few turns): ${context.recentSounds.join(', ')}`);
    if (context.activeSfx?.length) parts.push(`activeSfx (still playing right now — DO NOT re-pick): ${context.activeSfx.join(', ')}`);
    if (context.consumedEvents?.length) parts.push(`consumedEvents (already fired, do not repeat): ${context.consumedEvents.join(', ')}`);
    if (typeof context.sceneStabilityMs === 'number') parts.push(`sceneStabilityMs: ${context.sceneStabilityMs} (ms since last scene change)`);
    if (context.worldState) {
      const ws = context.worldState;
      const bits = [];
      if (ws.location) bits.push(`location=${ws.location}`);
      if (ws.weather) bits.push(`weather=${ws.weather}`);
      if (ws.timeOfDay) bits.push(`timeOfDay=${ws.timeOfDay}`);
      if (bits.length) parts.push(`worldState: ${bits.join(', ')}`);
    }
    if (context.creatorMode) parts.push(`creatorMode: true (live streamer — slightly more responsive is ok)`);
    if (context.newSpeech) parts.push(`newSpeechSinceLastTurn: "${context.newSpeech}"`);
    // Sing mode extras
    if (context.singState) parts.push(`singState: ${context.singState}`);
    if (typeof context.detectedBPM === 'number' && context.detectedBPM > 0) parts.push(`detectedBPM: ${context.detectedBPM}`);
    if (typeof context.vocalEnergy === 'number') parts.push(`vocalEnergy: ${context.vocalEnergy} (0=silent, 0.15+=belting)`);
    if (context.storyTitle) parts.push(`Story: ${context.storyTitle}`);
    if (context.sessionContext) parts.push(`Session context: ${context.sessionContext}`);
  }

  return parts.join('\n');
}

export function buildFallbackDecision(local, error) {
  return {
    scene: local.scene,
    mood: local.mood,
    confidence: Math.min(local.confidence, 0.35),
    worldState: local.worldState,
    music: { id: null, action: 'play_or_continue', volume: 0.5 },
    // A failed AI call is not enough evidence for automatic SFX. The
    // client still has its direct, precision-gated keyword path available.
    sfx: [],
    missingSound: null,
    _fallback: true,
    _reason: error?.status === 429 ? 'openai_rate_limit' : 'openai_error',
    _source: 'local-classifier',
  };
}

/**
 * Guards against a hallucinated/low-confidence "missingSound" ever reaching
 * the (paid) ElevenLabs generation fallback: it must be a plausible short
 * phrase, the transcript must contain real sound/action evidence, and the
 * model's own confidence must clear SOUND_MATCH_THRESHOLD.
 */
export function sanitizeMissingSound(value, transcript, confidence) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 140 || trimmed.split(/\s+/).length > 14) return null;
  if (typeof confidence === 'number' && confidence < SOUND_MATCH_THRESHOLD) return null;
  if (!SFX_EVENT_EVIDENCE.test(String(transcript || ''))) return null;
  return trimmed;
}

export async function POST(request) {
  const startedAt = Date.now();
  // Auth check — reject unauthenticated requests before doing any work
  const denied = requireAuth(request);
  if (denied) return denied;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI not configured' }, { status: 503 });
  }

  const rate = checkRateLimit(request, {
    namespace: 'analyze',
    limit: 15,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again shortly.' },
      {
        status: 429,
        headers: rateLimitHeaders(rate),
      }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { transcript, mode, context } = body;
  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    return NextResponse.json({ error: 'transcript is required' }, { status: 400 });
  }
  if (transcript.length > 3000) {
    return NextResponse.json({ error: 'transcript exceeds maximum length' }, { status: 400 });
  }

  // Check response cache for identical recent requests
  const cacheKey = getCacheKey(transcript, mode, context);
  const cached = getCache(cacheKey);
  if (cached) {
    const res = NextResponse.json(cached);
    res.headers.set('X-RateLimit-Remaining', String(rate.remaining));
    res.headers.set('X-Cache', 'HIT');
    logApiMetric('/api/analyze', startedAt, { status: 200, cache: 'HIT', mode, transcriptChars: transcript.length });
    return addTimingHeaders(res, 'analyze', startedAt);
  }

  const userMessage = buildUserMessage(transcript, mode, context);

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1',
      max_tokens: 400,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemPrompt(transcript, mode, context) },
        { role: 'user', content: userMessage },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error('Empty response from OpenAI');
    const data = JSON.parse(raw);
    data.missingSound = sanitizeMissingSound(data.missingSound, transcript, data.confidence);

    // Cache the response for dedup
    setCache(cacheKey, data);

    const res = NextResponse.json(data);
    res.headers.set('X-RateLimit-Remaining', String(rate.remaining));
    res.headers.set('X-Cache', 'MISS');
    logApiMetric('/api/analyze', startedAt, { status: 200, cache: 'MISS', mode, transcriptChars: transcript.length, sfxCount: data?.sfx?.length || 0 });
    return addTimingHeaders(res, 'analyze', startedAt);
  } catch (err) {
    console.error('[/api/analyze]', err);
    // Graceful degrade: instead of a hard 500, return a minimal
    // "keep current" JSON so the client-side rule-based fallback
    // has a clean decision to merge with (no hallucinated SFX).
    const local = classifyLocal(transcript, { mode });
    const fallback = buildFallbackDecision(local, err);
    const status = err?.status === 429 ? 429 : 200; // 200 lets client merge with ruleBased
    const res = NextResponse.json(fallback, { status });
    res.headers.set('X-RateLimit-Remaining', String(rate.remaining));
    res.headers.set('X-Fallback', fallback._reason);
    logApiMetric('/api/analyze', startedAt, { status, fallback: fallback._reason, mode, transcriptChars: transcript.length });
    return addTimingHeaders(res, 'analyze', startedAt);
  }
}
