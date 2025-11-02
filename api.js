// ===== CUEAI API SERVICE =====
// Centralized API calls to backend or fallback to client-side logic

// Simple in-memory caches and backoff helpers (per page load)
let __soundsCache = null; // { sounds: [...] }
let __soundsCacheTime = 0;
const __SOUNDS_TTL = 60_000; // 60s
let __backendCooldownUntil = 0; // timestamp ms

/**
 * Get the backend URL based on environment
 * @returns {string} Backend base URL
 */
function getBackendUrl() {
    // Check for environment-specific backend URL (set via build or config)
    if (typeof window !== 'undefined' && window.CUEAI_BACKEND_URL) {
        return window.CUEAI_BACKEND_URL;
    }
    
    // Force production backend (comment out for local dev)
    // return 'https://cueai-backend.onrender.com';
    
    // Auto-detect backend URL based on environment
    const host = location.hostname || '';
    if (location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1') {
        // Use production backend even in local dev if local server not running
        return 'https://cueai-backend.onrender.com';
    }
    // Production: already using Render URL
    return 'https://cueai-backend.onrender.com';
}

/**
 * Fetch sound catalog from backend or fallback to local saved-sounds.json
 * @returns {Promise<Array>} Array of sound objects
 */
async function fetchSounds() {
    // Serve from cache when fresh
    const now = Date.now();
    if (__soundsCache && (now - __soundsCacheTime) < __SOUNDS_TTL) {
        return __soundsCache;
    }

    const backendUrl = getBackendUrl();
    
    try {
        // Try backend first
        const resp = await fetch(`${backendUrl}/sounds`, { 
            cache: 'no-cache',
            signal: AbortSignal.timeout(5000)
        });
        
        if (resp.ok) {
            const data = await resp.json();
            
            if (Array.isArray(data)) {
                // Backend returned an array of sounds directly
                console.log(`[CueAI] Loaded ${data.length} sounds from backend`);
                __soundsCache = data;
                __soundsCacheTime = Date.now();
                return __soundsCache;
            } else if (Array.isArray(data?.sounds)) {
                // Legacy shape: { sounds: [...] }
                console.log(`[CueAI] Loaded ${data.sounds.length} sounds from backend (wrapped)`);
                __soundsCache = data.sounds;
                __soundsCacheTime = Date.now();
                return __soundsCache;
            }
        }
        
        throw new Error(`Backend returned ${resp.status}`);
    } catch (err) {
        console.warn('Backend /sounds unavailable, falling back to local saved-sounds.json:', err.message);
        
        // Fallback to local saved-sounds.json (dev only)
        try {
            const resp = await fetch('saved-sounds.json', { cache: 'no-cache' });
            if (resp.ok) {
                const data = await resp.json();
                if (Array.isArray(data?.files)) {
                    console.log(`✓ Loaded ${data.files.length} sounds from local saved-sounds.json`);
                    // Map to backend format
                    __soundsCache = data.files.map(f => ({
                        id: f.file || f.name,
                        type: f.type === 'music' ? 'music' : 'sfx',
                        name: f.name,
                        src: f.file,
                        tags: f.keywords || [],
                        loop: f.type === 'music'
                    }));
                    __soundsCacheTime = Date.now();
                    return __soundsCache;
                }
            }
        } catch (localErr) {
            console.error('Failed to load local saved-sounds.json:', localErr);
        }
        
        // Return empty array if all fails
        return [];
    }
}

/**
 * Analyze transcript using backend or fallback to direct OpenAI call
 * @param {Object} payload - { transcript, mode, context }
 * @returns {Promise<Object>} AI decision object
 */
