# 🔬 CueAI - Technical Implementation Notes

## Next Steps to Complete Full MVP

### 1. **Freesound.org Integration** (HIGH PRIORITY)

The current implementation has a placeholder for sound retrieval. To make it fully functional:

#### Option A: Freesound API (Free, but requires OAuth)
```javascript
// Replace searchFreesound() method with:
async searchFreesound(query, type) {
    const FREESOUND_API_KEY = 'YOUR_FREESOUND_API_KEY';
    const baseUrl = 'https://freesound.org/apiv2/search/text/';
    
    const params = new URLSearchParams({
        query: query,
        filter: type === 'music' ? 'duration:[30 TO *]' : 'duration:[0 TO 10]',
        fields: 'id,name,previews',
        sort: 'rating_desc',
        page_size: 1
    });
    
    try {
        const response = await fetch(`${baseUrl}?${params}&token=${FREESOUND_API_KEY}`);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            // Use preview-hq-mp3 for better quality
            return data.results[0].previews['preview-hq-mp3'];
        }
    } catch (error) {
        console.error('Freesound search error:', error);
    }
    
    return null;
}
```

**Get Freesound API Key:**
1. Go to https://freesound.org/apiv2/apply/
2. Create account and register API credentials
3. Use API key in code above

#### Option B: Pre-loaded Sound Library (Faster, No API limits)
```javascript
// Create a sounds.json manifest file
const SOUND_LIBRARY = {
    music: {
        'epic fantasy': 'sounds/music/epic-fantasy.mp3',
        'calm ambient': 'sounds/music/calm-ambient.mp3',
        'mysterious': 'sounds/music/mysterious.mp3'
    },
    sfx: {
        'sword clash': 'sounds/sfx/sword-clash.mp3',
        'thunder': 'sounds/sfx/thunder.mp3',
        'footsteps': 'sounds/sfx/footsteps.mp3',
        'crackling fire': 'sounds/sfx/fire.mp3'
    }
};

// Fuzzy matching for sound selection
searchFreesound(query, type) {
    const library = SOUND_LIBRARY[type];
    
    // Simple keyword matching
    for (const [key, url] of Object.entries(library)) {
        if (query.toLowerCase().includes(key) || key.includes(query.toLowerCase())) {
            return url;
        }
    }
    
    return null;
}
```

**Free Sound Resources:**
- https://freesound.org/ (Creative Commons)
- https://mixkit.co/free-sound-effects/ (Free)
- https://www.zapsplat.com/ (Free with attribution)

---

### 2. **Audio Context Fix for Multiple Sources**

Current issue: Can only connect one audio element to analyser. Fix:

```javascript
// In playAudio() method, create a gain node for each audio
async playAudio(url, options) {
    if (!url) return null;
    
    const audio = new Audio(url);
    audio.volume = 0; // Control via gainNode instead
    audio.loop = options.loop;
    audio.dataset.type = options.type;
    audio.dataset.name = options.name;
    
    // Create audio graph: Audio -> GainNode -> Analyser -> Destination
    const source = this.audioContext.createMediaElementSource(audio);
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = options.volume;
    
    source.connect(gainNode);
    gainNode.connect(this.analyser);
    
    // Store gain node for volume control
    audio.gainNode = gainNode;
    
    await audio.play();
    
    // ... rest of the method
}
```

---

### 3. **Better AI Prompt Engineering**

Improve sound decision quality:

```javascript
buildAnalysisPrompt(transcript) {
    return `You are an expert sound designer for interactive storytelling.

Context: ${this.currentMode} mode
Recent dialogue: "${transcript}"

Analyze and return ONLY valid JSON:
{
    "music": {
        "query": "2-4 word music description",
        "mood": "epic|calm|tense|mysterious|joyful|dark|suspenseful",
        "intensity": 0.3-1.0,
        "change": true/false (only change if scene shifts dramatically)
    },
    "sfx": [
        {
            "query": "specific sound (e.g., 'door creak', not 'door sound')",
            "timing": "immediate|delayed",
            "volume": 0.3-1.0,
            "priority": 1-10
        }
    ],
    "reasoning": "brief explanation"
}

Guidelines:
- Music: ambient instrumental only, should enhance not distract
- SFX: concrete, specific sounds (good: "sword unsheathing", bad: "combat")
- Bedtime mode: prioritize gentle, non-startling sounds
- D&D mode: match described actions and environment
- Auto mode: detect genre from context
- Don't add sounds if dialogue is just conversation
- Max 2 SFX per analysis to avoid chaos

Current mood/music: ${this.currentMusic ? this.currentMusic.dataset.name : 'none'}`;
}
```

---

### 4. **Performance Optimization**

#### Sound Caching
```javascript
// Add to constructor
this.soundLibrary = new Map();
this.preloadPopularSounds();

// Preload common sounds
async preloadPopularSounds() {
    const common = [
        'thunder', 'rain', 'fire', 'footsteps', 'door', 
        'sword', 'wind', 'ambient forest', 'calm music'
    ];
    
    for (const query of common) {
        const url = await this.searchFreesound(query, 'sfx');
        if (url) this.soundLibrary.set(query, url);
    }
}
```

#### Debouncing AI Calls
```javascript
// Add debounce to prevent rapid-fire API calls
let analysisTimeout = null;

handleSpeechResult(event) {
    // ... existing code ...
    
    if (finalTranscript) {
        this.transcriptBuffer.push(finalTranscript.trim());
        this.updateTranscriptDisplay();
        
        // Debounce: only analyze after 2s of no new speech
        clearTimeout(analysisTimeout);
        analysisTimeout = setTimeout(() => {
            this.analyzeContext();
        }, 2000);
    }
}
```

