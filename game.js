// ===== CUEAI - INTELLIGENT AUDIO COMPANION =====
// Author: Expert AI Team
// Version: 2.0 - Backend Integration

// ===== HELPER FUNCTIONS =====
// Centralized API key management
function getOpenAIKey() {
    return localStorage.getItem('cueai_api_key') || null;
}

function setOpenAIKey(key) {
    if (key) {
        localStorage.setItem('cueai_api_key', key);
    } else {
        localStorage.removeItem('cueai_api_key');
    }
}

function getFreesoundKey() {
    return localStorage.getItem('freesound_api_key') || null;
}

function setFreesoundKey(key) {
    if (key) {
        localStorage.setItem('freesound_api_key', key);
    } else {
        localStorage.removeItem('freesound_api_key');
    }
}

function getPixabayKey() {
    return localStorage.getItem('pixabay_api_key') || null;
}

function setPixabayKey(key) {
    if (key) {
        localStorage.setItem('pixabay_api_key', key);
    } else {
        localStorage.removeItem('pixabay_api_key');
    }
}

// Speech recognition feature detection
function isSpeechRecognitionAvailable() {
    return ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);
}

// ===== AUDIO SERVICE (Howler.js wrapper) =====
const cueAudio = {
    music: null, // Current music Howl instance
    sfx: {}, // Map of active SFX Howl instances by ID
    
    /**
     * Play background music (stops previous music)
     * @param {string} id - Unique identifier for this music track
     * @param {string} src - URL to audio file
     * @param {number} volume - Volume level (0.0 to 1.0)
     * @param {boolean} loop - Whether to loop the music
     * @param {Function} onError - Optional error callback
     */
    playMusic(id, src, volume = 0.5, loop = true, onError = null) {
        // Stop previous music if playing
        if (this.music) {
            this.music.stop();
            this.music.unload();
        }
        
        // Create new music Howl
        this.music = new Howl({
            src: [src],
            volume: volume,
            loop: loop,
            html5: true, // Better for streaming long music files
            onload: () => console.log(`✓ Music loaded: ${id}`),
            onloaderror: (soundId, err) => {
                console.error(`✗ Music load error: ${id}`, err);
                if (onError) onError(id, err);
            },
            onplay: () => console.log(`♫ Playing music: ${id}`),
            onend: () => {
                if (!loop) {
                    this.music = null;
                }
            }
        });
        
        this.music.play();
        return this.music;
    },
    
    /**
     * Play a sound effect (can play multiple simultaneously)
     * @param {string} id - Unique identifier for this SFX
     * @param {string} src - URL to audio file
     * @param {number} volume - Volume level (0.0 to 1.0)
     * @param {number} pan - Stereo pan (-1.0 left to 1.0 right)
     * @param {Function} onError - Optional error callback
     */
    playSfx(id, src, volume = 0.7, pan = 0, onError = null) {
        // Create new SFX Howl (allows overlapping sounds)
        const sfxHowl = new Howl({
            src: [src],
            volume: volume,
            stereo: pan,
            onload: () => console.log(`✓ SFX loaded: ${id}`),
            onloaderror: (soundId, err) => {
                console.error(`✗ SFX load error: ${id}`, err);
                if (onError) onError(id, err);
            },
            onplay: () => console.log(`🔊 Playing SFX: ${id}`),
            onend: () => {
                // Clean up after playback
                delete this.sfx[id + '_' + Date.now()];
            }
        });
        
        // Store with timestamp to allow duplicates
        const key = id + '_' + Date.now();
        this.sfx[key] = sfxHowl;
        sfxHowl.play();
        
        return sfxHowl;
    },
    
    /**
     * Stop currently playing music
     */
    stopMusic() {
        if (this.music) {
            this.music.stop();
            this.music.unload();
            this.music = null;
        }
    },
    
    /**
     * Stop all sound effects
     */
    stopAllSfx() {
        Object.values(this.sfx).forEach(howl => {
            howl.stop();
            howl.unload();
        });
        this.sfx = {};
    },
    
    /**
     * Stop all audio (music + SFX)
     */
    stopAll() {
        this.stopMusic();
        this.stopAllSfx();
    },
    
    /**
     * Fade music volume
     * @param {number} targetVolume - Target volume (0.0 to 1.0)
     * @param {number} duration - Fade duration in milliseconds
     */
    fadeMusic(targetVolume, duration = 500) {
        if (this.music) {
            this.music.fade(this.music.volume(), targetVolume, duration);
        }
    }
};

