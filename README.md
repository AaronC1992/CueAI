# CueAI - Intelligent Audio Companion

**Version 1.0 MVP (OpenAI-only, client-side)**

[![Open App](https://img.shields.io/badge/Open%20App-Live-2ea44f?logo=googlechrome&logoColor=white)](https://aaronc1992.github.io/CueAI/)
[![Contact Aaron](https://img.shields.io/badge/Contact%20Aaron-API%20Key%20Codes-DB4437?logo=gmail&logoColor=white)](mailto:aaroncue92@gmail.com)

An AI-powered ambient sound designer that listens to conversations and automatically plays contextually-appropriate music and sound effects. Perfect for enhancing bedtime stories and D&D campaigns!

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
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Speech Recognition**: Web Speech API (browser-native)
- **AI Engine**: OpenAI GPT-4o-mini API
- **Audio**: Web Audio API + Freesound previews (Token auth)
- **Visualizer**: HTML5 Canvas

### System Flow
```
Microphone Input
    ↓
Speech Recognition (continuous)
    ↓
Transcript Buffer (rolling 30s window)
    ↓
AI Analysis (every 4s)
    ↓
OpenAI GPT-4o-mini (context → sound decisions)
    ↓
Sound Decision Engine
    ↓
Audio Playback System
    ├─ Music Track (single, looping)
    └─ SFX Layers (up to 3 simultaneous)
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
- ✅ **API Key (OpenAI)**: Stored locally in browser (localStorage)
- ✅ **Freesound API Key**: Optional, stored locally in browser (localStorage)
- ✅ **Transcripts**: Sent only to OpenAI, not stored by this app
- ✅ **Audio**: Processed locally, never recorded
- ✅ **No Server**: Entirely client-side application
- ✅ **No Tracking**: No analytics or third-party scripts

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

## Development

### File Structure
```
CueAI/
├── index.html          # Main HTML structure
├── styles.css          # All CSS styling
├── game.js             # Core JavaScript logic (OpenAI + Freesound)
├── manifest.json       # PWA manifest
├── service-worker.js   # PWA service worker
├── start-server.bat    # Windows batch script to start local server
├── start-server.ps1    # PowerShell script to start local server
└── README.md           # This file
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
