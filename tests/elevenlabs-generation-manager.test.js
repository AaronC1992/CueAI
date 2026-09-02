import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadManager(envOverrides = {}) {
  vi.resetModules();
  process.env = {
    ...ORIGINAL_ENV,
    ELEVENLABS_API_KEY: 'sk_test_key_1234567890',
    AI_SOUND_FALLBACK_ENABLED: 'true',
    ELEVENLABS_CREDIT_CHECK_INTERVAL_MS: '100000',
    ELEVENLABS_DEPLETED_RECHECK_INTERVAL_MS: '200000',
    ELEVENLABS_GENERATION_COOLDOWN_MS: '50',
    ELEVENLABS_MINIMUM_CREDIT_RESERVE: '0',
    MAX_CONCURRENT_AI_SOUND_GENERATIONS: '1',
    ...envOverrides,
  };
  return import('../lib/modules/elevenlabs-generation-manager.js');
}

function subscriptionResponse({ characterCount = 100, characterLimit = 10000, status = 'active' } = {}) {
  return new Response(JSON.stringify({
    character_count: characterCount,
    character_limit: characterLimit,
    status,
  }), { status: 200 });
}

function generationResponse(bytes = new Uint8Array([1, 2, 3])) {
  return new Response(bytes, { status: 200 });
}