class CueAI {
    constructor() {
        // Backend Configuration
        this.backendUrl = this.getBackendUrl();
        this.soundCatalog = []; // Loaded from backend /sounds endpoint
        
        // Core Configuration - Use centralized getters
        this.apiKey = getOpenAIKey();
        this.freesoundApiKey = getFreesoundKey();
        this.pixabayApiKey = getPixabayKey();
        
        // Refresh API key on visibility change (in case user updated in another tab)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.apiKey = getOpenAIKey();
                this.freesoundApiKey = getFreesoundKey();
            }
        });
        this.currentMode = 'dnd';
        this.isListening = false;
        this.minVolume = 0.2;
        this.maxVolume = 0.7;
        this.analysisVersion = 0; // increment on mode changes to ignore stale AI results
    // Playback preferences
    this.musicEnabled = JSON.parse(localStorage.getItem('cueai_music_enabled') ?? 'true');
    this.sfxEnabled = JSON.parse(localStorage.getItem('cueai_sfx_enabled') ?? 'true');
    // Mixer levels (user-controlled)
    this.musicLevel = parseFloat(localStorage.getItem('cueai_music_level') ?? '0.5'); // default 50%
    this.sfxLevel = parseFloat(localStorage.getItem('cueai_sfx_level') ?? '0.9');   // default 90%
    this.currentMusicBase = 0.5; // last intensity-derived music gain (pre-user)
    // Mood & performance
    this.moodBias = parseFloat(localStorage.getItem('cueai_mood_bias') ?? '0.5'); // 0..1
    this.lowLatencyMode = JSON.parse(localStorage.getItem('cueai_low_latency') ?? 'false');
    this.preloadConcurrency = this.getPreloadConcurrency();
        
        // Speech Recognition
        this.recognition = null;
        this.transcriptBuffer = [];
    this.lastAnalysisTime = 0;
    // Analyze less frequently to respect backend rate limit (10/min)
    this.analysisInterval = 7000; // ~8-9 requests/min
    this.analysisTimer = null;
    this.analysisInProgress = false;
    this.currentInterim = '';
        
        // Audio System
        this.audioContext = null;
        this.currentMusic = null;
        this.currentMusicSource = null;
        this.musicGainNode = null;
        this.masterGainNode = null;
        // SFX bus
        this.sfxBusGain = null;
        this.sfxCompressor = null;
        this.activeSounds = new Map();
        this.activeBuffers = new Map(); // Store decoded audio buffers
        this.sfxNormGains = new Map(); // url -> normalization gain
        this.soundQueue = [];
        this.maxSimultaneousSounds = 3;
        this.duckingInProgress = false;
        this.duckParams = { attack: 0.05, hold: 0.15, release: 0.35, floor: 0.25 };
        this.stingerTimer = null;
        
        // Preload state
        this.preloadInProgress = false;
        this.preloadVersion = 0; // bump to cancel previous preloads on mode change
        // Expanded per-mode preload sets (15-20 common, CC0-friendly queries)
        this.modePreloadSets = {
            bedtime: [
                'dog bark','cat meow','door knock','rain','wind whoosh','fire crackling','owl hoot',
                'crickets','soft footsteps','page turn','blanket rustle','wood creak','clock tick',
                'distant thunder','water drip','bird chirp','lullaby chime','toy bell','piano soft',
                'heartbeat soft'
            ],
            dnd: [
                'sword clash','arrow shot','monster roar','footsteps','door creak','thunder','coin jingle',
                'spell cast','magic whoosh','shield block','torch crackle','crowd tavern','horse gallop',
                'gate open','dragon roar','bow twang','book page turn','chain rattle','door slam','wind cave'
            ],
            horror: [
                'door creak','whisper','heartbeat','wind whoosh','ghost boo','witch cackle','chain drag',
                'footsteps hallway','breath heavy','thunder distant','scream far','floorboard creak',
                'owl hoot','metal scrape','water drip','clock tick','radio static','crow caw','cat hiss','wolf howl'
            ],
            christmas: [
                'jingle bells','sleigh bells','fire crackling','children laugh','wind arctic','snow footsteps',
                'gift wrap','door knock','bell chime','choir ahh','reindeer bells','door creak','ice crackle',
                'wind whoosh','glass clink','street christmas','crowd cheer','applause','laugh','santa ho ho'
            ],
            halloween: [
                'witch cackle','ghost boo','wolf howl','door creak','thunder','owl hoot','chain rattle',
                'bat flutter','cat hiss','wind whoosh','zombie groan','crow caw','footsteps leaves',
                'pumpkin squash','monster roar','scream far','gate creak','rain','distant bells','cauldron bubble'
            ],
            sing: [
                'applause','crowd cheer','drum kick','snare hit','metronome click','hi hat','clap',
                'shaker','tambourine','airhorn short','bass drop short','reverb clap','vocal ahh short',
                'vocal ohh short','tap tempo click','count in','guitar strum','piano chord','sub drop','riser short'
            ],
            auto: [
                'dog bark','door knock','footsteps','thunder','fire crackling','wind whoosh','applause',
                'laugh','scream','metal crash','water splash','door slam','heartbeat','bird chirp','cat meow',
                'car horn','bell chime','crowd murmur','coin jingle','keyboard typing'
            ]
        };
        this.genericPreloadSet = [
            'dog bark','door knock','footsteps','thunder','fire crackling','wind whoosh','applause',
            'laugh','scream','metal crash','water splash','door slam','heartbeat','bird chirp','cat meow',
            'bell chime','coin jingle','crow caw','owl hoot','chain rattle'
        ];
        
        // Visualizer
        this.analyser = null;
        this.visualizerAnimationId = null;
        
    // Cache / recent playback tracking
    this.soundCache = new Map();
    this.recentlyPlayed = new Set(); // track recent URLs to reduce repeats
    // SFX anti-repeat
        this.sfxCooldownMs = 3500; // minimum gap between same-category SFX
        this.sfxCooldowns = new Map(); // bucket -> nextAllowedTime
        // Saved sounds (local quick-access library)
        this.savedSounds = { files: [] };
        this.userSavedSoundsPref = JSON.parse(localStorage.getItem('cueai_saved_sounds_enabled') ?? 'true');
    this.savedSoundsEnabled = false;            // Instant trigger keywords for immediate sound effects
    // AI prediction (auto analysis + auto-playback); default OFF
    this.predictionEnabled = JSON.parse(localStorage.getItem('cueai_prediction_enabled') ?? 'false');
    // Story preferences
    this.autoStartStoryListening = JSON.parse(localStorage.getItem('cueai_auto_start_story_listening') ?? 'false');
            this.instantKeywords = {
                'bang': { query: 'gunshot explosion', volume: 0.9 },
                'crash': { query: 'crash metal', volume: 0.8 },
                'boom': { query: 'explosion boom', volume: 0.9 },
                'thunder': { query: 'thunder storm', volume: 0.8 },
                'scream': { query: 'scream horror', volume: 0.7 },
                'roar': { query: 'monster roar', volume: 0.8 },
                'growl': { query: 'monster growl', volume: 0.8 },
                'snarl': { query: 'monster growl', volume: 0.8 },
                'ogre': { query: 'monster growl', volume: 0.8 },
                'troll': { query: 'monster growl', volume: 0.8 },
                'orc': { query: 'monster growl', volume: 0.8 },
                'goblin': { query: 'monster growl', volume: 0.8 },
                'beast': { query: 'monster growl', volume: 0.8 },
                'slam': { query: 'door slam', volume: 0.7 },
                'splash': { query: 'water splash', volume: 0.6 },
                'whoosh': { query: 'wind whoosh', volume: 0.6 },
                'thud': { query: 'heavy thud', volume: 0.7 },
                // Everyday quick cues
                'bark': { query: 'dog bark', volume: 0.7 },
                'woof': { query: 'dog bark', volume: 0.7 },
                'meow': { query: 'cat meow', volume: 0.6 },
                'knock': { query: 'door knock', volume: 0.7 },
                'footsteps': { query: 'footsteps', volume: 0.6 },
                'footstep': { query: 'footsteps', volume: 0.6 },
                'clap': { query: 'applause', volume: 0.7 },
                'applause': { query: 'applause', volume: 0.7 },
                'laugh': { query: 'laugh', volume: 0.7 },
                'giggle': { query: 'laugh', volume: 0.6 },
                // Horror-focused additions
                'creak': { query: 'door creak', volume: 0.6 },
                'whisper': { query: 'whisper breath', volume: 0.5 },
                'heartbeat': { query: 'heartbeat', volume: 0.6 },
                // Christmas additions
                'jingle': { query: 'jingle bells', volume: 0.7 },
                'sleigh': { query: 'sleigh bells', volume: 0.7 },
                'hohoho': { query: 'santa laugh ho ho', volume: 0.8 },
                // Halloween additions
                'cackle': { query: 'witch cackle laugh', volume: 0.7 },
                'boo': { query: 'ghost boo', volume: 0.6 },
                'howl': { query: 'wolf howl', volume: 0.7 }
            };
        
        // Initialize
        this.init();
    }
    
    init() {
        this.checkApiKey();
        this.setupEventListeners();
        this.initializeAudioContext();
        this.initializeSpeechRecognition();
        this.setupVisualizer();
        this.updateApiStatusIndicators();
        // Load sound catalog from backend
        this.loadSoundCatalog().catch(() => console.warn('Backend catalog unavailable'));
        // Load local saved sounds (legacy/fallback)
        this.loadSavedSounds().catch(()=>{});
        // Load built-in stories
        this.loadStories().catch(()=>{});
    }
    
    getBackendUrl() {
        // Use centralized backend URL from api.js
        return getBackendUrl();
    }
    
    async loadSoundCatalog() {
        try {
            // Use centralized API service (from api.js)
            this.soundCatalog = await fetchSounds();
            if (this.soundCatalog.length > 0) {
                console.log(`✓ Loaded ${this.soundCatalog.length} sounds`);
            } else {
                console.warn('No sounds loaded from catalog');
            }
        } catch (err) {
            console.error('Failed to load sound catalog:', err.message);
            this.soundCatalog = [];
        }
    }

    async loadSavedSounds() {
        try {
            const resp = await fetch('saved-sounds.json', { cache: 'no-cache' });
            if (!resp.ok) return;
            const data = await resp.json();
            if (Array.isArray(data?.files)) {
                this.savedSounds.files = data.files.map(f => ({
                    type: (f.type === 'music' ? 'music' : 'sfx'),
                    name: String(f.name || '').toLowerCase(),
                    file: String(f.file || ''),
                    keywords: Array.isArray(f.keywords) ? f.keywords.map(k=>String(k||'').toLowerCase()) : []
                }));
                const host = location.hostname || '';
                const isLocal = location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1';
                const isPages = /github\.io$/i.test(host);
                this.savedSoundsEnabled = this.savedSounds.files.length > 0 && !!this.userSavedSoundsPref;
                console.log(`Loaded saved sounds: ${this.savedSounds.files.length}; enabled=${this.savedSoundsEnabled}`);
                // Reflect toggle if present
                const toggleSaved = document.getElementById('toggleSaved');
                if (toggleSaved) {
                    toggleSaved.checked = !!this.userSavedSoundsPref && this.savedSoundsEnabled;
                    toggleSaved.disabled = !(this.savedSounds.files.length > 0);
                }
            }
        } catch(_) {}
    }    // ===== API KEY MANAGEMENT =====

    // ===== STORIES =====
    async loadStories() {
        try {
            const resp = await fetch('stories.json', { cache: 'no-cache' });
            if (!resp.ok) return;
            const data = await resp.json();
            this.stories = {};
            for (const s of (data.stories || [])) {
                this.stories[s.id] = { id: s.id, title: s.title, text: s.text };
            }
        } catch (_) {}
    }

    showStoryOverlay(storyId) {
        if (!this.stories || !this.stories[storyId]) return;
        this.currentStory = this.stories[storyId];
        this.storyActive = true;
        this.storyIndex = 0;
        const contentEl = document.getElementById('storyContent');
        const titleEl = document.getElementById('storyTitle');
        if (titleEl) titleEl.textContent = this.currentStory.title;
        // Tokenize text into words and separators
        const tokens = this.tokenizeStory(this.currentStory.text);
        this.storyTokens = tokens;
        this.storyNorm = tokens.map(t => this.normalizeWord(t));
        // Render spans
        if (contentEl) {
            const frag = document.createDocumentFragment();
            tokens.forEach((tok, i) => {
                if (/^\s+$/.test(tok)) {
                    frag.appendChild(document.createTextNode(tok));
                } else {
                    const span = document.createElement('span');
                    span.textContent = tok;
                    span.className = 'story-word';
                    span.dataset.index = String(i);
                    frag.appendChild(span);
                }
            });
            contentEl.innerHTML = '';
            contentEl.appendChild(frag);
            contentEl.scrollTop = 0;
            contentEl.focus({ preventScroll: true });
        }
        // Prefetch initial sounds from first chunk
        this.prefetchStoryWindow();
        // Show overlay
        const overlay = document.getElementById('storyOverlay');
        if (overlay) overlay.classList.remove('hidden');
    }

    hideStoryOverlay() {
        this.storyActive = false;
        this.currentStory = null;
        this.storyTokens = [];
        this.storyNorm = [];
        const overlay = document.getElementById('storyOverlay');
        if (overlay) overlay.classList.add('hidden');
    }

    tokenizeStory(text) {
        // Split into word-like tokens; keep punctuation and line breaks as separate tokens for display
        const parts = text.split(/(\s+|[^\w']+)/g).filter(p => p !== undefined && p !== '');
        return parts;
    }

    normalizeWord(tok) {
        return String(tok).toLowerCase().replace(/[^a-z0-9']+/g, '');
    }

    advanceStoryWithTranscript(text) {
        if (!this.storyActive || !text) return;
        const spoken = text.toLowerCase().replace(/[^a-z0-9'\s]+/g, ' ').split(/\s+/).filter(Boolean);
        if (spoken.length === 0) return;
        
        // Track sliding window of recent spoken words for recovery
        if (!this._recentSpoken) this._recentSpoken = [];
        this._recentSpoken.push(...spoken);
        if (this._recentSpoken.length > 30) this._recentSpoken = this._recentSpoken.slice(-30);
        
        let i = this.storyIndex;
        let progressed = 0;
        
        // Try strict sequential match first
        for (const w of spoken) {
            while (i < this.storyNorm.length && this.storyNorm[i] === '') i++;
            if (i >= this.storyNorm.length) break;
            if (this.eqLoose(this.storyNorm[i], w)) {
                i++; progressed++;
                this.maybeTriggerStorySfx(w);
            } else {
                if (/^(the|and|a|an|to|of|in|on|at|with)$/.test(this.storyNorm[i])) { i++; }
            }
        }
        
        // If stuck (no progress after 3+ words spoken), try lookahead recovery
        if (progressed === 0 && spoken.length >= 3) {
            const recovered = this.attemptStoryRecovery(spoken);
            if (recovered > this.storyIndex) {
                console.log(`Story recovery: jumped from ${this.storyIndex} to ${recovered}`);
                i = recovered;
                progressed = recovered - this.storyIndex;
            }
        }
        
        if (i > this.storyIndex) {
            this.storyIndex = i;
            this.updateStoryHighlight();
            this.prefetchStoryWindow();
        }
    }
    
    attemptStoryRecovery(spoken) {
        // Scan ahead in story tokens to find where the spoken phrase might resume
        const lookahead = 40; // tokens ahead to scan
        const minMatch = Math.min(3, spoken.length); // require at least 3 matching words
        const window = this.storyNorm.slice(this.storyIndex, this.storyIndex + lookahead);
        
        // Try to find a substring of spoken words in the lookahead window
        for (let startIdx = 0; startIdx < window.length - minMatch; startIdx++) {
            let matched = 0;
            let j = 0;
            for (let k = startIdx; k < window.length && j < spoken.length; k++) {
                if (window[k] === '') continue; // skip whitespace tokens
                if (this.eqLoose(window[k], spoken[j])) {
                    matched++;
                    j++;
                } else {
                    // Allow skipping small words in story
                    if (/^(the|and|a|an|to|of|in|on|at|with|it|is|was)$/.test(window[k])) {
                        continue;
                    } else {
                        break; // mismatch, try next start position
                    }
                }
            }
            if (matched >= minMatch) {
                // Found a good match; return the absolute story index
                return this.storyIndex + startIdx;
            }
        }
        return this.storyIndex; // no recovery found
    }

    eqLoose(a, b) {
        if (!a || !b) return a === b;
        if (a === b) return true;
        // Normalize possessives
        const base = (s) => s.replace(/'(s)?$/, '');
        // Strip common suffixes
        const strip = (s) => {
            let r = s;
            r = r.replace(/(ing|ed|ly|er|est)$/,'');
            r = r.replace(/(es|s)$/,'');
            return r;
        };
        const a1 = strip(base(a));
        const b1 = strip(base(b));
        if (a1 && b1 && a1 === b1) return true;
        const irregular = { wolves:'wolf', children:'child', men:'man', women:'woman', geese:'goose', mice:'mouse', feet:'foot', teeth:'tooth' };
        if (irregular[a] && irregular[a] === b) return true;
        if (irregular[b] && irregular[b] === a) return true;
        return false;
    }

    updateStoryHighlight() {
        const contentEl = document.getElementById('storyContent');
        if (!contentEl) return;
        const children = contentEl.querySelectorAll('.story-word');
        for (let k = 0; k < children.length; k++) {
            const el = children[k];
            const idx = parseInt(el.dataset.index || '0', 10);
            el.classList.toggle('highlight', idx < this.storyIndex);
            el.classList.toggle('active', idx === this.storyIndex);
        }
        // Keep current line in view
        const active = contentEl.querySelector('.story-word.active');
        if (active) {
            const rect = active.getBoundingClientRect();
            const crect = contentEl.getBoundingClientRect();
            if (rect.top < crect.top + 40 || rect.bottom > crect.bottom - 60) {
                contentEl.scrollTop += (rect.top - crect.top) - 100;
            }
        }
    }

    // Map common keywords in stories to SFX searches
    getStoryCueMap() {
        return {
            'bell': 'bell chime',
            'bells': 'bell chime',
            'clock': 'tick tock',
            'midnight': 'clock chime',
            'horse': 'horse galloping',
            'horses': 'horse galloping',
            'coach': 'carriage creak',
            'step': 'footsteps',
            'steps': 'footsteps',
            'door': 'door creak',
            'knock': 'door knock',
            'wind': 'wind whoosh',
            'storm': 'thunder',
            'thunder': 'thunder',
            'rain': 'rain on windows',
            'owl': 'owl hoot',
            'wolf': 'wolf howl',
            'crowd': 'crowd cheering',
            'applause': 'applause',
            'fire': 'fireplace',
            'flame': 'fireplace',
            'witch': 'witch cackle',
            'magic': 'magic whoosh',
            'spell': 'magic spell',
            'sword': 'sword swing',
            'glass': 'glass shatter',
            'mirror': 'glass shatter',
            'beast': 'monster growl',
            'dragon': 'dragon growl',
            'heart': 'heartbeat',
            'cry': 'woman scream',
            'scream': 'woman scream',
        };
    }

    prefetchStoryWindow() {
        if (!this.sfxEnabled) return;
        const cueMap = this.getStoryCueMap();
        const windowTokens = this.storyNorm.slice(this.storyIndex, this.storyIndex + 80);
        const seen = new Set();
        for (const w of windowTokens) {
            if (!w) continue;
            const key = w in cueMap ? w : null;
            if (key && !seen.has(key)) {
                seen.add(key);
                const q = cueMap[key];
                // Warm cache similarly to predictivePrefetch
                const cacheKey = `sfx:${q}`;
                if (this.soundCache.has(cacheKey)) continue;
                this.searchAudio(q, 'sfx').then(async (url) => {
                    if (!url) return;
                    if (!this.activeBuffers.has(url)) {
                        try {
                            const resp = await fetch(url); const ab = await resp.arrayBuffer();
                            const buf = await this.audioContext.decodeAudioData(ab); this.activeBuffers.set(url, buf);
                        } catch(_) {}
                    }
                });
            }
        }
    }

    maybeTriggerStorySfx(word) {
        if (!this.sfxEnabled) return;
        const cueMap = this.getStoryCueMap();
        const q = cueMap[word];
        if (q) {
            this.playSoundEffect({ query: q, priority: 6, volume: 0.7 }).catch(()=>{});
        }
    }
    async checkApiKey() {
        const modal = document.getElementById('apiKeyModal');
        const appContainer = document.getElementById('appContainer');
        // If user supplied an API key, proceed
        if (this.apiKey && this.apiKey.length > 10) {
            modal.classList.add('hidden');
            appContainer.classList.remove('hidden');
            return;
        }

        // Otherwise, allow usage if backend is reachable (no key needed for testers)
        try {
            const backendUrl = this.getBackendUrl();
            const resp = await fetch(`${backendUrl}/health`, { cache: 'no-cache', signal: AbortSignal.timeout(3000) });
            if (resp.ok) {
                modal.classList.add('hidden');
                appContainer.classList.remove('hidden');
                this.updateStatus('Using server AI — no OpenAI key needed');
                return;
            }
        } catch (_) {}

        // Fallback: require user key when backend not available
        modal.classList.remove('hidden');
        appContainer.classList.add('hidden');
    }
    
    saveApiKey() {
        const input = document.getElementById('apiKeyInput');
        if (!input) return;
        
        const key = input.value.trim();
        
        if (key.length > 10) {
            this.apiKey = key;
            setOpenAIKey(key); // Use centralized setter
            this.checkApiKey();
            this.updateStatus(`OpenAI API Key saved!`);
            this.updateApiStatusIndicators();
        } else {
            this.updateStatus('⚠️ Invalid API key. Please check and try again.', 'error');
        }
    }
    
    resetApiKey() {
        if (confirm('Are you sure you want to reset your API key?')) {
            setOpenAIKey(null); // Use centralized setter
            this.apiKey = null;
            this.stopListening();
            this.checkApiKey();
            this.updateApiStatusIndicators();
        }
    }
    
    showFreesoundSetup() {
        document.getElementById('freesoundModal').classList.remove('hidden');
    }
    
    hideFreesoundSetup() {
        document.getElementById('freesoundModal').classList.add('hidden');
    }

    showTutorial() {
        document.getElementById('tutorialModal').classList.remove('hidden');
    }
    
    showFeedback() {
        document.getElementById('feedbackModal').classList.remove('hidden');
    }
    
    hideFeedback() {
        document.getElementById('feedbackModal').classList.add('hidden');
    }
    
    sendFeedbackEmail() {
        const type = (document.getElementById('feedbackType')?.value || 'Feedback').trim();
        const subjectInput = (document.getElementById('feedbackSubject')?.value || '').trim();
        const message = (document.getElementById('feedbackText')?.value || '').trim();
        const subject = subjectInput || `${type} - CueAI`;
        
        // Gather minimal context
        const versionText = document.querySelector('.version')?.textContent || 'v1.x';
        const ctx = [
            `Mode: ${this.currentMode}`,
            `Music: ${this.musicEnabled ? 'on' : 'off'}, SFX: ${this.sfxEnabled ? 'on' : 'off'}`,
            `Mood: ${Math.round(this.moodBias*100)}%`,
            `URL: ${location.href}`,
            `App: ${versionText}`,
            `UA: ${navigator.userAgent}`
        ].join('\n');
        
    const body = `${type}\n\n${message}\n\n---\nContext\n${ctx}`;
    const mailto = `mailto:aaroncue92@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent('aaroncue92@gmail.com')}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        
        // Try open default mail client
        try {
            const a = document.createElement('a');
            a.href = mailto;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            this.updateStatus('Opening your email app...');
        } catch (e) {
            this.updateStatus('Could not open email app. Copying email content...');
            try { navigator.clipboard.writeText(`${subject}\n\n${body}`); } catch(_) {}
            alert('If your email app did not open, please paste the copied text into an email to: aaroncue92@gmail.com');
        }
        
        this.hideFeedback();
    }

    openFeedbackInGmail() {
        const type = (document.getElementById('feedbackType')?.value || 'Feedback').trim();
        const subjectInput = (document.getElementById('feedbackSubject')?.value || '').trim();
        const message = (document.getElementById('feedbackText')?.value || '').trim();
        const subject = subjectInput || `${type} - CueAI`;
        const versionText = document.querySelector('.version')?.textContent || 'v1.x';
        const ctx = [
            `Mode: ${this.currentMode}`,
            `Music: ${this.musicEnabled ? 'on' : 'off'}, SFX: ${this.sfxEnabled ? 'on' : 'off'}`,
            `Mood: ${Math.round(this.moodBias*100)}%`,
            `URL: ${location.href}`,
            `App: ${versionText}`,
            `UA: ${navigator.userAgent}`
        ].join('\n');
        const body = `${type}\n\n${message}\n\n---\nContext\n${ctx}`;
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent('aaroncue92@gmail.com')}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        try {
            window.open(gmailUrl, '_blank', 'noopener');
            this.updateStatus('Opening Gmail compose...');
        } catch (_) {
            this.updateStatus('Could not open Gmail. Copying content...');
            try { navigator.clipboard.writeText(`${subject}\n\n${body}`); } catch(_){ }
        }
        this.hideFeedback();
    }

    copyFeedbackDetails() {
        const type = (document.getElementById('feedbackType')?.value || 'Feedback').trim();
        const subjectInput = (document.getElementById('feedbackSubject')?.value || '').trim();
        const message = (document.getElementById('feedbackText')?.value || '').trim();
        const subject = subjectInput || `${type} - CueAI`;
        const versionText = document.querySelector('.version')?.textContent || 'v1.x';
        const ctx = [
            `Mode: ${this.currentMode}`,
            `Music: ${this.musicEnabled ? 'on' : 'off'}, SFX: ${this.sfxEnabled ? 'on' : 'off'}`,
            `Mood: ${Math.round(this.moodBias*100)}%`,
            `URL: ${location.href}`,
            `App: ${versionText}`,
            `UA: ${navigator.userAgent}`
        ].join('\n');
        const body = `${subject}\n\n${message}\n\n---\nContext\n${ctx}`;
        try {
            navigator.clipboard.writeText(body);
            this.updateStatus('Feedback details copied to clipboard');
            alert('Copied! Paste this into your email to: aaroncue92@gmail.com');
        } catch (_) {
            this.updateStatus('Copy failed.');
        }
    }

    hideTutorial() {
        document.getElementById('tutorialModal').classList.add('hidden');
    }
    
    saveAudioKeys() {
        const freesoundInput = document.getElementById('freesoundKeyInput');
        const pixabayInput = document.getElementById('pixabayKeyInput');
        const freesoundKey = freesoundInput.value.trim();
        const pixabayKey = pixabayInput.value.trim();
        
        let saved = false;
        
        if (freesoundKey.length > 10) {
            this.freesoundApiKey = freesoundKey;
            setFreesoundKey(freesoundKey); // Use centralized setter
            saved = true;
        }
        
        if (pixabayKey.length > 10) {
            this.pixabayApiKey = pixabayKey;
            setPixabayKey(pixabayKey);
            saved = true;
        }
        
        if (saved) {
            this.hideFreesoundSetup();
            this.updateApiStatusIndicators();
            const sources = [];
            if (pixabayKey) sources.push('Pixabay');
            if (freesoundKey) sources.push('Freesound');
            this.updateStatus(`Audio sources enabled: ${sources.join(' + ')}`);
            alert(`Audio Keys Saved!\n\nEnabled: ${sources.join(', ')}\n\nYou will now hear high-quality sounds when CueAI analyzes your speech.`);
        } else {
            alert('Please enter at least one valid API key (10+ characters).');
        }
    }
    
    // ===== EVENT LISTENERS =====
    setupEventListeners() {
        // API Key
        document.getElementById('saveApiKey').addEventListener('click', () => this.saveApiKey());
        document.getElementById('resetApiKey').addEventListener('click', () => this.resetApiKey());
        
        // Mode Selection (Dropdown)
        const modeDropdown = document.getElementById('modeDropdown');
        if (modeDropdown) {
            modeDropdown.addEventListener('change', (e) => this.selectMode(e.target.value));
        }
        
        // Legacy mode buttons (if still present)
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectMode(e.target.dataset.mode));
        });
        
        // Volume Controls
        document.getElementById('minVolume').addEventListener('input', (e) => {
            this.minVolume = e.target.value / 100;
            document.getElementById('minVolumeValue').textContent = e.target.value;
        });
        
        document.getElementById('maxVolume').addEventListener('input', (e) => {
            this.maxVolume = e.target.value / 100;
            document.getElementById('maxVolumeValue').textContent = e.target.value;
        });

        // Mixer Controls
        const musicLevelSlider = document.getElementById('musicLevel');
        const sfxLevelSlider = document.getElementById('sfxLevel');
        if (musicLevelSlider) {
            musicLevelSlider.value = Math.round(this.musicLevel * 100);
            const musicLevelValue = document.getElementById('musicLevelValue');
            if (musicLevelValue) musicLevelValue.textContent = musicLevelSlider.value;
            musicLevelSlider.addEventListener('input', (e) => {
                this.musicLevel = e.target.value / 100;
                localStorage.setItem('cueai_music_level', String(this.musicLevel));
                if (musicLevelValue) musicLevelValue.textContent = e.target.value;
                // Apply to current music (Howler or legacy Web Audio)
                if (this.currentMusic && this.currentMusic._howl) {
                    const target = Math.max(0, Math.min(1, this.currentMusic.volume * this.musicLevel));
                    this.currentMusic._howl.volume(target);
                } else if (this.musicGainNode) {
                    const target = this.getMusicTargetGain();
                    try {
                        this.musicGainNode.gain.setValueAtTime(target, this.audioContext.currentTime);
                    } catch (_) {}
                }
                this.updateSoundsList();
            });
        }
        if (sfxLevelSlider) {
            sfxLevelSlider.value = Math.round(this.sfxLevel * 100);
            const sfxLevelValue = document.getElementById('sfxLevelValue');
            if (sfxLevelValue) sfxLevelValue.textContent = sfxLevelSlider.value;
            sfxLevelSlider.addEventListener('input', (e) => {
                this.sfxLevel = e.target.value / 100;
                localStorage.setItem('cueai_sfx_level', String(this.sfxLevel));
                if (sfxLevelValue) sfxLevelValue.textContent = e.target.value;
                // Update all active SFX (Howler or legacy)
                this.activeSounds.forEach((soundObj) => {
                    if (soundObj._howl && typeof soundObj.originalVolume === 'number') {
                        const newVol = Math.max(0, Math.min(1, soundObj.originalVolume * this.sfxLevel));
                        soundObj._howl.volume(newVol);
                    } else if (soundObj.gainNode && typeof soundObj.originalVolume === 'number') {
                        soundObj.gainNode.gain.setValueAtTime(
                            Math.max(0, Math.min(1, soundObj.originalVolume * this.sfxLevel)),
                            this.audioContext.currentTime
                        );
                    } else if (soundObj instanceof HTMLAudioElement && typeof soundObj.originalVolume === 'number') {
                        soundObj.volume = Math.max(0, Math.min(1, soundObj.originalVolume * this.sfxLevel));
                    }
                });
                this.updateSoundsList();
            });
        }

        // Mood slider & Low latency toggle
        const moodSlider = document.getElementById('moodBias');
        const moodValue = document.getElementById('moodBiasValue');
        if (moodSlider) {
            moodSlider.value = Math.round(this.moodBias * 100);
            if (moodValue) moodValue.textContent = moodSlider.value;
            moodSlider.addEventListener('input', (e) => {
                this.moodBias = e.target.value / 100;
                localStorage.setItem('cueai_mood_bias', String(this.moodBias));
                if (moodValue) moodValue.textContent = e.target.value;
            });
        }
        const lowLatencyToggle = document.getElementById('lowLatencyMode');
        if (lowLatencyToggle) {
            lowLatencyToggle.checked = !!this.lowLatencyMode;
            lowLatencyToggle.addEventListener('change', (e) => {
                this.lowLatencyMode = e.target.checked;
                localStorage.setItem('cueai_low_latency', JSON.stringify(this.lowLatencyMode));
                this.preloadConcurrency = this.getPreloadConcurrency();
                this.updateStatus(`Low Latency Mode ${this.lowLatencyMode ? 'enabled' : 'disabled'}`);
            });
        }
        // Low Latency tooltip interactions (hover via CSS; add touch/keyboard support)
        const ttLabel = document.getElementById('lowLatencyTooltip');
        const ttHelp = document.getElementById('lowLatencyHelp');
        const showTip = () => ttLabel && ttLabel.classList.add('show');
        const hideTip = () => ttLabel && ttLabel.classList.remove('show');
        if (ttHelp) {
            ttHelp.addEventListener('click', (e) => {
                e.preventDefault();
                if (ttLabel.classList.contains('show')) hideTip(); else showTip();
            });
        }
        
        // Control Buttons
        document.getElementById('testMicBtn').addEventListener('click', () => this.testMicrophone());
        document.getElementById('startBtn').addEventListener('click', () => this.startListening());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopListening());
        const stopAudioBtn = document.getElementById('stopAudioBtn');
        if (stopAudioBtn) {
            stopAudioBtn.addEventListener('click', () => this.stopAllAudio());
        }
        
        // Playback toggles
    const toggleMusic = document.getElementById('toggleMusic');
    const toggleSfx = document.getElementById('toggleSfx');
    const toggleSaved = document.getElementById('toggleSaved');
    const togglePrediction = document.getElementById('togglePrediction');
        if (toggleMusic) {
            toggleMusic.checked = !!this.musicEnabled;
            toggleMusic.addEventListener('change', (e) => {
                this.musicEnabled = e.target.checked;
                localStorage.setItem('cueai_music_enabled', JSON.stringify(this.musicEnabled));
                this.updateStatus(`Music ${this.musicEnabled ? 'enabled' : 'disabled'}`);
                if (!this.musicEnabled && this.currentMusic) {
                    this.fadeOutAudio(this.currentMusic);
                    this.currentMusic = null;
                    if (this.currentMusicSource) {
                        try { this.currentMusicSource.disconnect(); } catch (e) {}
                        this.currentMusicSource = null;
                    }
                    this.updateSoundsList();
                }
            });
        }
        if (toggleSfx) {
            toggleSfx.checked = !!this.sfxEnabled;
            toggleSfx.addEventListener('change', (e) => {
                this.sfxEnabled = e.target.checked;
                localStorage.setItem('cueai_sfx_enabled', JSON.stringify(this.sfxEnabled));
                this.updateStatus(`Sound effects ${this.sfxEnabled ? 'enabled' : 'disabled'}`);
                if (!this.sfxEnabled && this.activeSounds.size > 0) {
                    this.activeSounds.forEach((soundObj) => {
                        try { if (soundObj.source) soundObj.source.stop(); } catch (err) {}
                    });
                    this.activeSounds.clear();
                    this.updateSoundsList();
                }
            });
        }
        if (toggleSaved) {
            // Initialize toggle state
            const host = location.hostname || '';
            const isLocal = location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1';
            const isPages = /github\.io$/i.test(host);
            toggleSaved.disabled = false; // Always enable the toggle
            toggleSaved.checked = !!this.userSavedSoundsPref;
            toggleSaved.addEventListener('change', (e) => {
                this.userSavedSoundsPref = e.target.checked;
                localStorage.setItem('cueai_saved_sounds_enabled', JSON.stringify(this.userSavedSoundsPref));
                const wasEnabled = this.savedSoundsEnabled;
                // If enabling, re-load manifest to pick up any new files
                if (this.userSavedSoundsPref) {
                    this.loadSavedSounds().catch(()=>{});
                } else {
                    this.savedSoundsEnabled = false;
                }
                // Compute current enabled state (may be updated by loadSavedSounds async)
                this.savedSoundsEnabled = (this.savedSounds.files.length > 0 && !!this.userSavedSoundsPref);
                this.updateStatus(`Saved sounds ${this.savedSoundsEnabled ? 'enabled' : 'disabled'}`);
            });
        }

        // AI Predictions toggle
        if (togglePrediction) {
            togglePrediction.checked = !!this.predictionEnabled; // default OFF unless previously enabled
            togglePrediction.addEventListener('change', (e) => {
                this.predictionEnabled = e.target.checked;
                localStorage.setItem('cueai_prediction_enabled', JSON.stringify(this.predictionEnabled));
                this.updateStatus(`AI predictions ${this.predictionEnabled ? 'enabled' : 'disabled'}`);
                // Manage timers while listening
                if (!this.predictionEnabled) {
                    if (this.analysisTimer) { clearInterval(this.analysisTimer); this.analysisTimer = null; }
                    if (this.stingerTimer) { clearTimeout(this.stingerTimer); this.stingerTimer = null; }
                } else {
                    if (this.isListening && !this.analysisTimer) {
                        this.lastAnalysisTime = 0;
                        this.analysisTimer = setInterval(() => this.maybeAnalyzeLive(), 1000);
                    }
                    if (this.isListening && this.currentMusic && !this.currentMusic.paused) {
                        this.scheduleNextStinger();
                    }
                }
            });
        }
        
        // Freesound Setup
        document.getElementById('setupFreesound').addEventListener('click', () => this.showFreesoundSetup());
        document.getElementById('saveAudioKeys').addEventListener('click', () => this.saveAudioKeys());
        document.getElementById('cancelFreesound').addEventListener('click', () => this.hideFreesoundSetup());

    // Tutorial
        document.getElementById('tutorialBtn').addEventListener('click', () => this.showTutorial());
        document.getElementById('closeTutorial').addEventListener('click', () => this.hideTutorial());
        document.getElementById('closeTutorialBtn').addEventListener('click', () => this.hideTutorial());

    // Feedback modal
    const feedbackBtn = document.getElementById('feedbackBtn');
    if (feedbackBtn) feedbackBtn.addEventListener('click', () => this.showFeedback());
    const sendFeedbackBtn = document.getElementById('sendFeedbackBtn');
    if (sendFeedbackBtn) sendFeedbackBtn.addEventListener('click', () => this.sendFeedbackEmail());
    const openGmailBtn = document.getElementById('openGmailBtn');
    if (openGmailBtn) openGmailBtn.addEventListener('click', () => this.openFeedbackInGmail());
    const copyFeedbackBtn = document.getElementById('copyFeedbackBtn');
    if (copyFeedbackBtn) copyFeedbackBtn.addEventListener('click', () => this.copyFeedbackDetails());
    const cancelFeedback = document.getElementById('cancelFeedback');
    if (cancelFeedback) cancelFeedback.addEventListener('click', () => this.hideFeedback());

        // Stories UI
        const startStoryBtn = document.getElementById('startStoryBtn');
        const storiesDropdown = document.getElementById('storiesDropdown');
        const closeStory = document.getElementById('closeStory');
        if (startStoryBtn && storiesDropdown) {
            startStoryBtn.addEventListener('click', () => {
                const id = storiesDropdown.value;
                if (!id) { this.updateStatus('Please choose a story first'); return; }
                // Ensure stories manifest loaded
                if (!this.stories) {
                    this.loadStories().finally(() => this.startStoryFlow(id));
                } else {
                    this.startStoryFlow(id);
                }
            });
        }
        if (closeStory) {
            closeStory.addEventListener('click', () => this.hideStoryOverlay());
        }
        // Auto-start story listening toggle
        const autoStartStoryToggle = document.getElementById('autoStartStoryListening');
        if (autoStartStoryToggle) {
            autoStartStoryToggle.checked = !!this.autoStartStoryListening;
            autoStartStoryToggle.addEventListener('change', (e) => {
                this.autoStartStoryListening = e.target.checked;
                localStorage.setItem('cueai_auto_start_story_listening', JSON.stringify(this.autoStartStoryListening));
            });
        }
        // ESC to close story overlay
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.storyActive) {
                this.hideStoryOverlay();
            }
        });
    }

    startStoryFlow(id) {
        // Auto-switch to Bedtime mode for stories and wait for preload to complete
        this.startStoryFlowAsync(id).catch(()=>{});
    }

    async startStoryFlowAsync(id) {
        let needWait = false;
        let waitToken = this.preloadVersion;

        // Switch to bedtime only if not already
        if (this.currentMode !== 'bedtime') {
            try { 
                const before = this.preloadVersion;
                this.selectMode('bedtime'); 
                const after = this.preloadVersion;
                if (after !== before) { needWait = true; waitToken = after; }
            } catch(_) {}
        } else if (this.preloadInProgress) {
            needWait = true; waitToken = this.preloadVersion;
        }

        // If a preload is in progress for bedtime, wait briefly for it to finish
        if (needWait) {
            await this.waitForPreloadComplete(waitToken, 15000); // up to 15s safety
        }

        // Show story overlay after preload completes (or timeout)
        this.showStoryOverlay(id);
        if (this.autoStartStoryListening && !this.isListening) {
            this.startListening();
        }
    }

    async waitForPreloadComplete(versionToken, timeoutMs = 12000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            if (!this.preloadInProgress && this.preloadVersion === versionToken) return true;
            await this.sleep(120);
        }
        return false; // timed out
    }

    sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    
    selectMode(mode) {
        this.currentMode = mode;
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        this.updateStatus(`Mode changed to: ${mode.toUpperCase()}`);
        // Update mode and UI state
        this.currentMode = mode;
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

    // Reset AI/run state so previous mode's context doesn't leak
        this.analysisVersion++;          // invalidate any in-flight analyses
        this.lastAnalysisTime = 0;       // allow immediate fresh analysis
        this.analysisInProgress = false; // best-effort cancel gate

        // Clear transcript and interim text (chat log)
        this.transcriptBuffer = [];
        this.currentInterim = '';
        this.updateTranscriptDisplay();

    // Clear caches to avoid repeating previous selections
    this.soundCache.clear();
    this.recentlyPlayed.clear();

        // Stop any currently playing audio immediately
        this.stopAllAudio();

        // Update UI/status and begin preload with overlay
        this.updateStatus(`Mode changed to: ${mode.toUpperCase()} — reset sounds and context.`);
        const version = ++this.preloadVersion;
        this.showLoadingOverlay(`Preparing sounds for ${mode.toUpperCase()}...`);
        setTimeout(() => {
            this.preloadSfxForCurrentMode(version)
                .catch(e => console.log('Preload error:', e?.message || e))
                .finally(() => {
                    // Only hide if the same preload version is current
                    if (this.preloadVersion === version) {
                        this.hideLoadingOverlay();
                    }
                });
        }, 200);
    }
    
    // ===== AUDIO CONTEXT =====
    initializeAudioContext() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create gain nodes for mixing and ducking
        this.masterGainNode = this.audioContext.createGain();
        this.musicGainNode = this.audioContext.createGain();
        // SFX bus with light compression
        this.sfxCompressor = this.audioContext.createDynamicsCompressor();
        this.sfxCompressor.threshold.value = -24;
        this.sfxCompressor.knee.value = 30;
        this.sfxCompressor.ratio.value = 3;
        this.sfxCompressor.attack.value = 0.01;
        this.sfxCompressor.release.value = 0.2;
        this.sfxBusGain = this.audioContext.createGain();
        
        // Create analyser for visualizer
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        
        // Audio graph:
        // music -> musicGain -> master -> analyser -> destination
        // sfx (per-source) -> panner -> gain -> sfxCompressor -> sfxBusGain -> master
        this.musicGainNode.connect(this.masterGainNode);
        this.sfxCompressor.connect(this.sfxBusGain);
        this.sfxBusGain.connect(this.masterGainNode);
        this.masterGainNode.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
    }
    
    // ===== SPEECH RECOGNITION =====
    initializeSpeechRecognition() {
        // Feature detection with UI feedback
        if (!isSpeechRecognitionAvailable()) {
            this.updateStatus('⚠️ Speech recognition not supported in this browser. Please use Chrome/Edge or connect to backend STT.', 'error');
            console.warn('Speech recognition not available');
            return;
        }
        
        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';
            this.recognition.maxAlternatives = 1;
            
            this.recognition.onresult = (event) => this.handleSpeechResult(event);
            this.recognition.onerror = (event) => this.handleSpeechError(event);
            this.recognition.onend = () => {
                if (this.isListening) {
                    // Add small delay before restart to avoid rapid cycling
                    setTimeout(() => {
                        if (this.isListening) {
                            try {
                                this.recognition.start();
                            } catch (e) {
                                console.log('Recognition restart skipped:', e.message);
                            }
                        }
                    }, 100);
                }
            };
            
            this.recognition.onstart = () => {
                console.log('Speech recognition started');
                this.updateStatus('Listening... Speak clearly!');
            };
            
            this.recognition.onaudiostart = () => {
                console.log('Audio input detected');
            };
            
            this.recognition.onsoundstart = () => {
                console.log('Sound detected');
            };
            
            this.recognition.onspeechstart = () => {
                console.log('Speech detected');
                this.updateStatus('I hear you. Keep talking...');
            };
        } catch (error) {
            console.error('Failed to initialize speech recognition:', error);
            this.updateStatus('⚠️ Failed to initialize speech recognition. Check console for details.', 'error');
        }
    }
    
    handleSpeechResult(event) {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }
        
        if (finalTranscript) {
            this.transcriptBuffer.push(finalTranscript.trim());
            this.currentInterim = '';
            this.updateTranscriptDisplay();
            // Advance story highlighting on finalized phrases
            this.advanceStoryWithTranscript(finalTranscript);
            
                // Voice commands & instant triggers
                this.handleVoiceCommands(finalTranscript);
                this.checkInstantKeywords(finalTranscript);
            
            // Keep only last 30 seconds of transcript (approx 150 words)
            if (this.transcriptBuffer.length > 50) {
                this.transcriptBuffer.shift();
            }
            
            // Consider analysis on final chunks
            this.maybeAnalyzeLive();
        } else if (interimTranscript) {
            // Track interim text continuously
            this.currentInterim = interimTranscript.trim();
            this.updateTranscriptDisplay();
            // Soft-advance story highlighting on interim to keep pace while reading
            this.advanceStoryWithTranscript(interimTranscript);
            
                // Also check interim for instant triggers and predictive prefetch
                this.checkInstantKeywords(interimTranscript);
                this.predictivePrefetch(interimTranscript);
            
            this.maybeAnalyzeLive();
        }
    }
    
    handleSpeechError(event) {
        console.error('Speech recognition error:', event.error);
        
        if (event.error === 'no-speech') {
            // This is normal - just means no speech in current window
            // Don't spam the user with messages
            return;
        } else if (event.error === 'audio-capture') {
            this.updateStatus('Microphone access denied or not available');
            this.stopListening();
        } else if (event.error === 'not-allowed') {
            this.updateStatus('Please allow microphone access in browser settings');
            this.stopListening();
        } else if (event.error === 'network') {
            // Network error - try to continue listening
            this.updateStatus('Network hiccup - continuing to listen...');
            // Don't stop - the recognition will auto-restart
        } else {
            this.updateStatus(`Recognition error: ${event.error}`);
        }
    }
    
    updateTranscriptDisplay() {
        const transcriptBox = document.getElementById('transcript');
        const recentText = this.transcriptBuffer.slice(-5).join(' ');
        const display = [recentText, this.currentInterim].filter(Boolean).join(' ');
        transcriptBox.textContent = display || 'Listening...';
        transcriptBox.scrollTop = transcriptBox.scrollHeight;
    }
    
        // ===== INSTANT KEYWORD DETECTION =====
        checkInstantKeywords(text) {
            if ((!this.freesoundApiKey && !this.pixabayApiKey) || !text || !this.sfxEnabled) return;
        
            const lowerText = text.toLowerCase();
        
            // Check each keyword
            for (const [keyword, config] of Object.entries(this.instantKeywords)) {
                // Use word boundaries to avoid partial matches
                const regex = new RegExp(`\\b${keyword}\\b`, 'i');
                if (regex.test(lowerText)) {
                    console.log(`Instant trigger detected: "${keyword}"`);
                    // Play sound immediately without waiting for AI analysis
                    this.playInstantSound(config);
                    // Only trigger one sound per check to avoid chaos
                    break;
                }
            }
        }
    
        async playInstantSound(config) {
                // Reuse unified SFX path to benefit from cooldown logic
                await this.playSoundEffect({ query: config.query, priority: 10, volume: config.volume });
        }
    
    // ===== AI CONTEXT ANALYSIS =====
    async analyzeContext(customTranscript = null) {
        const recentTranscript = (customTranscript ?? this.transcriptBuffer.slice(-10).join(' ')).trim();
        if (!recentTranscript) return;
        this.updateStatus('Analyzing context...');
        
        try {
            // Capture analysis version to avoid applying stale results after mode change
            const versionAtStart = this.analysisVersion;
            
            // Call centralized API service (from api.js)
            const response = await this.callBackendAnalyze(recentTranscript);
            
            // If mode changed during the async call, ignore this result
            if (this.analysisVersion !== versionAtStart) {
                console.log('Discarding stale analysis result after mode change');
                return;
            }

            if (response) {
                await this.processSoundDecisions(response);
            }
        } catch (error) {
            console.error('AI Analysis error:', error);
            this.updateStatus('⚠️ Analysis error. Check console for details.');
        }
    }
    
    async callBackendAnalyze(transcript) {
        // Build context for backend
        const context = {
            mode: this.currentMode,
            musicEnabled: this.musicEnabled,
            sfxEnabled: this.sfxEnabled,
            moodBias: this.moodBias,
            recentSounds: Array.from(this.recentlyPlayed).slice(-5),
            recentMusic: this.currentMusic?.dataset?.id || null
        };
        
        // Use centralized API service (from api.js)
        // This will try backend first, then fallback to client-side OpenAI if needed
        return await analyzeTranscript({
            transcript,
            mode: this.currentMode,
            context
        });
    }

    // Stop all audio immediately and clear tracking
    stopAllAudio() {
        // Cancel stingers
        if (this.stingerTimer) { clearTimeout(this.stingerTimer); this.stingerTimer = null; }

        // Hard stop via Howler global (stops any stray sounds not tracked)
        try {
            if (typeof Howler !== 'undefined') {
                Howler.stop();
            }
        } catch (_) {}

        // Stop and release music (Howler or legacy)
        if (this.currentMusic) {
            try {
                if (this.currentMusic._howl) {
                    this.currentMusic._howl.stop();
                    this.currentMusic._howl.unload();
                } else if (this.currentMusic.pause) {
                    this.currentMusic.pause();
                    this.currentMusic.currentTime = 0;
                    this.currentMusic.src = '';
                    this.currentMusic.load();
                }
            } catch(_) {}
            this.currentMusic = null;
        }
        if (this.currentMusicSource) {
            try { this.currentMusicSource.disconnect(); } catch (_) {}
            this.currentMusicSource = null;
        }

        // Stop all active SFX (Howler or legacy Web Audio/HTMLAudioElement)
        this.activeSounds.forEach((soundObj) => {
            try {
                if (soundObj._howl) {
                    soundObj._howl.stop();
                    soundObj._howl.unload();
                } else if (soundObj.source) {
                    // Web Audio buffer source path
                    try { soundObj.source.stop(); } catch(_) {}
                    try { soundObj.source.disconnect(); } catch(_) {}
                    try { soundObj.panner && soundObj.panner.disconnect(); } catch(_) {}
                    try { soundObj.gainNode && soundObj.gainNode.disconnect(); } catch(_) {}
                } else if (soundObj.pause) {
                    // HTMLAudioElement path
                    soundObj.pause();
                    soundObj.currentTime = 0;
                    try { soundObj.src = ''; soundObj.load(); } catch(_) {}
                }
            } catch (_) {}
        });
        this.activeSounds.clear();

        // Also stop any audio started via the cueAudio wrapper (safety net)
        try { cueAudio.stopAll && cueAudio.stopAll(); } catch(_) {}

        // Extra safety: unload all Howler instances to prevent loops
        try {
            if (typeof Howler !== 'undefined' && Array.isArray(Howler._howls)) {
                Howler._howls.forEach(h => { try { h.stop(); h.unload(); } catch(_) {} });
            }
        } catch (_) {}

        // Clear any queued sounds if used
        if (Array.isArray(this.soundQueue)) this.soundQueue.length = 0;

        // Reflect empty state in UI
        this.updateSoundsList();
    }

    maybeAnalyzeLive() {
        if (!this.predictionEnabled) return;
        const now = Date.now();
        if (this.analysisInProgress) return;
        if (now - this.lastAnalysisTime < this.analysisInterval) return;
        const contextText = [
            this.transcriptBuffer.slice(-10).join(' '),
            this.currentInterim
        ].filter(Boolean).join(' ').trim();
        if (contextText.length < 8) return;
        this.lastAnalysisTime = now;
        this.analysisInProgress = true;
        this.analyzeContext(contextText)
            .catch(err => console.error('Live analysis failed:', err))
            .finally(() => {
                this.analysisInProgress = false;
            });
    }
    
    buildAnalysisPrompt(transcript) {
        const modeContext = {
            bedtime: 'soothing bedtime story with calm, gentle atmosphere',
            dnd: 'Dungeons & Dragons campaign with fantasy adventure elements',
            horror: 'horror storytelling with tense, eerie, suspenseful atmosphere',
            christmas: 'festive Christmas storytelling with joyful, magical, winter holiday atmosphere',
            halloween: 'spooky Halloween atmosphere with playful scares, autumn vibes, and trick-or-treat energy',
            sing: 'live singing performance - match musical accompaniment, harmonies, and effects to the vocals',
            auto: 'any context - detect the mood and setting automatically'
        };
        
        const modeSpecificRules = {
            bedtime: '- For bedtime mode: ambient context sounds OK (crickets at night, gentle wind, soft fire); but ONE-OFF actions (dog bark, door knock, footsteps) ONLY play once when mentioned, never repeat',
            dnd: '- For D&D mode: ambient context sounds OK (tavern crowd, wind in cave, crackling torch); but ONE-OFF actions (sword clash, arrow shot, door slam) play ONLY when explicitly mentioned, never repeat',
            horror: '- For horror mode: ambient context sounds OK (wind, distant thunder, creaking house); but ONE-OFF actions (scream, door slam, footsteps) ONLY when explicitly mentioned, never repeat',
            christmas: '- For Christmas mode: ambient context sounds OK (jingle bells ambience, crackling fire, wind); music query MUST include "christmas" or "jingle bells"; ONE-OFF actions play once only',
            halloween: '- For Halloween mode: ambient context sounds OK (wind, owl hoot, distant chains); ONE-OFF actions (cackle, howl, door creak) play once when mentioned, never repeat',
            sing: '- For Sing mode: listen to melody, tempo, and genre; provide complementary instrumental backing, harmonies, and rhythmic effects; change music only if song style shifts; SFX sparingly for explicit vocal cues only',
            auto: '- Ambient context sounds OK when setting is clear (crickets at night, wind in storm); ONE-OFF actions (dog bark, knock, crash) ONLY when user mentions them, never repeat'
        };

        const moodPct = Math.round(this.moodBias * 100);
        
    return `You are an intelligent audio companion for ${modeContext[this.currentMode]}.

User playback preferences:
- music_enabled: ${this.musicEnabled}
- sfx_enabled: ${this.sfxEnabled}
- user_mood_bias_percent: ${moodPct} (0=calm, 100=intense) — bias intensity and sound choices accordingly.
If music_enabled is false, set music to null and do not propose any music changes.
If sfx_enabled is false, set sfx to an empty array and do not propose any sound effects.

Analyze this spoken text and decide what sounds/music to play:
"${transcript}"

Return ONLY a JSON object (no markdown, no explanation) with this structure:
{
    "music": {
        "query": "search term for background music" OR null,
        "mood": "calm/epic/tense/mysterious/joyful/dark",
        "intensity": 0.3-1.0,
        "change": true/false (only true if scene shifts dramatically; keep false for same atmosphere)
    },
    "sfx": [
        {"query": "specific sound effect", "priority": 1-10, "volume": 0.3-1.0}
    ],
    "reasoning": "one sentence why"
}

Rules:
- Music should be ambient/instrumental only and STABLE (change: false unless scene dramatically shifts)
- Music is long-term atmosphere; only suggest change: true for major scene transitions
- SFX categories:
  * AMBIENT/CONTEXT sounds: OK to suggest based on setting (e.g., crickets at night, wind in storm, crackling fire)
  * ONE-OFF ACTION sounds: ONLY play ONCE when user mentions them (e.g., "dog barked" → one bark; do NOT repeat)
- Do NOT repeat one-off action sounds (dog bark, door knock, scream, footsteps) multiple times unless the user explicitly says it happens again
- Return max 2 SFX per analysis
- If nothing new is happening, return empty array for sfx
${modeSpecificRules[this.currentMode]}`;
    }
    
    async callOpenAI(prompt) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: 'system',
                        content: 'You are a JSON-only audio decision engine. Always return valid JSON with the exact structure requested.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 300
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            
            if (response.status === 429) {
                this.updateStatus('OpenAI rate limit reached. Please check your API quota.');
                console.error('Rate limit details:', errorData);
                alert('OpenAI API Rate Limit Exceeded!\n\nPossible issues:\n1. Free tier quota exhausted\n2. No billing setup on OpenAI account\n3. Too many requests\n\nSolutions:\n• Visit platform.openai.com/account/billing\n• Add payment method\n• Check usage at platform.openai.com/account/usage\n• Wait a few minutes and try again');
            } else if (response.status === 401) {
                this.updateStatus('Invalid API key. Please reset and try again.');
                alert('Invalid OpenAI API Key!\n\nPlease:\n1. Click "Reset API Key"\n2. Get a new key from platform.openai.com/api-keys\n3. Ensure billing is set up');
            }
            
            throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }
        
        const data = await response.json();
        const content = data.choices[0].message.content.trim();
        
        // Remove markdown code blocks if present
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        
        return JSON.parse(content);
    }
    
    
    
    // ===== SOUND DECISION ENGINE =====
    async processSoundDecisions(decisions) {
        console.log('Sound Decisions:', decisions);
        // Respect AI prediction toggle: do not auto-play when disabled
        if (!this.predictionEnabled) { return; }
        
        // Stop long-running SFX from previous context (scene change)
        // Keep only very short SFX (< 2s) or looping ambient effects
        const now = Date.now();
        this.activeSounds.forEach((soundObj, id) => {
            if (soundObj.type === 'sfx') {
                const age = now - (soundObj.startTime || now);
                // If SFX has been playing for more than 2 seconds, fade it out
                if (age > 2000) {
                    try {
                        if (soundObj._howl) {
                            soundObj._howl.fade(soundObj._howl.volume(), 0, 300);
                            setTimeout(() => {
                                try { soundObj._howl.stop(); soundObj._howl.unload(); } catch(_) {}
                                this.activeSounds.delete(id);
                            }, 350);
                        }
                    } catch(_) {}
                }
            }
        });
        
        // Handle Music (backend returns { id, action, volume })
        if (this.musicEnabled && decisions.music && decisions.music.id) {
            await this.updateMusicById(decisions.music);
        }
        
        // Handle Sound Effects (backend returns [{ id, when, volume }])
        if (this.sfxEnabled && decisions.sfx && decisions.sfx.length > 0) {
            for (const sfx of decisions.sfx) {
                await this.playSoundEffectById(sfx);
            }
        }
        
    this.updateStatus(`${decisions.scene || 'Playing sounds...'}`);
    }
    
    async updateMusicById(musicData) {
        if (!this.musicEnabled) {
            this.updateStatus('Music disabled (toggle off)');
            return;
        }
        
        // Find sound in catalog
        const sound = this.soundCatalog.find(s => s.id === musicData.id);
        if (!sound) {
            console.warn('Music ID not found in catalog:', musicData.id);
            return;
        }
        
        // Don't change if same music already playing and action is "play_or_continue"
        if (musicData.action === 'play_or_continue' && 
            this.currentMusic && 
            this.currentMusic.dataset?.id === musicData.id) {
            console.log('Music already playing, continuing:', musicData.id);
            return;
        }
        
        // Build full URL
        let soundUrl;
        if (sound.src.startsWith('http://') || sound.src.startsWith('https://')) {
            // Absolute URL (CDN, external source)
            soundUrl = sound.src;
        } else {
            // Relative URL (hosted on backend)
            soundUrl = `${this.backendUrl}${sound.src}`;
        }
        
        // Apply volume with mood bias
        const moodMul = 0.85 + this.moodBias * 0.3;
        const baseVol = musicData.volume || 0.5;
        const effectiveVol = Math.max(0, Math.min(1, baseVol * moodMul * this.musicLevel));
        
        await this.playAudio(soundUrl, {
            type: 'music',
            name: sound.id,
            volume: effectiveVol,
            loop: sound.loop || true,
            id: sound.id
        });
        
        // Start stingers scheduling
        this.scheduleNextStinger();
    }
    
    // Legacy updateMusic for fallback (Freesound/Saved Sounds)
    async updateMusic(musicData) {
        if (!this.musicEnabled) {
            this.updateStatus('Music disabled (toggle off)');
            return;
        }
        // Only change music if AI explicitly says to (change: true) or if no music playing
        if (!musicData.change && this.currentMusic && !this.currentMusic.paused) {
            console.log('Music stable, not changing (change: false)');
            return;
        }
        
        // Don't change music too frequently
        if (this.currentMusic && this.currentMusic.dataset.query === musicData.query) {
            return;
        }
        
        // Search and crossfade to new music
        const soundUrl = await this.searchAudio(musicData.query, 'music');
        if (soundUrl) {
            this.currentMusicBase = this.calculateVolume(musicData.intensity || 0.5);
            // Mood bias: scale base a bit by mood (calm -> less, intense -> more)
            const moodMul = 0.85 + this.moodBias * 0.3;
            const base = Math.max(0, Math.min(1, this.currentMusicBase * moodMul));
            const effectiveVol = Math.max(0, Math.min(1, base * this.musicLevel));
            await this.playAudio(soundUrl, {
                type: 'music',
                name: musicData.query,
                volume: effectiveVol,
                loop: true
            });
            // Start stingers scheduling
            this.scheduleNextStinger();
        }
    }
    
    async playSoundEffectById(sfxData) {
        if (!this.sfxEnabled) {
            this.updateStatus('SFX disabled (toggle off)');
            return;
        }
        // Limit simultaneous sounds
        if (this.activeSounds.size >= this.maxSimultaneousSounds) {
            return;
        }
        
        // Find sound in catalog
        const sound = this.soundCatalog.find(s => s.id === sfxData.id);
        if (!sound) {
            console.warn('SFX ID not found in catalog:', sfxData.id);
            return;
        }
        
        // Cooldown to prevent rapid repeats of the same effect
        const bucket = this.getSfxBucket(sfxData.id);
        const now = Date.now();
        const nextAllowed = this.sfxCooldowns.get(bucket) || 0;
        if (now < nextAllowed) {
            // Skip duplicate within cooldown window
            return;
        }
        
        // Build full URL
        let soundUrl;
        if (sound.src.startsWith('http://') || sound.src.startsWith('https://')) {
            // Absolute URL (CDN, external source)
            soundUrl = sound.src;
        } else {
            // Relative URL (hosted on backend)
            soundUrl = `${this.backendUrl}${sound.src}`;
        }
        
        // Apply volume with SFX level
        const effectiveVol = Math.max(0, Math.min(1, (sfxData.volume || 0.7) * this.sfxLevel));
        
        const played = await this.playAudio(soundUrl, {
            type: 'sfx',
            name: sound.id,
            volume: effectiveVol,
            loop: false,
            id: sound.id
        });
        
        if (played) {
            // Start cooldown for this bucket
            this.sfxCooldowns.set(bucket, Date.now() + this.sfxCooldownMs);
        }
    }
    
    // Legacy playSoundEffect for fallback (Freesound/Saved Sounds)
    async playSoundEffect(sfxData) {
        if (!this.sfxEnabled) {
            this.updateStatus('SFX disabled (toggle off)');
            return;
        }
        // Limit simultaneous sounds
        if (this.activeSounds.size >= this.maxSimultaneousSounds) {
            return;
        }
        // Cooldown to prevent rapid repeats of the same effect
        const bucket = this.getSfxBucket(sfxData.query || '');
        const now = Date.now();
        const nextAllowed = this.sfxCooldowns.get(bucket) || 0;
        if (now < nextAllowed) {
            // Skip duplicate within cooldown window
            return;
        }
        
        const soundUrl = await this.searchAudio(sfxData.query, 'sfx');
        if (soundUrl) {
            const played = await this.playAudio(soundUrl, {
                type: 'sfx',
                name: sfxData.query,
                volume: this.calculateVolume(sfxData.volume || 0.7),
                loop: false
            });
            if (played) {
                // Start cooldown for this bucket
                this.sfxCooldowns.set(bucket, Date.now() + this.sfxCooldownMs);
            }
        }
    }

    // Normalize and bucket SFX queries so variants like "door creak" and "door slam" share cooldown
    getSfxBucket(query) {
        const q = (query || '').toLowerCase();
        if (q.includes('door')) return 'door';
        if (q.includes('footstep')) return 'footsteps';
        if (q.includes('whoosh') || q.includes('wind')) return 'wind';
        if (q.includes('wolf') && q.includes('howl')) return 'wolf-howl';
        if (q.includes('jingle') || q.includes('bell')) return 'bells';
        if (q.includes('thunder')) return 'thunder';
        if (q.includes('creak')) return 'creak';
        if (q.includes('knock')) return 'knock';
        // Fallback to normalized query as its own bucket
        return q.replace(/\s+/g,' ').trim();
    }
    
    // ===== PIXABAY INTEGRATION =====
    async searchPixabay(query, type) {
        // Note: Pixabay's free API doesn't include a dedicated audio endpoint
        // We'll use it for future expansion or premium tier
        // For now, this serves as a placeholder that gracefully falls back to Freesound
        
        if (!this.pixabayApiKey) return null;
        
        try {
            // Pixabay audio API is not available in free tier
            // This would be the endpoint if/when audio becomes available:
            // https://pixabay.com/api/sounds/
            
            console.log('Pixabay audio API not available in free tier; using Freesound');
            return null;
            
        } catch (error) {
            console.error('Pixabay search error:', error);
            return null;
        }
    }

    // ===== DUAL-SOURCE AUDIO SEARCH =====
    async searchAudio(query, type) {
        // Try local Saved sounds first (dev/local only)
        if (this.savedSoundsEnabled) {
            const local = this.searchLocalSaved(query, type);
            if (local) {
                // Seed cache so prefetch checks can skip repeated lookups
                try { this.soundCache.set(`${type}:${query}`, local); } catch (_) {}
                return local;
            }
        }
        // Try Pixabay first if key is set (faster when available)
        // Note: Currently falls back immediately as free tier has no audio
        let url = null;
        
        if (this.pixabayApiKey) {
            url = await this.searchPixabay(query, type);
            if (url) {
                console.log(`✓ Found via Pixabay: ${query}`);
                return url;
            }
        }
        
        // Freesound is primary source (comprehensive library)
        if (this.freesoundApiKey) {
            url = await this.searchFreesound(query, type);
            if (url) {
                console.log(`✓ Found via Freesound: ${query}`);
                return url;
            }
        }
        
        if (!this.pixabayApiKey && !this.freesoundApiKey) {
            console.log('No audio API keys configured. Click "Setup Audio Sources" to enable sounds.');
        }
        
        return url;
    }

    // ===== LOCAL SAVED SOUNDS =====
    searchLocalSaved(query, type) {
        try {
            if (!this.savedSoundsEnabled || !this.savedSounds?.files?.length) return null;
            const norm = (s) => String(s||'').toLowerCase().replace(/[-_]/g,' ').replace(/\s+/g,' ').trim();
            const base = norm(query);
            if (!base) return null;
            
            // Build expanded token set with synonyms
            const tokens = base.split(' ').filter(Boolean);
            const expand = new Set(tokens);
            tokens.forEach(t=>{
                if (t.startsWith('footstep')) expand.add('footsteps');
                if (t === 'bark' || t === 'woof') { expand.add('dog'); expand.add('bark'); }
                if (t === 'howl') { expand.add('wolf'); expand.add('dog'); }
                if (t === 'creak' || t === 'squeak') { expand.add('door'); expand.add('wood'); expand.add('creak'); }
                if (t === 'door') expand.add('creak');
                if (t === 'whoosh' || t === 'swish') expand.add('wind');
                if (t === 'lightning') expand.add('thunder');
                if (t === 'meow') expand.add('cat');
                if (t === 'explosion' || t === 'boom') { expand.add('blast'); expand.add('bang'); }
                if (t === 'scream' || t === 'yell') { expand.add('woman'); expand.add('horror'); }
                if (t === 'monster' || t === 'zombie') { expand.add('growl'); expand.add('undead'); }
                // New creature synonyms
                if (t === 'ogre' || t === 'troll' || t === 'orc' || t === 'goblin' || t === 'beast') { expand.add('monster'); expand.add('creature'); }
                // Vocalization synonyms
                if (t === 'roar' || t === 'snarl' || t === 'growl') { expand.add('growl'); expand.add('roar'); }
                // Weapon synonyms
                if (t === 'blade' || t === 'steel') { expand.add('sword'); expand.add('metal'); }
                // Movement synonyms
                if (t === 'steps' || t === 'walking') { expand.add('footsteps'); }
                if (t === 'gallop' || t === 'galloping' || t === 'trot' || t === 'trotting') { expand.add('horse'); expand.add('galloping'); }
            });
            const exTokens = Array.from(expand);
            
            const candidates = this.savedSounds.files.filter(f => f.type === (type === 'music' ? 'music' : 'sfx'));
            let best = null, bestScore = 0;
            
            for (const f of candidates) {
                const hay = norm([
                    f.name || '',
                    f.file || '',
                    ...(Array.isArray(f.keywords) ? f.keywords : [])
                ].join(' '));
                
                let score = 0;
                // Token matching
                for (const t of exTokens) {
                    if (t && hay.includes(t)) score += 1;
                }
                // Phrase boost
                if (hay.includes(base)) score += 2;
                // Category bonus for common patterns
                if (type === 'sfx') {
                    if (/footstep|walk/.test(hay) && /footstep|walk/.test(base)) score += 0.5;
                    if (/dog|bark/.test(hay) && /dog|bark|woof/.test(base)) score += 0.5;
                    if (/explosion|blast|boom/.test(hay) && /explosion|boom|bang|blast/.test(base)) score += 0.5;
                }
                if (type === 'music' && /music|christmas|ambient|piano/.test(hay)) score += 0.5;
                
                if (score > bestScore) { best = f; bestScore = score; }
            }
            
            if (best && bestScore >= 1) {
                const url = encodeURI(best.file);
                console.log(`✓ Found via Saved sounds: ${query} -> ${best.name} (score: ${bestScore})`);
                return url;
            }
            return null;
        } catch(_) { return null; }
    }

    // ===== FREESOUND.ORG INTEGRATION =====
    async searchFreesound(query, type) {
        // Check if Freesound API key is set
        if (!this.freesoundApiKey) {
            console.log(`Freesound not configured. Would search for: ${query} (${type})`);
            this.updateStatus('Click "Setup Freesound API" to enable real sounds');
            return null;
        }
        
        // Simplify queries to improve CC0 results
        let searchQuery = query;
        let fallbackQueries = []; // Progressive fallbacks for music
        if (type === 'music') {
            const keywords = query.toLowerCase();
            // Check for Christmas-related terms (including "jingle bells" from AI)
            if (keywords.includes('christmas') || keywords.includes('holiday') || keywords.includes('festive') || 
                keywords.includes('xmas') || keywords.includes('jingle') || keywords.includes('carol') || 
                keywords.includes('sleigh')) {
                searchQuery = 'christmas music';
                fallbackQueries = ['jingle bells', 'holiday music', 'festive music', 'winter music'];
            }
            else if (keywords.includes('halloween') || keywords.includes('spooky')) {
                searchQuery = 'spooky halloween';
                fallbackQueries = ['halloween music', 'spooky music'];
            }
            else if (keywords.includes('epic') || keywords.includes('orchestral')) {
                searchQuery = 'epic orchestral';
                fallbackQueries = ['orchestral', 'epic music'];
            }
            else if (keywords.includes('calm') || keywords.includes('peaceful')) {
                searchQuery = 'calm ambient';
                fallbackQueries = ['peaceful music', 'ambient music'];
            }
            else if (keywords.includes('tense') || keywords.includes('suspense')) {
                searchQuery = 'dark ambient';
                fallbackQueries = ['suspense music', 'ambient music'];
            }
            else if (keywords.includes('horror') || keywords.includes('eerie')) {
                searchQuery = 'horror ambience';
                fallbackQueries = ['dark ambient', 'ambient music'];
            }
            else if (keywords.includes('forest') || keywords.includes('nature')) {
                searchQuery = 'nature ambient';
                fallbackQueries = ['ambient music'];
            }
            else if (keywords.includes('sing') || keywords.includes('vocal') || keywords.includes('melody')) {
                searchQuery = 'instrumental backing';
                fallbackQueries = ['instrumental', 'ambient music'];
            }
            else if (keywords.includes('ambient')) {
                searchQuery = 'ambient music';
                fallbackQueries = [];
            }
            else {
                searchQuery = 'ambient music';
                fallbackQueries = [];
            }
            console.log(`Simplified music query: "${query}" → "${searchQuery}"${fallbackQueries.length ? ` (fallbacks: ${fallbackQueries.join(', ')})` : ''}`);
        } else if (type === 'sfx') {
            // Simplify common SFX queries that often fail
            const keywords = query.toLowerCase();
            if (keywords.includes('footsteps') && keywords.includes('leaves')) searchQuery = 'footsteps grass';
            else if (keywords.includes('dragon') && keywords.includes('roar')) searchQuery = 'monster roar';
            else if (keywords.includes('birds') && keywords.includes('chirp')) searchQuery = 'birds chirping';
            else if (keywords.includes('storm') && keywords.includes('brewing')) searchQuery = 'thunder storm';
            else searchQuery = query; // keep original for SFX
            
            if (searchQuery !== query) {
                console.log(`Simplified SFX query: "${query}" → "${searchQuery}"`);
            }
        }
        
            // Check cache first for faster response
        const cacheKey = `${type}:${searchQuery}`;
            if (this.soundCache.has(cacheKey)) {
            console.log(`Found in cache: ${searchQuery}`);
            return this.soundCache.get(cacheKey);
        }
        
        try {
            this.updateStatus(`Searching Freesound for: ${searchQuery}...`);
            
            // Build search parameters with CC0 license filter
            const baseFilter = type === 'music' ? 'duration:[30 TO *] tag:music' : 'duration:[0.5 TO 10]';
            const params = new URLSearchParams({
                query: searchQuery,
                filter: `${baseFilter} license:\"Creative Commons 0\"`,
                fields: 'id,name,previews,duration,license',
                sort: 'rating_desc',
                page_size: type === 'music' ? 10 : 3
            });
            
            const response = await fetch(`https://freesound.org/apiv2/search/text/?${params}`, {
                headers: {
                    'Authorization': `Token ${this.freesoundApiKey}`
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    this.updateStatus('❌ Invalid Freesound API key');
                    alert('Invalid Freesound API Key!\n\nPlease:\n1. Check your key at freesound.org/apiv2/apply\n2. Click "Setup Freesound API"\n3. Enter the correct key');
                    return null;
                }
                throw new Error(`Freesound API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                // Try to select a preview that hasn't played recently (for variety)
                let chosen = null;
                for (const r of data.results) {
                    const url = r.previews['preview-hq-mp3'] || r.previews['preview-lq-mp3'];
                    if (!url) continue;
                    if (type === 'music' && this.recentlyPlayed.has(url)) {
                        continue; // try to avoid repeats for music
                    }
                    chosen = { name: r.name, duration: r.duration, url };
                    break;
                }
                // Fallback to the first if all are recently played or filtered out
                if (!chosen) {
                    const r = data.results[0];
                    const url = r.previews['preview-hq-mp3'] || r.previews['preview-lq-mp3'];
                    chosen = { name: r.name, duration: r.duration, url };
                }

                console.log(`Found sound: "${chosen.name}" (${chosen.duration}s)`);

                    // Cache all sounds for instant playback on repeat
                    this.soundCache.set(cacheKey, chosen.url);

                // Track recently played to reduce back-to-back repeats
                if (chosen.url) {
                    this.recentlyPlayed.add(chosen.url);
                    // Keep recent list to a reasonable size
                    if (this.recentlyPlayed.size > 20) {
                        const first = this.recentlyPlayed.values().next().value;
                        this.recentlyPlayed.delete(first);
                    }
                }

                return chosen.url;
            } else {
                console.log(`No CC0 sounds found for: ${searchQuery}`);
                
                // For music, try fallback with broader license (CC-BY) and progressive fallback queries
                if (type === 'music') {
                    const queriesToTry = [searchQuery, ...fallbackQueries];
                    
                    for (const tryQuery of queriesToTry) {
                        console.log(`Retrying music search with CC-BY for: "${tryQuery}"...`);
                        const fallbackParams = new URLSearchParams({
                            query: tryQuery,
                            filter: `duration:[30 TO *] tag:music`,
                            fields: 'id,name,previews,duration,license',
                            sort: 'rating_desc',
                            page_size: 10
                        });
                        
                        const fallbackResponse = await fetch(`https://freesound.org/apiv2/search/text/?${fallbackParams}`, {
                            headers: {
                                'Authorization': `Token ${this.freesoundApiKey}`
                            }
                        });
                        
                        if (fallbackResponse.ok) {
                            const fallbackData = await fallbackResponse.json();
                            if (fallbackData.results && fallbackData.results.length > 0) {
                                const r = fallbackData.results[0];
                                const url = r.previews['preview-hq-mp3'] || r.previews['preview-lq-mp3'];
                                if (url) {
                                    console.log(`✓ Found music (${r.license}): "${r.name}" (${r.duration}s)`);
                                    this.soundCache.set(cacheKey, url);
                                    this.recentlyPlayed.add(url);
                                    return url;
                                }
                            }
                        }
                    }
                    
                    console.log(`No music found after all fallbacks`);
                }
                
                return null;
            }
            
        } catch (error) {
            console.error('Freesound search error:', error);
            this.updateStatus('Freesound search failed, retrying...');
            return null;
        }
    }
    
    // ===== AUDIO PLAYBACK =====
    
    // Duck music volume when SFX plays
    duckMusic(duration = 0.6) {
        if (this.duckingInProgress) return;
        if (!this.currentMusic || !this.currentMusic._howl) return;
        
        const p = this.getDuckParams();
        this.duckingInProgress = true;
        
        const howl = this.currentMusic._howl;
        const currentVol = howl.volume();
        const floorMul = Math.max(0.08, Math.min(1, p.floor));
        const duckTo = Math.max(0.01, currentVol * floorMul);
        
        // Duck down
        howl.fade(currentVol, duckTo, p.attack * 1000);
        
        // Duck back up after hold + duration
        setTimeout(() => {
            howl.fade(duckTo, currentVol, p.release * 1000);
            setTimeout(() => { this.duckingInProgress = false; }, p.release * 1000);
        }, (p.attack + p.hold + duration) * 1000);
    }

    getDuckParams() {
        // Bias ducking based on mood: more intense => deeper duck and slightly longer release
        const m = this.moodBias; // 0..1
        return {
            attack: this.duckParams.attack,
            hold: this.duckParams.hold,
            release: this.duckParams.release + m * 0.1,
            floor: this.duckParams.floor * (0.8 + (1 - m) * 0.4) // calmer => less deep duck
        };
    }
    
    async playAudio(url, options) {
        if (!url) return null;
        
        try {
            // For SFX, try to use Web Audio API with decoded buffers for better performance
            if (options.type === 'sfx') {
                return await this.playSFXBuffer(url, options);
            } else {
                // For music, use HTMLAudioElement (better for streaming long files)
                return await this.playMusicElement(url, options);
            }
        } catch (error) {
            console.error('Audio playback error:', error);
            this.updateStatus('⚠️ Audio playback error - sound may be blocked');
            return null;
        }
    }
    
    async playSFXBuffer(url, options) {
        // Duck music when playing SFX
        this.duckMusic(0.6);
        
        // Use Howler for SFX with spatial positioning
        const original = Math.max(0, Math.min(1, options.volume));
        const effective = Math.max(0, Math.min(1, original * this.sfxLevel));
        
        // Random stereo positioning for variety
        const az = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5);
        
        const howl = new Howl({
            src: [url],
            volume: effective,
            stereo: az, // -1 (left) to 1 (right)
            onload: () => console.log(`SFX loaded: ${options.name}`),
            onloaderror: (id, err) => {
                console.error('SFX load error:', options.name, err);
                this.updateStatus(`Failed to load sound: ${options.name}`, 'error');
            },
            onplayerror: (id, err) => {
                console.error('SFX play error:', options.name, err);
                this.updateStatus(`Failed to play sound: ${options.name}`, 'error');
            },
            onend: () => {
                this.activeSounds.delete(id);
                this.updateSoundsList();
                howl.unload();
            }
        });
        
        const soundId = howl.play();
        const id = Date.now() + Math.random();
        this.activeSounds.set(id, { 
            _howl: howl, 
            soundId, 
            name: options.name, 
            originalVolume: original, 
            type: 'sfx',
            startTime: Date.now() // Track when SFX started for age-based cleanup
        });
        
        console.log(`Playing SFX: ${options.name} at ${Math.round(effective * 100)}%`);
        this.updateSoundsList();
        
        // Prefetch alternates to diversify repeats
        this.prefetchAlternates(options.name).catch(()=>{});
        
        return { _howl: howl, soundId, name: options.name };
    }
    
    async playSFXElement(url, options) {
        // Fallback for SFX when Web Audio buffer fails
        this.duckMusic(0.6);
        
        const audio = new Audio(url);
        // Apply normalization if known
        const norm = this.sfxNormGains.get(url) ?? 1;
        // Store original volume and apply user SFX level and normalization
        audio.originalVolume = Math.max(0, Math.min(1, options.volume));
        audio.volume = Math.max(0, Math.min(1, audio.originalVolume * norm * this.sfxLevel));
        audio.crossOrigin = "anonymous";
        
        await audio.play();
        console.log(`Playing SFX element: ${options.name} at ${Math.round(options.volume * 100)}%`);
        
        const id = Date.now() + Math.random();
        this.activeSounds.set(id, audio);
        audio.onended = () => {
            this.activeSounds.delete(id);
            this.updateSoundsList();
        };
        
        this.updateSoundsList();
        return audio;
    }
    
    async playMusicElement(url, options) {
        const targetVol = options.volume;
        const oldHowl = this.currentMusic;

        // Fade out old music
        if (oldHowl && oldHowl._howl) {
            oldHowl._howl.fade(oldHowl._howl.volume(), 0, 600);
            setTimeout(() => {
                try { oldHowl._howl.stop(); oldHowl._howl.unload(); } catch(_){}
            }, 650);
        }

        // Create new Howl instance for music
        const newHowl = new Howl({
            src: [url],
            html5: true, // stream for long music files
            loop: !!options.loop,
            volume: 0,
            onload: () => console.log(`Music loaded: ${options.name}`),
            onloaderror: (id, err) => {
                console.error('Music load error:', options.name, err);
                this.updateStatus(`Failed to load music: ${options.name}`, 'error');
            },
            onplayerror: (id, err) => {
                console.error('Music play error:', options.name, err);
                this.updateStatus(`Failed to play music: ${options.name}`, 'error');
            }
        });

        newHowl.play();
        newHowl.fade(0, targetVol, 600);

        // Store reference with metadata
        this.currentMusic = { _howl: newHowl, name: options.name, type: options.type, volume: targetVol };
        this.updateSoundsList();
        return this.currentMusic;
    }
    
    fadeOutAudio(audio, ms = 300) {
        if (!audio) return;
        if (audio._howl) {
            audio._howl.fade(audio._howl.volume(), 0, ms);
            setTimeout(() => {
                try { audio._howl.stop(); audio._howl.unload(); } catch(_){}
            }, ms + 50);
        } else if (audio.pause) {
            // Legacy HTMLAudioElement fallback
            const steps = 12;
            const stepTime = Math.max(10, Math.round(ms / steps));
            let i = 0;
            const startVol = audio.volume || 1;
            const timer = setInterval(() => {
                i++;
                const t = i / steps;
                audio.volume = Math.max(0, startVol * (1 - t));
                if (i >= steps) { clearInterval(timer); try { audio.pause(); } catch(_){} }
            }, stepTime);
        }
    }
    
    calculateVolume(intensity) {
        return this.minVolume + (intensity * (this.maxVolume - this.minVolume));
    }

    getMusicTargetGain() {
        const moodMul = 0.85 + this.moodBias * 0.3; // modest bias
        return Math.max(0, Math.min(1, (this.currentMusicBase || 0.5) * moodMul * this.musicLevel));
    }

    computeNormalizationGain(buffer) {
        try {
            const chData = buffer.getChannelData(0);
            let sumSq = 0;
            const len = chData.length;
            const stride = Math.max(1, Math.floor(len / 48000)); // sample up to ~48k points
            let count = 0;
            for (let i = 0; i < len; i += stride) { const v = chData[i]; sumSq += v * v; count++; }
            const rms = Math.sqrt(sumSq / Math.max(1, count));
            const targetRMS = 0.1; // ~-20 dBFS perceived
            if (!isFinite(rms) || rms <= 0) return 1;
            const gain = targetRMS / rms;
            // Clamp normalization to avoid extreme boosts
            return Math.max(0.5, Math.min(2.5, gain));
        } catch (_) { return 1; }
    }
    
    updateSoundsList() {
        const container = document.getElementById('currentSounds');
        container.innerHTML = '';
        
        // Add music (Howler or legacy)
        if (this.currentMusic) {
            const playing = this.currentMusic._howl ? this.currentMusic._howl.playing() : (!this.currentMusic.paused);
            if (playing) {
                const item = document.createElement('div');
                item.className = 'sound-item';
                const vol = this.currentMusic._howl ? 
                    Math.round(this.currentMusic._howl.volume() * 100) :
                    Math.round((this.currentMusic.volume || 1) * 100);
                const name = this.currentMusic.name || (this.currentMusic.dataset ? this.currentMusic.dataset.name : 'Unknown');
                item.innerHTML = `
                    <span class="sound-type">Music</span>
                    <span class="sound-name">${name}</span>
                    <span class="sound-volume">${vol}%</span>
                `;
                container.appendChild(item);
            }
        }
        
        // Add SFX (Howler or legacy)
        this.activeSounds.forEach((soundObj) => {
            const item = document.createElement('div');
            item.className = 'sound-item';
            const name = soundObj.name || (soundObj.dataset ? soundObj.dataset.name : 'Unknown');
            let volume = 50;
            if (soundObj._howl) {
                volume = Math.round(soundObj._howl.volume() * 100);
            } else if (soundObj.gainNode) {
                volume = Math.round(soundObj.gainNode.gain.value * 100);
            } else if (soundObj.volume !== undefined) {
                volume = Math.round(soundObj.volume * 100);
            }
            
            item.innerHTML = `
                <span class="sound-type">SFX</span>
                <span class="sound-name">${name}</span>
                <span class="sound-volume">${volume}%</span>
            `;
            container.appendChild(item);
        });
        
        if (container.children.length === 0) {
            container.innerHTML = '<div class="sound-item inactive">No sounds playing</div>';
        }
    }
    
    // ===== VISUALIZER =====
    setupVisualizer() {
        this.canvas = document.getElementById('visualizer');
        this.canvasCtx = this.canvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    }
    
    startVisualizer() {
        const draw = () => {
            this.visualizerAnimationId = requestAnimationFrame(draw);
            
            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            this.analyser.getByteFrequencyData(dataArray);
            
            this.canvasCtx.fillStyle = '#000';
            this.canvasCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            const barWidth = (this.canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 255) * this.canvas.height * 0.8;
                
                const gradient = this.canvasCtx.createLinearGradient(0, this.canvas.height, 0, 0);
                gradient.addColorStop(0, '#8a2be2');
                gradient.addColorStop(0.5, '#bb86fc');
                gradient.addColorStop(1, '#03dac6');
                
                this.canvasCtx.fillStyle = gradient;
                this.canvasCtx.fillRect(x, this.canvas.height - barHeight, barWidth, barHeight);
                
                x += barWidth + 1;
            }
        };
        
        draw();
    }
    
    stopVisualizer() {
        if (this.visualizerAnimationId) {
            cancelAnimationFrame(this.visualizerAnimationId);
        }
    }
    
    // ===== CONTROL METHODS =====
    async testMicrophone() {
    this.updateStatus('Testing microphone access...');
        
        try {
            // Request microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Create audio context to test volume
            const testContext = new AudioContext();
            const source = testContext.createMediaStreamSource(stream);
            const testAnalyser = testContext.createAnalyser();
            testAnalyser.fftSize = 256;
            source.connect(testAnalyser);
            
            const dataArray = new Uint8Array(testAnalyser.frequencyBinCount);
            
            let testDuration = 0;
            const testInterval = setInterval(() => {
                testAnalyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                
                if (average > 5) {
                    this.updateStatus(`Microphone working. Volume: ${Math.round(average)}/255`);
                } else {
                    this.updateStatus(`Microphone detected. Please speak... (${Math.round(average)}/255)`);
                }
                
                testDuration++;
                if (testDuration > 50) { // 5 seconds
                    clearInterval(testInterval);
                    stream.getTracks().forEach(track => track.stop());
                    testContext.close();
                    this.updateStatus('Microphone test complete. You can now start listening.');
                }
            }, 100);
            
        } catch (error) {
            console.error('Microphone test failed:', error);
            
            if (error.name === 'NotAllowedError') {
                this.updateStatus('Microphone access denied. Please check browser permissions.');
                alert('Microphone Permission Denied!\n\nTo fix:\n1. Click the site information icon in the address bar\n2. Set Microphone to "Allow"\n3. Refresh the page\n4. Try again');
            } else if (error.name === 'NotFoundError') {
                this.updateStatus('No microphone found. Please connect a microphone.');
            } else {
                this.updateStatus('Microphone test failed: ' + error.message);
            }
        }
    }
    
    async startListening() {
        // Check for API key
        const apiKey = getOpenAIKey();
        if (!apiKey) {
            this.updateStatus('⚠️ Please set your OpenAI API key first', 'error');
            return;
        }
        
        // Check if speech recognition is available
        if (!this.recognition) {
            this.updateStatus('⚠️ Speech recognition not initialized. Please use a supported browser.', 'error');
            return;
        }
        
        this.isListening = true;
        
        // Resume audio context if suspended (browser requirement)
        if (this.audioContext && this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
            } catch (error) {
                console.error('Failed to resume audio context:', error);
            }
        }
        
        // Update UI first
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const visualizerSection = document.querySelector('.visualizer-section');
        
        if (startBtn) startBtn.classList.add('hidden');
        if (stopBtn) stopBtn.classList.remove('hidden');
        if (visualizerSection) visualizerSection.classList.add('listening');
        
        // Start visualizer
        this.startVisualizer();
        
        // Start speech recognition
        try {
            this.recognition.start();
            this.updateStatus('Requesting microphone... Please speak!');
            
            // Add helpful tip after 3 seconds if no speech detected
            setTimeout(() => {
                if (this.isListening && this.transcriptBuffer.length === 0) {
                    this.updateStatus('Tip: Speak clearly and close to your microphone');
                }
            }, 3000);
            
            // Start periodic live analysis while listening (only if predictions enabled)
            if (this.analysisTimer) clearInterval(this.analysisTimer);
            this.lastAnalysisTime = 0;
            if (this.predictionEnabled) {
                this.analysisTimer = setInterval(() => this.maybeAnalyzeLive(), 1000); // Check every second for faster response
            }
            
        } catch (error) {
            console.error('Failed to start recognition:', error);
            
            if (error.message && error.message.includes('already started')) {
                // Recognition already running, that's fine
                this.updateStatus('Listening... Speak clearly!');
            } else {
                this.updateStatus('⚠️ Failed to start speech recognition. Check microphone permissions and browser compatibility.', 'error');
                this.isListening = false;
                this.stopListening();
            }
        }

        // Begin preloading likely SFX shortly after starting (non-blocking, no overlay here)
        const version = ++this.preloadVersion;
        setTimeout(() => this.preloadSfxForCurrentMode(version), 300);
    }
    
    stopListening() {
        this.isListening = false;
        this.currentInterim = '';
        if (this.analysisTimer) {
            clearInterval(this.analysisTimer);
            this.analysisTimer = null;
        }
        
        // Stop speech recognition
        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (error) {
                console.log('Error stopping recognition:', error);
            }
        }
        
        // Stop all audio completely
        if (this.currentMusic) {
            try {
                if (this.currentMusic.pause) {
                    this.currentMusic.pause();
                }
                if (this.currentMusic.currentTime !== undefined) {
                    this.currentMusic.currentTime = 0;
                }
            } catch (e) {
                console.log('Error stopping music:', e);
            }
            this.currentMusic = null;
        }
        
        if (this.currentMusicSource) {
            try {
                this.currentMusicSource.disconnect();
            } catch (e) {}
            this.currentMusicSource = null;
        }
        
        this.activeSounds.forEach(soundObj => {
            try {
                if (soundObj.source) {
                    // Web Audio buffer source
                    soundObj.source.stop();
                } else if (soundObj.pause) {
                    // HTMLAudioElement
                    soundObj.pause();
                    soundObj.currentTime = 0;
                }
            } catch (e) {
                console.log('Error stopping sound:', e);
            }
        });
        this.activeSounds.clear();
        
        // Update UI
        document.getElementById('startBtn').classList.remove('hidden');
        document.getElementById('stopBtn').classList.add('hidden');
        document.querySelector('.visualizer-section').classList.remove('listening');
        
        // Stop visualizer
        this.stopVisualizer();
        
        // Clear canvas
        this.canvasCtx.fillStyle = '#000';
        this.canvasCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.updateStatus('Stopped. Ready to listen again.');
        this.updateSoundsList();
    }
    
    /**
     * Update status message with optional level for visual feedback
     * @param {string} message - Status message to display
     * @param {string} level - Level: 'info' (default), 'error', 'warning', 'success'
     */
    updateStatus(message, level = 'info') {
        const statusEl = document.getElementById('statusText');
        if (!statusEl) {
            console.warn('statusText element not found');
            console.log('Status:', message);
            return;
        }
        
        statusEl.textContent = message;
        
        // Remove previous level classes
        statusEl.classList.remove('status-info', 'status-error', 'status-warning', 'status-success');
        
        // Add appropriate class based on level
        statusEl.classList.add(`status-${level}`);
        
        // Log with appropriate console method
        switch (level) {
            case 'error':
                console.error('Status:', message);
                break;
            case 'warning':
                console.warn('Status:', message);
                break;
            case 'success':
                console.log('✓ Status:', message);
                break;
            default:
                console.log('Status:', message);
        }
    }

    // ===== VOICE COMMANDS =====
    handleVoiceCommands(text) {
        const t = text.toLowerCase();
        let handled = false;
        const say = (msg) => this.updateStatus(msg);
        if (/\b(skip|next) (track|song|music)\b/.test(t)) {
            // Force music change by setting change true with same query to refetch
            if (this.currentMusic) { this.fadeOutAudio(this.currentMusic, 300); }
            this.updateStatus('Skipping track...');
            handled = true;
        }
        if (/\bquieter music\b|\bturn (the )?music down\b/.test(t)) {
            this.musicLevel = Math.max(0, this.musicLevel - 0.1);
            localStorage.setItem('cueai_music_level', String(this.musicLevel));
            say(`Music level: ${Math.round(this.musicLevel*100)}%`);
            const target = this.getMusicTargetGain();
            try { this.musicGainNode.gain.setValueAtTime(target, this.audioContext.currentTime); } catch(_){}
            handled = true;
        }
        if (/\blower (the )?music\b|\bquieter\b/.test(t)) {
            // already covered
        }
        if (/\blouder music\b|\bturn (the )?music up\b/.test(t)) {
            this.musicLevel = Math.min(1, this.musicLevel + 0.1);
            localStorage.setItem('cueai_music_level', String(this.musicLevel));
            say(`Music level: ${Math.round(this.musicLevel*100)}%`);
            const target = this.getMusicTargetGain();
            try { this.musicGainNode.gain.setValueAtTime(target, this.audioContext.currentTime); } catch(_){}
            handled = true;
        }
        if (/\bmute sfx\b|\bmute sound effects\b/.test(t)) {
            this.sfxEnabled = false; localStorage.setItem('cueai_sfx_enabled', 'false'); say('Sound effects muted'); handled = true;
        }
        if (/\bunmute sfx\b|\bunmute sound effects\b/.test(t)) {
            this.sfxEnabled = true; localStorage.setItem('cueai_sfx_enabled', 'true'); say('Sound effects unmuted'); handled = true;
        }
        if (/\bmute music\b/.test(t)) {
            this.musicEnabled = false; localStorage.setItem('cueai_music_enabled', 'false'); if (this.currentMusic) this.fadeOutAudio(this.currentMusic, 250); say('Music muted'); handled = true;
        }
        if (/\bunmute music\b/.test(t)) {
            this.musicEnabled = true; localStorage.setItem('cueai_music_enabled', 'true'); say('Music unmuted'); handled = true;
        }
        const modeMatch = t.match(/\bswitch to (horror|christmas|halloween|dnd|bedtime|sing|auto)\b/);
        if (modeMatch) { this.selectMode(modeMatch[1]); handled = true; }
        return handled;
    }

    // ===== PREDICTIVE PREFETCH =====
    predictivePrefetch(text) {
        if (!this.freesoundApiKey || !this.sfxEnabled || !this.predictionEnabled) return;
        const t = text.toLowerCase();
        // simple debounce
        if (this._predictiveBusy) return; this._predictiveBusy = true; setTimeout(()=>{this._predictiveBusy=false;}, 400);
        const cues = [
            { k: /\bbark|woof\b/, q: 'dog bark' },
            { k: /\bknock|door\b/, q: 'door knock' },
            { k: /\bthunder|storm\b/, q: 'thunder' },
            { k: /\bfootsteps?\b/, q: 'footsteps' },
            { k: /\bcreak\b/, q: 'door creak' },
            { k: /\bwind|whoosh\b/, q: 'wind whoosh' },
        ];
        const toWarm = cues.filter(c => c.k.test(t)).map(c => c.q).slice(0,2);
        toWarm.forEach(async (q) => {
            const cacheKey = `sfx:${q}`;
            if (this.soundCache.has(cacheKey)) return; // already cached URL
            const url = await this.searchAudio(q, 'sfx');
            if (!url) return;
            if (!this.activeBuffers.has(url)) {
                try {
                    const resp = await fetch(url); const ab = await resp.arrayBuffer();
                    const buf = await this.audioContext.decodeAudioData(ab); this.activeBuffers.set(url, buf);
                } catch(_){}
            }
        });
    }

    // ===== PREFETCH ALTERNATES =====
    async prefetchAlternates(query) {
        if (!this.freesoundApiKey && !this.pixabayApiKey) return;
        const q = query.toLowerCase();
        const related = {
            'door creak': ['door squeak','wood creak'],
            'wind whoosh': ['wind howl','wind gust'],
            'footsteps': ['footsteps hallway','footsteps gravel'],
            'wolf howl': ['dog howl','coyote howl'],
            'witch cackle': ['creepy laugh','evil laugh'],
            'thunder': ['thunder rumble','lightning strike']
        };
        const alts = related[q] || [];
        for (const alt of alts.slice(0,2)) {
            const url = await this.searchAudio(alt, 'sfx');
            if (url && !this.activeBuffers.has(url)) {
                try { const resp = await fetch(url); const ab = await resp.arrayBuffer(); const buf = await this.audioContext.decodeAudioData(ab); this.activeBuffers.set(url, buf);} catch(_){}
            }
        }
    }

    // ===== STINGERS =====
    scheduleNextStinger() {
        if (!this.sfxEnabled || !this.predictionEnabled) return;
        if (this.stingerTimer) clearTimeout(this.stingerTimer);
        const interval = 20000 + Math.random() * 25000; // 20–45s
        this.stingerTimer = setTimeout(async () => {
            const stingerSet = this.getModeStingers();
            const choice = stingerSet[Math.floor(Math.random()*stingerSet.length)];
            const url = await this.searchAudio(choice, 'sfx');
            if (url) { await this.playAudio(url, { type:'sfx', name: choice, volume: this.calculateVolume(0.5), loop:false }); }
            this.scheduleNextStinger();
        }, interval);
    }

    getModeStingers() {
        const map = {
            bedtime: ['owl hoot','wind whoosh','fire crackling'],
            dnd: ['magic whoosh','coin jingle','torch crackle'],
            horror: ['whisper','heartbeat','radio static'],
            halloween: ['witch cackle','wolf howl','door creak'],
            christmas: ['jingle bells','bell chime','wind arctic'],
            sing: ['crowd cheer','applause','clap'],
            auto: ['wind whoosh','door creak','footsteps']
        };
        return map[this.currentMode] || map.auto;
    }

    // ===== SFX PRELOADING (expanded, concurrency-limited) =====
    async preloadSfxForCurrentMode(versionToken) {
        if ((!this.freesoundApiKey && !this.pixabayApiKey) || !this.sfxEnabled) return;
        if (this.preloadInProgress) return;
        const base = this.modePreloadSets[this.currentMode] || this.modePreloadSets.auto;
        const merged = [...new Set([...(base || []), ...this.genericPreloadSet])];
        const target = merged.slice(0, 20); // cap at 20
        if (target.length === 0) return;

        this.preloadInProgress = true;
        const startedAt = Date.now();
        try {
            const tasks = target.map(q => async () => {
                // Abort if mode changed during preload
                if (versionToken !== this.preloadVersion) return;
                const cacheKey = `sfx:${q}`;
                // If fully ready, skip
                if (this.soundCache.has(cacheKey)) {
                    const cachedUrl = this.soundCache.get(cacheKey);
                    if (cachedUrl && this.activeBuffers.has(cachedUrl)) return;
                }
                const url = await this.searchAudio(q, 'sfx');
                if (!url) return;
                try {
                    if (!this.activeBuffers.has(url)) {
                        const resp = await fetch(url);
                        const ab = await resp.arrayBuffer();
                        const buf = await this.audioContext.decodeAudioData(ab);
                        this.activeBuffers.set(url, buf);
                    }
                } catch (_) {
                    // Decoding may fail due to CORS; playback will fallback later
                }
            });

            await this.runWithConcurrency(tasks, this.getPreloadConcurrency());
            const elapsed = Date.now() - startedAt;
            this.updateStatus(`Prepared sounds (${target.length}) in ${Math.max(1, Math.round(elapsed/100)/10)}s`);
        } catch (e) {
            console.log('Preload failed:', e?.message || e);
        } finally {
            this.preloadInProgress = false;
        }
    }

    async runWithConcurrency(taskFns, limit = 5) {
        const queue = [...taskFns];
        const runners = new Array(Math.min(limit, queue.length)).fill(0).map(async () => {
            while (queue.length) {
                const fn = queue.shift();
                try { await fn(); } catch (_) {}
            }
        });
        await Promise.all(runners);
    }

    getPreloadConcurrency() {
        const conn = navigator.connection || navigator.webkitConnection || navigator.mozConnection;
        const effective = conn?.effectiveType || '4g';
        const base = this.lowLatencyMode ? 7 : 4;
        if (effective.includes('2g')) return Math.max(2, base - 2);
        if (effective.includes('3g')) return Math.max(3, base - 1);
        return base;
    }

    showLoadingOverlay(message = 'Preparing sounds...') {
        const overlay = document.getElementById('loadingOverlay');
        const msg = document.getElementById('loadingMessage');
        if (msg) msg.textContent = message;
        if (overlay) overlay.classList.remove('hidden');
    }

    hideLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.add('hidden');
    }

    updateApiStatusIndicators() {
        const openaiStatus = document.getElementById('openaiStatus');
        const freesoundStatus = document.getElementById('freesoundStatus');
        const pixabayStatus = document.getElementById('pixabayStatus');
        
        if (openaiStatus) {
            if (this.apiKey && this.apiKey.length > 10) {
                openaiStatus.className = 'api-status active';
                openaiStatus.setAttribute('aria-label', 'OpenAI API key is configured');
            } else {
                openaiStatus.className = 'api-status inactive';
                openaiStatus.setAttribute('aria-label', 'OpenAI API key is missing');
            }
        }
        
        if (freesoundStatus) {
            if (this.freesoundApiKey && this.freesoundApiKey.length > 10) {
                freesoundStatus.className = 'api-status active';
                freesoundStatus.setAttribute('aria-label', 'Freesound API key is configured');
            } else {
                freesoundStatus.className = 'api-status inactive';
                freesoundStatus.setAttribute('aria-label', 'Freesound API key is missing');
            }
        }
        
        if (pixabayStatus) {
            if (this.pixabayApiKey && this.pixabayApiKey.length > 10) {
                pixabayStatus.className = 'api-status active';
                pixabayStatus.setAttribute('aria-label', 'Pixabay API key is configured');
            } else {
                pixabayStatus.className = 'api-status inactive';
                pixabayStatus.setAttribute('aria-label', 'Pixabay API key is missing');
            }
        }
    }
}

// ===== INITIALIZE APP =====
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new CueAI();
    console.log('🎵 CueAI initialized successfully!');
});
