# CueAI - Intelligent Audio Companion

**Version 2.0 - Full-Stack Architecture (Node.js + Deepgram + Chroma)**

[![Open App](https://img.shields.io/badge/Open%20App-Live-2ea44f?logo=googlechrome&logoColor=white)](https://aaronc1992.github.io/CueAI/)
[![Backend](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render&logoColor=white)](https://cueai-backend.onrender.com)

An AI-powered ambient sound designer that listens to conversations and automatically plays contextually-appropriate music and sound effects. Now with professional-grade speech recognition, semantic sound search, and curated audio catalog!

---

## 🎉 What's New in v2.0

- **Backend Architecture**: Node.js server on Render with Express REST API
- **Deepgram STT**: Real-time speech-to-text via WebSocket streaming (replaces Web Speech API)
- **Chroma Vector DB**: Semantic sound search for intelligent audio matching
- **Epidemic Sound Catalog**: Professionally curated music and SFX library
- **Howler.js Audio**: Modern audio engine with crossfades and spatial positioning
- **Stories Mode**: Interactive reading mode with word highlighting and auto-SFX

---

## Run the App (Live)

- ▶️ Open in your browser: https://aaronc1992.github.io/CueAI/
- Tip: If the page was open before, do a hard refresh twice to activate the latest service worker (v4).

---

## Features

### Core Functionality
- Continuous Speech Recognition - Listens to nearby conversations in real-time
- AI Context Analysis - Uses OpenAI GPT-4o-mini to understand story context and mood
- Smart Audio Playback - Automatically selects and plays appropriate music and sound effects
- Audio Visualizer - Waveform visualization of playing sounds
- Volume Control - Set min/max volume ranges for automatic AI adjustment

### Intelligent Modes
1. Bedtime Story Mode - Calming, gentle sounds for peaceful storytelling
2. D&D Campaign Mode - Epic fantasy sounds matching adventures and battles
3. Horror Mode - Tense, eerie ambience with subtle stingers and jump-scare cues when context suggests
4. Christmas Mode - Festive holiday sounds with bells, sleigh sounds, and winter atmosphere
5. Halloween Mode - Playful spooky sounds with cackling, bats, and fun autumn vibes
6. Sing Mode - AI listens to singing and provides complementary musical backing and harmonies
7. Auto-Detect Mode - Automatically determines context and mood

### Smart Audio Mixing
- **Music Layering**: Single background music track (prevents muddiness)
- **SFX Layering**: Up to 3 simultaneous sound effects
- **Instant Response**: Sound effects trigger immediately on context detection
- **Smooth Transitions**: Music fades in/out gracefully

---

## Quick Start

### Prerequisites
- Modern web browser (Chrome or Edge recommended for speech recognition)
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys); requires active billing)
- Optional: Freesound API key for real audio playback ([Get one here](https://freesound.org/apiv2/apply/))
- Microphone access

### Installation
1. **Option A - Simple (file:// protocol)**:
   - Open `index.html` directly in your web browser
   - Note: Service worker and manifest will show CORS errors (expected, doesn't break functionality)
   
2. **Option B - Local Server (recommended, eliminates CORS errors)**:
   - Double-click `start-server.bat` (Windows) or `start-server.ps1` (PowerShell)
   - Open http://localhost:8080 in your browser
   - Service worker and PWA features will work properly
   
3. Enter your OpenAI API key (stored locally in your browser)
4. Optional: Click "Setup Freesound API" and paste your Freesound key to enable real sounds
5. Allow microphone access when prompted
6. Click "Start Listening" and begin talking!

Note for PWA features: Service worker and installable app features require HTTPS. To test locally:
- Use a simple HTTPS server: `python -m http.server --bind localhost 8000` with SSL
- Or deploy to GitHub Pages / Netlify / Vercel (all provide free HTTPS)
- File:// protocol will show service worker errors (this is expected)

### Testing the App
1. **Select a mode** from the dropdown (Bedtime/D&D/Horror/Christmas/Halloween/Sing/Auto)
2. **Adjust volume range** (min/max sliders)
3. **Click "Start Listening"**
4. **Start talking** - Try describing a scene:
   - *Bedtime*: "Once upon a time, in a quiet forest, a gentle rain began to fall..."
   - *D&D*: "The dragon roars as the warrior draws his sword, thunder crashing overhead..."
   - *Christmas*: "Santa's sleigh jingled through the snowy night sky..."
   - *Halloween*: "The witch cackled as bats flew from the haunted mansion..."
   - *Sing Mode*: Try singing any song and the AI will provide backing music
5. **Watch the AI respond** - It will analyze every 2 seconds and trigger sounds

---

## Architecture

### Technology Stack

**Frontend**:
- HTML5, CSS3, Vanilla JavaScript
- Howler.js v2.2.4 (audio playback)
- Progressive Web App (PWA) with service worker

**Backend** (Node.js):
- Express 4.19 (REST API)
- ws 8.16 (WebSocket for Deepgram)
- chromadb 1.8.1 (vector database)
- node-fetch 3.3.2 (HTTP client)
- Deployed on Render

**APIs & Services**:
- Deepgram (real-time STT streaming)
- OpenAI GPT-4o-mini (context analysis)
- Chroma (semantic vector search)
- Epidemic Sound Pro (curated audio)

### System Flow (v2.0)
```
Browser Microphone
    ↓
WebSocket → Backend → Deepgram API
    ↓
Real-time Transcription
    ↓
Backend /analyze Endpoint
    ├─ Chroma Vector Search (top 5 matching sounds)
    └─ OpenAI Analysis (strict JSON response)
    ↓
Frontend Howler.js Playback
    ├─ Music Track (streaming, looping)
    └─ SFX Layers (stereo positioning, ducking)
```

### Key Components

#### 1. Speech Recognition System
- Uses Web Speech API for continuous transcription
- Maintains rolling buffer of last 30 seconds
- Auto-restarts if interrupted

#### 2. AI Context Analyzer
- Sends transcript chunks to OpenAI every 4 seconds
- Extracts: mood, setting, action, intensity
- Returns structured JSON with sound decisions

#### 3. Sound Decision Engine
- Music: Single ambient track, can fade between tracks
- SFX: Up to 3 simultaneous effects (instant trigger)
- Smart caching to reduce API calls

#### 4. Audio Playback System
- Web Audio API for precise control
- Volume normalization within user-defined range
- Crossfading for smooth music transitions

---

## UI Components

### Sections
1. **Mode Selector** - Choose Bedtime/D&D/Auto-detect
2. **Volume Controls** - Min/Max sliders for AI volume range
3. **Audio Visualizer** - Real-time waveform display
4. **Control Buttons** - Start/Stop listening
5. **Live Transcript** - Shows what CueAI is hearing
6. **Currently Playing** - Displays active sounds with volumes

### Design Philosophy
- Dark theme for non-intrusive use during stories/games
- Minimal UI to avoid distraction
- Purple/cyan gradient accent colors
- Responsive design for desktop and mobile

---

## Configuration

### Adjustable Parameters (in `game.js`)

```javascript
// Analysis frequency
this.analysisInterval = 4000; // milliseconds (4 seconds)

// Audio limits
this.maxSimultaneousSounds = 3; // Max SFX at once

// Volume defaults
this.minVolume = 0.2; // 20%
this.maxVolume = 0.7; // 70%
```

### OpenAI Prompt Customization
Edit `buildAnalysisPrompt()` method to fine-tune AI behavior:
- Adjust sound categories
- Change analysis granularity
- Modify JSON response structure

---

## Cost Estimation

### OpenAI API Costs (GPT-4o-mini)
- **Input**: ~100 tokens per analysis (~$0.000015)
- **Output**: ~100 tokens per response (~$0.00006)
- **Total per analysis**: ~$0.000075
- **Per hour** (900 analyses): ~$0.07
- **Very affordable for extended use!**

---

## Roadmap

### Phase 2 Features
- [ ] **Freesound.org Integration** - Real sound library access
- [ ] **Local Sound Library** - Pre-download popular sounds
- [ ] **Emotion Detection** - Analyze vocal tone for mood
- [ ] **Multi-language Support** - Transcription in multiple languages
- [ ] **Android PWA** - Convert to Progressive Web App
- [ ] **Sound Customization** - User-defined sound libraries
- [ ] **Recording/Playback** - Save sessions for later review
- [ ] **WebSocket Real-time** - Lower latency processing

### Future Enhancements
- **AI-Generated Sounds** - Create unique sounds on-demand
- **Spotify Integration** - Stream curated playlists
- **Character Voice Detection** - Different sounds per speaker
- **Gesture Control** - Hand signals for manual overrides
- **Smart Home Integration** - Control lights to match mood

---

## Privacy & Security

### Data Handling
- **API Key (OpenAI)**: Stored locally in browser (localStorage)
- **Freesound API Key**: Optional, stored locally in browser (localStorage)
- **Transcripts**: Sent only to OpenAI, not stored by this app
- **Audio**: Processed locally, never recorded
- **No Server**: Entirely client-side application
- **No Tracking**: No analytics or third-party scripts

### Recommendations
- Use HTTPS when deploying online
- Regularly rotate API keys
- Monitor OpenAI usage dashboard

---

## Troubleshooting

### Speech Recognition Not Working
- **Solution**: Use Chrome or Edge browser
- **Check**: Microphone permissions in browser settings
- **Try**: HTTPS instead of HTTP (required for mic access on some browsers)
- **Network**: Web Speech API requires an active internet connection

### Network Errors During Speech Recognition
- **Cause**: Web Speech API sends audio to Google servers for transcription and requires internet
- **Solution**: 
  - Check your internet connection
  - The app will auto-retry and continue listening
  - If errors persist, try refreshing the page
  - Temporary network hiccups are normal and will be handled automatically

### Service Worker / PWA Not Working
- **Cause**: Service workers require HTTPS (not file:// protocol)
- **Solution**: 
  - **Quick fix**: Use the included local server by running `start-server.bat` then visit http://localhost:8080
  - Or deploy to GitHub Pages, Netlify, or Vercel (free HTTPS hosting)
  - The app works fine without service worker - PWA features are optional enhancements

### CORS Errors for manifest.json
- **Cause**: `file://` protocol blocks cross-origin requests
- **Solution**: 
  - Run the included local server: `start-server.bat` (or `start-server.ps1` in PowerShell)
  - Then open http://localhost:8080 in your browser
  - This eliminates all CORS errors and enables PWA features

### No Sounds Playing
- You likely haven’t added your Freesound API key yet.
- Click "Setup Freesound API" in the app footer and paste your key.
- Without a key, CueAI will still analyze but won’t play remote sounds.

### AI Analysis Errors
- **Check**: API key is valid and has credits
- **Verify**: Network connection for OpenAI API
- **Review**: Browser console for detailed error messages

### High API Costs
- **Increase** `analysisInterval` to 6000-8000ms
- **Reduce** transcript buffer size
- **Use** caching more aggressively

---

## Backend Setup (Local Development)

### Prerequisites
- Node.js 18+ ([Download](https://nodejs.org/))
- API Keys:
  - OpenAI API Key ([Get here](https://platform.openai.com/api-keys))
  - Deepgram API Key ([Get here](https://deepgram.com/))
  - Chroma API Key (optional, [Get here](https://trychroma.com/))
- Epidemic Sound Pro subscription (for audio files)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/AaronC1992/CueAI.git
   cd CueAI
   ```

2. **Install backend dependencies**:
   ```bash
   cd server
   npm install
   ```

3. **Create `.env` file** (based on `.env.example`):
   ```bash
   OPENAI_API_KEY=sk-...
   DEEPGRAM_API_KEY=...
   CHROMA_API_KEY=...
   CHROMA_HOST=https://api.trychroma.com
   PORT=3000
   ```

4. **Add Epidemic Sound files** (manually download from your Pro account):
   - Create `server/media/` folder
   - Download audio files and place in `server/media/`
   - Update `server/soundCatalog.json` with file paths

5. **Start backend server**:
   ```bash
   npm run dev  # Development mode with hot-reload
   # OR
   npm start    # Production mode
   ```

6. **Test backend**:
   ```bash
   # Health check
   curl http://localhost:3000/health
   
   # Get sound catalog
   curl http://localhost:3000/sounds
   
   # Test analysis
   curl -X POST http://localhost:3000/analyze \
     -H "Content-Type: application/json" \
     -d '{"transcript":"The dragon roars","mode":"dnd"}'
   ```

7. **Open frontend**:
   - Visit `http://localhost:8080` (if using start-server scripts)
   - Or open `index.html` directly (will connect to localhost:3000 backend)

### Backend API Endpoints

**GET /sounds**
- Returns full sound catalog
- Response: `{ sounds: [{ id, type, tags, src, loop }] }`

**POST /analyze**
- Analyzes transcript and returns sound decisions
- Body: `{ transcript: string, mode: string, context: object }`
- Response: `{ scene: string, music: { id, action, volume }, sfx: [{ id, when, volume }] }`

**GET /health**
- Healthcheck for monitoring
- Response: `{ status: "ok", chroma: boolean, sounds: number }`

**WebSocket /ws/transcribe**
- Real-time audio streaming to Deepgram
- Send: Audio data (binary)
- Receive: `{ transcript: string }`

### Deployment to Render

1. **Push code to GitHub**:
   ```bash
   git add .
   git commit -m "Add backend v2.0"
   git push origin main
   ```

2. **Create Render account**: https://render.com/

3. **Create new Web Service**:
   - Connect your GitHub repo
   - Use blueprint: `render.yaml`
   - Set environment variables in Render dashboard:
     - `OPENAI_API_KEY`
     - `DEEPGRAM_API_KEY`
     - `CHROMA_API_KEY`
     - `CHROMA_HOST`

4. **Deploy**:
   - Render will auto-deploy from `main` branch
   - Get your backend URL: `https://cueai-backend.onrender.com`

5. **Update frontend**:
   - Edit `game.js` → `getBackendUrl()` method
   - Replace production URL with your Render URL
   - Commit and push to GitHub Pages

## Development

### File Structure
```
CueAI/
├── index.html              # Main HTML UI
├── styles.css              # All CSS styling
├── game.js                 # Frontend logic (Howler + backend calls)
├── manifest.json           # PWA manifest
├── service-worker.js       # PWA service worker
├── saved-sounds.json       # Local audio manifest (106 files)
├── stories.json            # Fairy tale texts for Stories mode
├── start-server.bat        # Windows batch script for local dev
├── start-server.ps1        # PowerShell script for local dev
├── render.yaml             # Render deployment config
├── README.md               # This file
└── server/                 # Backend Node.js application
    ├── package.json        # Node dependencies
    ├── index.js            # Express app + WebSocket server
    ├── soundCatalog.json   # Epidemic Sound audio catalog
    ├── .env.example        # Environment variables template
    └── .env                # Your API keys (git-ignored)
```

### Adding New Modes
1. Add button in HTML `mode-selector` section
2. Add mode context in `buildAnalysisPrompt()` method
3. Test with appropriate sample text

### Extending Sound Sources
Modify `searchFreesound()` method to integrate:
- Freesound.org API (requires OAuth)
- Custom sound CDN
- Local file system
- AI sound generation APIs

---

## License

**MIT License** - Free for personal and commercial use

---

## Author

Built by Expert AI Team for CueAI
- AI Designer
- App Engineer  
- Code Architect
- UX Director

---

## Acknowledgments

- OpenAI for GPT-4o-mini API
- Web Speech API contributors
- Freesound.org community (planned integration)

---

## Support

For questions, issues, or feature requests:
1. Check browser console for errors
2. Verify API key and microphone permissions
3. Test with sample phrases in different modes

---

**Happy Storytelling!**
