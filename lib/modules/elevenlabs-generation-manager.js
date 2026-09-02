/**
 * ===== ELEVENLABS GENERATION MANAGER (server-side only) =====
 *
 * Centralized authority for the "AI sound generation fallback" feature.
 * Nothing else in the app should talk to ElevenLabs' sound-generation or
 * subscription endpoints directly — everything goes through here so credit
 * checks, the circuit breaker, cooldowns, and concurrency stay in one place.
 *
 * Responsibilities:
 *   - cached credit/quota status (GET /v1/user/subscription, rarely polled)
 *   - circuit breaker that opens the moment quota looks depleted
 *   - per-cue cooldown + in-flight request de-duplication
 *   - a small concurrency limiter around the actual generation call
 *   - turning a short "missing sound" description into an ElevenLabs prompt
 *
 * This module never imports Supabase/R2 — it only knows how to talk to
 * ElevenLabs. Caching/persisting the resulting audio is the caller's job
 * (see lib/generated-sound-store.js), keeping this file trivially testable.
 *
 * NEVER import this file from client components. ELEVENLABS_API_KEY is only
 * read via process.env here and the raw key is never included in any
 * returned value.
 */

const SUBSCRIPTION_URL = 'https://api.elevenlabs.io/v1/user/subscription';
const GENERATION_URL = 'https://api.elevenlabs.io/v1/sound-generation';

const SFX_PROMPT_SUFFIX = ', close perspective, realistic cinematic foley, single distinct sound effect, no music, no dialogue, no voice';
const AMBIENCE_PROMPT_SUFFIX = ', seamless ambient loop, atmospheric background texture, no music, no dialogue, no sudden one-shot events';

const BAD_ACCOUNT_STATUSES = new Set(['past_due', 'incomplete', 'free_disabled']);
const QUOTA_ERROR_RE = /quota|insufficient[^a-z]*credit|credit[^a-z]*limit|exceed(?:ed|s)?[^a-z]*limit|out of credits|billing limit|payment required/i;

