/**
 * POST /api/tts — Text-to-Speech
 *
 * Accepts: { text: string, voice?: string }
 * Returns: audio/mpeg stream
 *
 * Providers are tried in order (ElevenLabs, then OpenAI) so an exhausted quota on
 * one falls through instead of failing the request. The client falls back to the
 * browser voice only if every provider is unavailable.
 */

import { requireAuth } from '../../../lib/api-auth.js';
import { checkRateLimit, rateLimitHeaders } from '../../../lib/rate-limit.js';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'PPzYpIqttlTYA83688JI';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE || 'onyx';

function extractDetail(errText) {
    try {
        const parsed = JSON.parse(errText);
        return parsed?.detail?.message || parsed?.detail?.status || parsed?.error?.message || parsed?.message || '';
    } catch {
        return errText.slice(0, 200);
    }
}

async function tryElevenLabs(text, voiceId) {
    if (!ELEVENLABS_API_KEY) return { ok: false, status: 0, detail: 'ElevenLabs API key not configured' };

    const resp = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
        {
            method: 'POST',
            headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg',
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.55,
                    similarity_boost: 0.7,
                    style: 0.35,
                    use_speaker_boost: true,
                },
            }),
        }
    );

    if (resp.ok) return { ok: true, body: resp.body };

    const errText = await resp.text().catch(() => '');
    return { ok: false, status: resp.status, detail: extractDetail(errText) };
}

async function tryOpenAI(text) {
    if (!OPENAI_API_KEY) return { ok: false, status: 0, detail: 'OpenAI API key not configured' };

    const resp = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: OPENAI_TTS_MODEL,
            voice: OPENAI_TTS_VOICE,
            input: text,
            response_format: 'mp3',
        }),
    });

    if (resp.ok) return { ok: true, body: resp.body };

    const errText = await resp.text().catch(() => '');
    return { ok: false, status: resp.status, detail: extractDetail(errText) };
}

export async function POST(request) {
    // Auth check
    const denied = requireAuth(request);
    if (denied) return denied;

    const rate = checkRateLimit(request, {
        namespace: 'tts',
        limit: 8,
        windowMs: 60_000,
    });
    if (!rate.allowed) {
        return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Try again shortly.' }),
            { status: 429, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rate) } }
        );
    }

    if (!ELEVENLABS_API_KEY && !OPENAI_API_KEY) {
        return new Response(
            JSON.stringify({ error: 'No TTS provider configured' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return new Response(
            JSON.stringify({ error: 'Invalid JSON body' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const { text, voice } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return new Response(
            JSON.stringify({ error: 'Missing or empty "text" field' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // Keep each request below the upstream cap and inside a sane cost envelope.
    if (text.length > 3000) {
        return new Response(
            JSON.stringify({ error: 'Text exceeds 3000 character limit' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const trimmed = text.trim();
    const voiceId = voice || DEFAULT_VOICE_ID;
    const providers = [
        { name: 'elevenlabs', run: () => tryElevenLabs(trimmed, voiceId) },
        { name: 'openai', run: () => tryOpenAI(trimmed) },
    ];

    const failures = [];
    for (const provider of providers) {
        let result;
        try {
            result = await provider.run();
        } catch (err) {
            result = { ok: false, status: 0, detail: err.message };
        }

        if (result.ok) {
            return new Response(result.body, {
                status: 200,
                headers: {
                    'Content-Type': 'audio/mpeg',
                    'Cache-Control': 'no-store',
                    'X-TTS-Provider': provider.name,
                },
            });
        }

        console.error(`[TTS] ${provider.name} failed:`, result.status, result.detail);
        failures.push({ provider: provider.name, status: result.status, detail: result.detail });
    }

    return new Response(
        JSON.stringify({
            error: 'All TTS providers failed',
            detail: failures[failures.length - 1]?.detail || '',
            failures,
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
}