describe('ElevenLabsGenerationManager', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  it('fails safely when ELEVENLABS_API_KEY is missing', async () => {
    const manager = await loadManager({ ELEVENLABS_API_KEY: '' });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await manager.generateSound({ cue: 'glass breaking on stone' });

    expect(result).toEqual({ ok: false, reason: 'missing_api_key' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not call ElevenLabs when the fallback is disabled', async () => {
    const manager = await loadManager({ AI_SOUND_FALLBACK_ENABLED: 'false' });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await manager.generateSound({ cue: 'glass breaking on stone' });

    expect(result).toEqual({ ok: false, reason: 'disabled' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('generates successfully when credits are available', async () => {
    const manager = await loadManager();
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(subscriptionResponse())
      .mockResolvedValueOnce(generationResponse());
    vi.stubGlobal('fetch', fetchSpy);

    const result = await manager.generateSound({ cue: 'dragon claws on wooden door', type: 'sfx' });

    expect(result.ok).toBe(true);
    expect(result.audio).toBeInstanceOf(Buffer);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1][0]).toBe('https://api.elevenlabs.io/v1/sound-generation');
  });

  it('caches the credit status instead of checking before every generation', async () => {
    const manager = await loadManager({ ELEVENLABS_GENERATION_COOLDOWN_MS: '0' });
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(subscriptionResponse())
      .mockResolvedValueOnce(generationResponse())
      .mockResolvedValueOnce(generationResponse());
    vi.stubGlobal('fetch', fetchSpy);

    await manager.generateSound({ cue: 'wolf snarling loudly' });
    await manager.generateSound({ cue: 'completely different cue text' });

    // Only one subscription check across both generations — the rest are generation calls.
    const subscriptionCalls = fetchSpy.mock.calls.filter(([url]) => url.includes('subscription'));
    expect(subscriptionCalls).toHaveLength(1);
  });

  it('refreshes credit status again after the cache TTL expires', async () => {
    const manager = await loadManager({ ELEVENLABS_CREDIT_CHECK_INTERVAL_MS: '10', ELEVENLABS_GENERATION_COOLDOWN_MS: '0' });
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(subscriptionResponse())
      .mockResolvedValueOnce(generationResponse())
      .mockResolvedValueOnce(subscriptionResponse())
      .mockResolvedValueOnce(generationResponse());
    vi.stubGlobal('fetch', fetchSpy);

    await manager.generateSound({ cue: 'first distinct cue' });
    await new Promise((resolve) => setTimeout(resolve, 25));
    await manager.generateSound({ cue: 'second distinct cue' });

    const subscriptionCalls = fetchSpy.mock.calls.filter(([url]) => url.includes('subscription'));
    expect(subscriptionCalls).toHaveLength(2);
  });

  it('opens the circuit breaker when the subscription reports depleted credits', async () => {
    const manager = await loadManager({ ELEVENLABS_MINIMUM_CREDIT_RESERVE: '1000' });
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(subscriptionResponse({ characterCount: 9800, characterLimit: 10000 })); // remaining=200 < reserve
    vi.stubGlobal('fetch', fetchSpy);

    const result = await manager.generateSound({ cue: 'depleted account test cue' });

    expect(result).toEqual({ ok: false, reason: 'depleted' });
    expect(manager.getStatus().circuitBreaker.open).toBe(true);
    expect(manager.canGenerate()).toBe(false);
  });

  it('uses the longer depleted recheck interval once the breaker is open', async () => {
    const manager = await loadManager({
      ELEVENLABS_MINIMUM_CREDIT_RESERVE: '1000',
      ELEVENLABS_CREDIT_CHECK_INTERVAL_MS: '10',
      ELEVENLABS_DEPLETED_RECHECK_INTERVAL_MS: '100000',
    });
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(subscriptionResponse({ characterCount: 9800, characterLimit: 10000 }));
    vi.stubGlobal('fetch', fetchSpy);

    await manager.generateSound({ cue: 'trigger depletion cue' });
    await new Promise((resolve) => setTimeout(resolve, 25)); // longer than the (unused) 10ms normal TTL
    await manager.generateSound({ cue: 'should not recheck yet cue' });

    // Still depleted, and no second subscription fetch since the depleted
    // recheck interval (100s) hasn't elapsed.
    const subscriptionCalls = fetchSpy.mock.calls.filter(([url]) => url.includes('subscription'));
    expect(subscriptionCalls).toHaveLength(1);
  });

  it('opens the circuit breaker immediately on a quota error during generation', async () => {
    const manager = await loadManager();
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(subscriptionResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: { status: 'quota_exceeded', message: 'insufficient credits' } }), { status: 401 }));
    vi.stubGlobal('fetch', fetchSpy);

    const result = await manager.generateSound({ cue: 'quota error during generation cue' });

    expect(result).toEqual({ ok: false, reason: 'depleted', status: 401 });
    expect(manager.getStatus().circuitBreaker.open).toBe(true);
  });

  it('does not open the circuit breaker for a generic 500 generation error', async () => {
    const manager = await loadManager();
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(subscriptionResponse())
      .mockResolvedValueOnce(new Response('server error', { status: 500 }));
    vi.stubGlobal('fetch', fetchSpy);

    const result = await manager.generateSound({ cue: 'generic server error cue' });

    expect(result).toEqual({ ok: false, reason: 'error', status: 500 });
    expect(manager.getStatus().circuitBreaker.open).toBe(false);
  });

  it('a temporary network failure on the credit check does not falsely mark credits depleted forever', async () => {
    const manager = await loadManager({ ELEVENLABS_CREDIT_CHECK_INTERVAL_MS: '10' });
    const fetchSpy = vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(subscriptionResponse())
      .mockResolvedValueOnce(generationResponse());
    vi.stubGlobal('fetch', fetchSpy);

    const firstAttempt = await manager.generateSound({ cue: 'network hiccup cue one' });
    expect(firstAttempt.ok).toBe(false);
    expect(manager.getStatus().circuitBreaker.open).toBe(false); // never opened from a transport error

    await new Promise((resolve) => setTimeout(resolve, 25));
    const secondAttempt = await manager.generateSound({ cue: 'network recovered cue two' });
    expect(secondAttempt.ok).toBe(true);
  });

  it('collapses multiple simultaneous identical requests into a single generation call', async () => {
    const manager = await loadManager();
    let resolveGeneration;
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(subscriptionResponse())
      .mockImplementationOnce(() => new Promise((resolve) => { resolveGeneration = resolve; }));
    vi.stubGlobal('fetch', fetchSpy);

    const first = manager.generateSound({ cue: 'duplicate cue text' });
    const second = manager.generateSound({ cue: 'duplicate cue text' });
    // Let the (already in-flight) subscription-check microtask chain resolve
    // before we resolve the generation call it unlocks.
    await new Promise((resolve) => setTimeout(resolve, 10));
    resolveGeneration(generationResponse());

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
    // subscription(1) + generation(1) — the second call reused the in-flight promise.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('enforces a cooldown so the same cue is not regenerated within the cooldown window', async () => {
    const manager = await loadManager({ ELEVENLABS_GENERATION_COOLDOWN_MS: '100000' });
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(subscriptionResponse())
      .mockResolvedValueOnce(generationResponse());
    vi.stubGlobal('fetch', fetchSpy);

    const first = await manager.generateSound({ cue: 'the wolf scratches the door' });
    const second = await manager.generateSound({ cue: 'the wolf scratches the door' });

    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, reason: 'cooldown' });
    expect(fetchSpy).toHaveBeenCalledTimes(2); // no extra generation call for the second request
  });

  it('builds a focused prompt with type-appropriate duration/settings', async () => {
    const manager = await loadManager();
    const sfx = manager.buildGenerationPrompt('glass breaking on stone floor', 'sfx');
    const ambience = manager.buildGenerationPrompt('rain falling steadily in a forest', 'ambience');

    expect(sfx.prompt).toContain('glass breaking on stone floor');
    expect(sfx.prompt).toContain('foley');
    expect(sfx.durationSeconds).toBeLessThanOrEqual(5);
    expect(ambience.prompt).toContain('seamless ambient loop');
    expect(ambience.durationSeconds).toBeGreaterThan(sfx.durationSeconds);
  });
});
