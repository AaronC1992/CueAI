import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

// Minimal chainable stand-in for the Supabase query builder. Each table gets a
// handler that decides what a terminal call (single/maybeSingle/limit/update/insert)
// resolves to, so the store can be exercised without a live database.
function makeSupabaseStub(handlers) {
  const calls = { insertedSounds: [], updates: [] };

  function builder(table, op) {
    const state = { table, op, filters: {} };
    const chain = {
      select: () => chain,
      eq: (col, val) => { state.filters[col] = val; return chain; },
      order: () => chain,
      limit: () => handlers.terminal(state, calls),
      single: () => handlers.terminal(state, calls),
      maybeSingle: () => handlers.terminal(state, calls),
      then: (resolve, reject) => handlers.terminal(state, calls).then(resolve, reject),
    };
    return chain;
  }

  return {
    calls,
    client: {
      from: (table) => ({
        select: () => builder(table, 'select').select(),
        insert: (row) => { calls.insertedSounds.push({ table, row }); return builder(table, 'insert'); },
        update: (row) => { calls.updates.push({ table, row }); return builder(table, 'update'); },
      }),
    },
  };
}

let supabaseStub;

vi.mock('../lib/supabase.js', () => ({
  get supabaseAdmin() { return supabaseStub.client; },
}));

vi.mock('../lib/r2.js', () => ({
  uploadFile: vi.fn().mockResolvedValue(undefined),
  IMMUTABLE_CACHE_CONTROL: 'public, max-age=31536000, immutable',
}));

const generatedRow = {
  id: 'gen-1',
  normalized_cue: 'dragon claws stone wall',
  original_cue: 'dragon claws on a stone wall',
  generation_prompt: 'prompt',
  file: 'sounds/generated/sfx/dragon-claws-abcd.mp3',
  duration: 3,
  type: 'sfx',
  tags: ['dragon', 'claw', 'claws', 'stone', 'wall', 'creature'],
  source: 'elevenlabs-generated',
  use_count: 1,
  promoted_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  last_used_at: '2026-01-01T00:00:00.000Z',
};

function loadStore(row) {
  vi.resetModules();
  supabaseStub = makeSupabaseStub({
    terminal: async (state) => {
      if (state.table === 'sounds') {
        // No existing library entry for this file, and inserts succeed.
        return { data: null, error: null };
      }
      if (state.op === 'select' && state.filters.id) return { data: row, error: null };
      if (state.op === 'select') return { data: [row], error: null };
      return { data: { id: row.id }, error: null };
    },
  });
  return import('../lib/generated-sound-store.js');
}

describe('generated sound auto promotion', () => {
  beforeEach(() => {
    process.env.AI_SOUND_AUTO_PROMOTE_HITS = '3';
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('does not promote a generated sound that has only been reused once', async () => {
    const row = { ...generatedRow, use_count: 1 };
    const { findCachedGeneratedSound } = await loadStore(row);

    await findCachedGeneratedSound(row.original_cue, 'sfx', row.normalized_cue);
    await vi.waitFor(() => expect(supabaseStub.calls.updates.length).toBeGreaterThan(0));

    expect(supabaseStub.calls.insertedSounds).toHaveLength(0);
    expect(supabaseStub.calls.updates[0].row).toMatchObject({ use_count: 2 });
  });

  it('promotes into the shared sounds catalog once the reuse threshold is hit', async () => {
    const row = { ...generatedRow, use_count: 2 };
    const { findCachedGeneratedSound } = await loadStore(row);

    await findCachedGeneratedSound(row.original_cue, 'sfx', row.normalized_cue);
    await vi.waitFor(() => expect(supabaseStub.calls.insertedSounds).toHaveLength(1));

    expect(supabaseStub.calls.insertedSounds[0]).toMatchObject({
      table: 'sounds',
      row: {
        type: 'sfx',
        file: row.file,
        keywords: row.tags,
        loop: false,
      },
    });
  });

  it('does not promote a sound that was already promoted', async () => {
    const row = { ...generatedRow, use_count: 9, promoted_at: '2026-01-02T00:00:00.000Z' };
    const { findCachedGeneratedSound } = await loadStore(row);

    await findCachedGeneratedSound(row.original_cue, 'sfx', row.normalized_cue);
    await vi.waitFor(() => expect(supabaseStub.calls.updates.length).toBeGreaterThan(0));

    expect(supabaseStub.calls.insertedSounds).toHaveLength(0);
  });
});