---

### 5. **Error Handling & Fallbacks**

```javascript
async callOpenAI(prompt) {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You are a JSON-only audio decision engine.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 300
            })
        });
        
        if (!response.ok) {
            if (response.status === 429) {
                this.updateStatus('⚠️ Rate limited. Slowing down...');
                this.analysisInterval = 8000; // Slow down
            } else if (response.status === 401) {
                this.updateStatus('❌ Invalid API key. Please reset.');
                return null;
            }
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        const content = data.choices[0].message.content.trim();
        
        // Robust JSON extraction
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        
        console.warn('No JSON found in response:', content);
        return null;
        
    } catch (error) {
        console.error('OpenAI call failed:', error);
        this.updateStatus('🔄 Analysis failed. Retrying...');
        return null;
    }
}
```

---

### 6. **Mobile/Android Considerations**

#### Service Worker for PWA
```javascript
// Create service-worker.js
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open('cueai-v1').then((cache) => {
            return cache.addAll([
                '/',
                '/index.html',
                '/styles.css',
                '/game.js',
                // Add preloaded sounds here
            ]);
        })
    );
});
```

#### Manifest for Android Install
```json
// manifest.json
{
    "name": "CueAI",
    "short_name": "CueAI",
    "description": "Intelligent Audio Companion",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#0a0a0a",
    "theme_color": "#8a2be2",
    "icons": [
        {
            "src": "icon-192.png",
            "sizes": "192x192",
            "type": "image/png"
        },
        {
            "src": "icon-512.png",
            "sizes": "512x512",
            "type": "image/png"
        }
    ]
}
```

---

### 7. **Testing Workflow**

#### Test Suite
```javascript
// test-scenarios.js
const TEST_SCENARIOS = {
    bedtime: [
        "Once upon a time in a peaceful forest, gentle rain began to fall",
        "The little bear yawned and snuggled into bed",
        "Suddenly, a soft lullaby filled the air"
    ],
    dnd: [
        "The barbarian charges forward with his battle axe raised",
        "Thunder crashes as the dragon unleashes a torrent of flame",
        "You enter a dark, musty tavern with creaking floorboards"
    ],
    auto: [
        "The spaceship's engines roared to life",
        "In the quiet library, pages rustled",
        "The crowd erupted in cheers"
    ]
};

// Run automated tests
async function runTests() {
    for (const [mode, scenarios] of Object.entries(TEST_SCENARIOS)) {
        app.selectMode(mode);
        for (const text of scenarios) {
            console.log(`Testing: ${text}`);
            app.transcriptBuffer = [text];
            await app.analyzeContext();
            await new Promise(r => setTimeout(r, 5000)); // Wait 5s
        }
    }
}
```

---

### 8. **Deployment Checklist**

- [ ] Get Freesound API key and integrate
- [ ] Test on Chrome, Edge, Firefox
- [ ] Test microphone permissions flow
- [ ] Deploy to HTTPS server (required for mic access)
- [ ] Add error boundaries for all async operations
- [ ] Implement sound preloading for common effects
- [ ] Create icon assets (192x192, 512x512)
- [ ] Write user documentation
- [ ] Test with real D&D session
- [ ] Test with bedtime story
- [ ] Optimize OpenAI prompts based on results
- [ ] Add analytics (optional, privacy-respecting)
- [ ] Create demo video

---

### 9. **Advanced Features**

#### Emotion Detection (Voice Analysis)
```javascript
// Use Web Audio API to analyze tone
analyzeVocalTone() {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    
    // High frequency = excited/tense
    // Low frequency = calm/dark
    const highFreqEnergy = dataArray.slice(100, 200).reduce((a,b) => a+b);
    const lowFreqEnergy = dataArray.slice(0, 50).reduce((a,b) => a+b);
    
    const emotionalIntensity = highFreqEnergy / (lowFreqEnergy + 1);
    
    return {
        intensity: emotionalIntensity,
        mood: emotionalIntensity > 2 ? 'tense' : 'calm'
    };
}
```

#### Keyword Detection (Fast Path)
```javascript
// Skip AI for obvious keywords
quickSoundDetection(text) {
    const keywords = {
        'thunder': { type: 'sfx', query: 'thunder' },
        'sword': { type: 'sfx', query: 'sword clash' },
        'door': { type: 'sfx', query: 'door creak' },
        'fire': { type: 'sfx', query: 'crackling fire' }
    };
    
    const lower = text.toLowerCase();
    for (const [keyword, sound] of Object.entries(keywords)) {
        if (lower.includes(keyword)) {
            return sound;
        }
    }
    
    return null;
}
```

---

## 📊 Performance Benchmarks

### Target Metrics
- **Speech Recognition Latency**: < 500ms
- **AI Analysis Time**: 1-3 seconds
- **Sound Trigger Latency**: < 100ms
- **Total End-to-End**: < 4 seconds from speech to sound
- **Memory Usage**: < 100MB
- **API Cost per Hour**: < $0.10

---

## 🎓 Learning Resources

- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [OpenAI API Docs](https://platform.openai.com/docs/api-reference)
- [Freesound API](https://freesound.org/docs/api/)
- [PWA Guide](https://web.dev/progressive-web-apps/)

---

**Built with ❤️ for immersive storytelling**