function envInt(name, fallback) {
  const raw = process.env[name];
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function envFlag(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return String(raw).toLowerCase() !== 'false';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function nowMs() {
  return Date.now();
}

// ── Module-level state (per server process — intentional, see file header) ──
let creditStatus = {
  available: true,
  remainingCredits: null,
  depleted: false,
  checkedAt: 0,
  reason: 'not_checked',
  nextResetAt: null,
};
let circuitBreaker = { open: false, openedAt: 0 };
const pendingByCue = new Map(); // normalizedCue -> Promise
const recentCueTimestamps = new Map(); // normalizedCue -> last generation attempt time
const metrics = { generatedThisSession: 0, cacheHitsReported: 0, avoided: 0 };
let activeGenerations = 0;
const generationWaitQueue = [];

/** Reset all in-memory state. Test-only helper. */
export function resetElevenLabsManagerForTests() {
  creditStatus = { available: true, remainingCredits: null, depleted: false, checkedAt: 0, reason: 'not_checked', nextResetAt: null };
  circuitBreaker = { open: false, openedAt: 0 };
  pendingByCue.clear();
  recentCueTimestamps.clear();
  metrics.generatedThisSession = 0;
  metrics.cacheHitsReported = 0;
  metrics.avoided = 0;
  activeGenerations = 0;
  generationWaitQueue.length = 0;
}

export function isAiSoundFallbackEnabled() {
  return envFlag('AI_SOUND_FALLBACK_ENABLED', true);
}

export function normalizeCue(cue) {
  return String(cue || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build a concise, ElevenLabs-friendly generation prompt + settings from a
 * short "missing sound" description. Keeps the prompt focused on one sound
 * and clamps duration so credits aren't wasted on unnecessarily long clips.
 */
export function buildGenerationPrompt(cue, type = 'sfx') {
  const maxLen = envInt('AI_SOUND_MAX_PROMPT_LENGTH', 200);
  const cleaned = String(cue || '')
    .replace(/["'“”‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
  const isAmbience = type === 'ambience';
  const suffix = isAmbience ? AMBIENCE_PROMPT_SUFFIX : SFX_PROMPT_SUFFIX;
  const prompt = `${cleaned}${suffix}`;
  const durationSeconds = isAmbience
    ? clamp(envInt('ELEVENLABS_AMBIENCE_DURATION_SECONDS', 12), 5, 22)
    : clamp(envInt('ELEVENLABS_SFX_DURATION_SECONDS', 3), 1, 5);
  const promptInfluence = isAmbience ? 0.15 : 0.35;
  return { prompt, durationSeconds, promptInfluence };
}

function creditCheckTtlMs() {
  return circuitBreaker.open
    ? envInt('ELEVENLABS_DEPLETED_RECHECK_INTERVAL_MS', 1_800_000)
    : envInt('ELEVENLABS_CREDIT_CHECK_INTERVAL_MS', 300_000);
}

/**
 * Returns the cached credit status, refreshing it from ElevenLabs only when
 * the cache window (or depleted-recheck window) has elapsed. Never throws —
 * network/parse failures degrade to "unavailable" without opening the
 * circuit breaker, so a single flaky request can't fake a permanent outage.
 */
export async function refreshCreditStatus({ force = false } = {}) {
  const now = nowMs();
  if (!force && creditStatus.checkedAt && (now - creditStatus.checkedAt) < creditCheckTtlMs()) {
    return creditStatus;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    creditStatus = { available: false, remainingCredits: null, depleted: false, checkedAt: now, reason: 'missing_api_key', nextResetAt: null };
    return creditStatus;
  }

  try {
    const res = await fetch(SUBSCRIPTION_URL, { headers: { 'xi-api-key': apiKey } });
    if (!res.ok) {
      if (res.status === 401) {
        creditStatus = { available: false, remainingCredits: null, depleted: false, checkedAt: now, reason: 'invalid_api_key', nextResetAt: null };
      } else if (creditStatus.checkedAt === 0) {
        // Never had a good reading — fail safe rather than guessing.
        creditStatus = { available: false, remainingCredits: null, depleted: false, checkedAt: now, reason: 'check_failed', nextResetAt: null };
      } else {
        // Keep the last known-good status; just note the failed refresh.
        creditStatus = { ...creditStatus, reason: 'check_failed' };
      }
      return creditStatus;
    }

    const data = await res.json();
    const hasUsage = Number.isFinite(data?.character_limit) && Number.isFinite(data?.character_count);
    const remaining = hasUsage ? Math.max(0, data.character_limit - data.character_count) : null;
    const reserve = envInt('ELEVENLABS_MINIMUM_CREDIT_RESERVE', 0);
    const badAccountStatus = BAD_ACCOUNT_STATUSES.has(data?.status);
    const lowCredits = remaining !== null && remaining <= reserve;
    const depleted = badAccountStatus || lowCredits;

    creditStatus = {
      available: !depleted,
      remainingCredits: remaining,
      depleted,
      checkedAt: now,
      reason: depleted ? (badAccountStatus ? 'account_status' : 'low_credits') : null,
      nextResetAt: Number.isFinite(data?.next_character_count_reset_unix) ? data.next_character_count_reset_unix * 1000 : null,
    };
    circuitBreaker = depleted
      ? { open: true, openedAt: circuitBreaker.open ? circuitBreaker.openedAt : now }
      : { open: false, openedAt: 0 };
    return creditStatus;
  } catch (err) {
    if (creditStatus.checkedAt === 0) {
      creditStatus = { available: false, remainingCredits: null, depleted: false, checkedAt: now, reason: 'check_failed', nextResetAt: null };
    } else {
      // Transient network failure — keep trusting the last good status.
      creditStatus = { ...creditStatus, reason: 'check_failed' };
    }
    return creditStatus;
  }
}

/** Immediately opens the circuit breaker (e.g. a generation call itself hit a quota error). */
export function markQuotaDepleted(reason = 'quota_exceeded') {
  const now = nowMs();
  circuitBreaker = { open: true, openedAt: now };
  creditStatus = { ...creditStatus, available: false, depleted: true, checkedAt: now, reason };
}

/** Fast synchronous check — does not perform any network I/O. */
export function canGenerate() {
  if (!isAiSoundFallbackEnabled()) return false;
  if (!process.env.ELEVENLABS_API_KEY) return false;
  if (circuitBreaker.open) return false;
  return creditStatus.available !== false;
}

function classifyGenerationError(status, bodyText) {
  if (status === 429) return 'depleted';
  if ((status === 401 || status === 403) && QUOTA_ERROR_RE.test(bodyText || '')) return 'depleted';
  return 'error';
}

async function runWithConcurrencyLimit(fn) {
  const max = Math.max(1, envInt('MAX_CONCURRENT_AI_SOUND_GENERATIONS', 1));
  if (activeGenerations >= max) {
    await new Promise((resolve) => generationWaitQueue.push(resolve));
  }
  activeGenerations += 1;
  try {
    return await fn();
  } finally {
    activeGenerations -= 1;
    const next = generationWaitQueue.shift();
    if (next) next();
  }
}

async function callElevenLabsGeneration({ cue, type, apiKey }) {
  const { prompt, durationSeconds, promptInfluence } = buildGenerationPrompt(cue, type);
  let res;
  try {
    res = await fetch(GENERATION_URL, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: prompt, duration_seconds: durationSeconds, prompt_influence: promptInfluence }),
    });
  } catch (err) {
    return { ok: false, reason: 'error', message: err?.message || 'network error' };
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    const reason = classifyGenerationError(res.status, bodyText);
    if (reason === 'depleted') {
      markQuotaDepleted('quota_exceeded_during_generation');
      console.warn('[AI Sound] ElevenLabs quota depleted — circuit breaker opened');
    }
    return { ok: false, reason, status: res.status };
  }

  const arrayBuffer = await res.arrayBuffer();
  metrics.generatedThisSession += 1;
  return {
    ok: true,
    audio: Buffer.from(arrayBuffer),
    prompt,
    durationSeconds,
    promptInfluence,
    generationModel: 'elevenlabs-sound-generation',
  };
}

/**
 * Generate a sound via ElevenLabs, subject to the feature flag, credit
 * status, circuit breaker, per-cue cooldown, in-flight de-duplication, and a
 * global concurrency limit. Returns a structured result — never throws for
 * expected failure modes (disabled/depleted/cooldown/etc).
 *
 * The in-flight de-dup check happens synchronously (before any await) so
 * two near-simultaneous requests for the same cue can never both slip past
 * it and race the credit check — the second call always finds the first
 * call's promise already registered.
 *
 * @param {{ cue: string, type?: 'sfx'|'ambience' }} params
 */
export async function generateSound({ cue, type = 'sfx' }) {
  if (!isAiSoundFallbackEnabled()) return { ok: false, reason: 'disabled' };

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { ok: false, reason: 'missing_api_key' };

  const normalized = normalizeCue(cue);
  if (!normalized || normalized.length < 3) return { ok: false, reason: 'invalid_cue' };

  const existingPending = pendingByCue.get(normalized);
  if (existingPending) return existingPending;

  const cooldownMs = envInt('ELEVENLABS_GENERATION_COOLDOWN_MS', 10_000);
  const lastAttempt = recentCueTimestamps.get(normalized);
  if (lastAttempt && (nowMs() - lastAttempt) < cooldownMs) {
    metrics.avoided += 1;
    return { ok: false, reason: 'cooldown' };
  }

  const promise = runGeneration(normalized, cue, type, apiKey);
  pendingByCue.set(normalized, promise);
  try {
    return await promise;
  } finally {
    pendingByCue.delete(normalized);
  }
}

async function runGeneration(normalized, cue, type, apiKey) {
  const status = await refreshCreditStatus();
  if (!status.available) {
    metrics.avoided += 1;
    return { ok: false, reason: status.depleted ? 'depleted' : 'unavailable' };
  }

  recentCueTimestamps.set(normalized, nowMs());
  if (recentCueTimestamps.size > 200) {
    const oldestKey = recentCueTimestamps.keys().next().value;
    recentCueTimestamps.delete(oldestKey);
  }

  return runWithConcurrencyLimit(() => callElevenLabsGeneration({ cue, type, apiKey }));
}

/** Normalized status snapshot safe to expose in admin/debug UI. Never includes the API key. */
export function getStatus() {
  const reserve = envInt('ELEVENLABS_MINIMUM_CREDIT_RESERVE', 0);
  let creditLabel = 'unknown';
  if (creditStatus.checkedAt) {
    if (creditStatus.depleted) creditLabel = 'depleted';
    else if (creditStatus.remainingCredits !== null && creditStatus.remainingCredits <= reserve * 2) creditLabel = 'low';
    else creditLabel = 'available';
  }
  return {
    connected: Boolean(process.env.ELEVENLABS_API_KEY),
    enabled: isAiSoundFallbackEnabled(),
    credit: { ...creditStatus, label: creditLabel },
    circuitBreaker: {
      open: circuitBreaker.open,
      openedAt: circuitBreaker.openedAt || null,
      nextRecheckAt: creditStatus.checkedAt ? creditStatus.checkedAt + creditCheckTtlMs() : null,
    },
    metrics: getMetrics(),
  };
}

export function getMetrics() {
  return {
    generatedThisSession: metrics.generatedThisSession,
    aiGenerationsAvoided: metrics.avoided,
    cacheHitsReported: metrics.cacheHitsReported,
    generationQueueLength: generationWaitQueue.length,
  };
}

/** Called by the API route when a cache/store lookup answers a request without ElevenLabs. */
export function reportCacheHit() {
  metrics.cacheHitsReported += 1;
}