async function analyzeTranscript(payload) {
    const { transcript, mode, context } = payload;
    const backendUrl = getBackendUrl();
    
    if (!transcript || !transcript.trim()) {
        throw new Error('Transcript is required');
    }
    
    try {
        // Respect temporary cooldown after 429s
        if (Date.now() < __backendCooldownUntil) {
            throw new Error('backend_cooldown');
        }
        // Try backend first
        const resp = await fetch(`${backendUrl}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript, mode, context }),
            signal: AbortSignal.timeout(28000) // 28 second timeout
        });
        
        if (resp.ok) {
            const decision = await resp.json();
            console.log('✓ Got AI decision from backend:', decision);
            return decision;
        }
        
        if (resp.status === 429) {
            // Back off for 60s to avoid hammering backend
            __backendCooldownUntil = Date.now() + 60_000;
        }
        throw new Error(`Backend /analyze returned ${resp.status}`);
    } catch (err) {
        console.warn('Backend /analyze unavailable, falling back to client-side OpenAI:', err.message);
        
        // Fallback to direct OpenAI call from client
        return await analyzeTranscriptClientSide(payload);
    }
}

/**
 * Fallback: Call OpenAI directly from client (requires API key in browser)
 * @param {Object} payload - { transcript, mode, context }
 * @returns {Promise<Object>} AI decision object
 */
async function analyzeTranscriptClientSide(payload) {
    const { transcript, mode, context } = payload;
    
    // Guard: getOpenAIKey may not be defined yet if game.js hasn't loaded
    const apiKey = (typeof getOpenAIKey === "function") ? getOpenAIKey() : null;
    
    if (!apiKey) {
        console.warn('[CueAI] No OpenAI key available in browser fallback.');
        throw new Error('OpenAI API key not found. Please set your API key or use backend.');
    }
    
    // Load available sounds so the model only returns valid IDs
    let availableSounds = [];
    try {
        availableSounds = await fetchSounds();
    } catch (e) {
        console.warn('Could not load available sounds for prompt context:', e.message);
    }
    
    // Build prompt including available catalog
    const prompt = buildAnalysisPrompt(transcript, mode, context, availableSounds);
    
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You are a JSON-only audio decision engine. Always return valid JSON.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 300
            }),
            signal: AbortSignal.timeout(25000)
        });
        
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(`OpenAI error: ${response.status} ${err.error?.message || ''}`);
        }
        
        const data = await response.json();
        const content = data.choices[0].message.content.trim();
        
        try {
            return JSON.parse(content);
        } catch (e) {
            // Try to repair JSON
            const match = content.match(/\{[\s\S]*\}/);
            if (match) {
                return JSON.parse(match[0]);
            }
            throw new Error('Failed to parse OpenAI response as JSON');
        }
    } catch (error) {
        console.error('Client-side OpenAI call failed:', error);
        throw error;
    }
}

/**
 * Build analysis prompt for OpenAI (simplified version)
 * @param {string} transcript - User's speech
 * @param {string} mode - Current mode (dnd, bedtime, etc.)
 * @param {Object} context - Additional context
 * @returns {string} Formatted prompt
 */
function buildAnalysisPrompt(transcript, mode, context, availableSounds = []) {
        const idsList = availableSounds.map(s => s.id).join(', ');
        const catalogItems = availableSounds.map(s => `${s.id} (${s.type}${s.tags && s.tags.length ? `, tags: ${s.tags.join(',')}` : ''})`).join('\n');
        return `You are a JSON-only audio decision engine for a ${mode || 'auto'} experience.
User said: "${transcript}"

Rules:
- Return STRICT JSON only, no markdown or commentary
- Use only IDs from the approved catalog list below
- Music: choose one looping track or null
- SFX: up to 2 effects, each with a when and volume
- Volume range: 0.0 to 1.0

Approved catalog IDs:
${idsList}

Catalog details:
${catalogItems}

Response format (STRICT JSON):
{
    "scene": "short description",
    "music": { "id": "<one_of_the_ids_above>", "action": "play_or_continue", "volume": 0.5 },
    "sfx": [
        { "id": "<one_of_the_ids_above>", "when": "immediate", "volume": 0.7 }
    ]
}`;
}

// Export for use in game.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { fetchSounds, analyzeTranscript, getBackendUrl };
}
