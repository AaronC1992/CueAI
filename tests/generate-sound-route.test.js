import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadRoute() {
  vi.resetModules();
  process.env.API_AUTH_SECRET = 'test-secret-that-is-long-enough-for-hmac';
  process.env.PUBLIC_BETA_ACCESS = 'true'; // matches production default; auth is exercised in api-auth.test.js
  const [{ POST }, { generateToken }] = await Promise.all([
    import('../app/api/generate-sound/route.js'),
    import('../lib/api-auth.js'),
  ]);
  return { POST, token: generateToken() };
}

function postRequest(token, body, ip = `127.0.0.${Math.floor(Math.random() * 200) + 1}`) {
  return new Request('https://example.test/api/generate-sound', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
}

vi.mock('../lib/modules/elevenlabs-generation-manager.js', async () => {
  const actual = await vi.importActual('../lib/modules/elevenlabs-generation-manager.js');
  return {
    ...actual,
    normalizeCue: actual.normalizeCue,
    generateSound: vi.fn(),
    reportCacheHit: vi.fn(),
  };
});

vi.mock('../lib/generated-sound-store.js', () => ({
  findCachedGeneratedSound: vi.fn(),
  saveGeneratedSound: vi.fn(),
}));

describe('/api/generate-sound', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('rejects an invalid (too short) cue without calling the generation manager', async () => {
    const { POST, token } = await loadRoute();
    const { generateSound } = await import('../lib/modules/elevenlabs-generation-manager.js');

    const res = await POST(postRequest(token, { cue: 'a' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toMatchObject({ ok: false, reason: 'invalid_cue' });
    expect(generateSound).not.toHaveBeenCalled();
  });

  it('rejects an overly long cue', async () => {
    const { POST, token } = await loadRoute();
    const res = await POST(postRequest(token, { cue: 'x'.repeat(200) }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toMatchObject({ ok: false, reason: 'cue_too_long' });
  });

  it('plays a cached generated sound without calling ElevenLabs', async () => {
    const { POST, token } = await loadRoute();
    const { generateSound } = await import('../lib/modules/elevenlabs-generation-manager.js');
    const { findCachedGeneratedSound } = await import('../lib/generated-sound-store.js');
    findCachedGeneratedSound.mockResolvedValue({ id: 'abc', file: 'sounds/generated/sfx/glass-break-1234.mp3' });

    const res = await POST(postRequest(token, { cue: 'glass breaking on stone floor' }));
    const body = await res.json();

    expect(body).toMatchObject({ ok: true, cached: true, file: 'sounds/generated/sfx/glass-break-1234.mp3' });
    expect(generateSound).not.toHaveBeenCalled();
  });

  it('generates and caches a new sound on a genuine miss', async () => {
    const { POST, token } = await loadRoute();
    const { generateSound } = await import('../lib/modules/elevenlabs-generation-manager.js');
    const { findCachedGeneratedSound, saveGeneratedSound } = await import('../lib/generated-sound-store.js');
    findCachedGeneratedSound.mockResolvedValue(null);
    generateSound.mockResolvedValue({ ok: true, audio: Buffer.from([1, 2, 3]), prompt: 'a prompt', durationSeconds: 3, promptInfluence: 0.35, generationModel: 'elevenlabs-sound-generation' });
    saveGeneratedSound.mockResolvedValue({ id: 'new-id', file: 'sounds/generated/sfx/dragon-claws-abcd.mp3' });

    const res = await POST(postRequest(token, { cue: 'dragon claws on stone wall' }));
    const body = await res.json();

    expect(body).toMatchObject({ ok: true, cached: false, file: 'sounds/generated/sfx/dragon-claws-abcd.mp3' });
    expect(generateSound).toHaveBeenCalledWith({ cue: 'dragon claws on stone wall', type: 'sfx' });
  });

  it('does not call the generator again once quota is depleted, and never plays a bad sound', async () => {
    const { POST, token } = await loadRoute();
    const { generateSound } = await import('../lib/modules/elevenlabs-generation-manager.js');
    const { findCachedGeneratedSound, saveGeneratedSound } = await import('../lib/generated-sound-store.js');
    findCachedGeneratedSound.mockResolvedValue(null);
    generateSound.mockResolvedValue({ ok: false, reason: 'depleted' });

    const res = await POST(postRequest(token, { cue: 'giant spider dragging claws on window' }));
    const body = await res.json();

    expect(body).toMatchObject({ ok: false, reason: 'depleted' });
    expect(saveGeneratedSound).not.toHaveBeenCalled();
  });
});
