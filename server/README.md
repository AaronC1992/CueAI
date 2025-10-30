# CueAI Backend - Quick Start

## 🚀 Setup Steps

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Create Environment File
Copy `.env.example` to `.env` and fill in your API keys:

```bash
# Copy template
cp .env.example .env

# Edit with your keys
notepad .env  # Windows
nano .env     # Linux/Mac
```

Required keys:
- **OPENAI_API_KEY**: Get from https://platform.openai.com/api-keys
- **DEEPGRAM_API_KEY**: Get from https://deepgram.com/
- **CHROMA_API_KEY**: Get from https://trychroma.com/ (optional)

### 3. Add Audio Files (Optional)
- Create `server/media/` folder
- Download Epidemic Sound files from your Pro account
- Place MP3 files in `server/media/`
- Update `soundCatalog.json` with correct file paths

Example catalog entry:
```json
{
  "id": "ep_fantasy_loop",
  "type": "music",
  "tags": ["fantasy", "dnd", "epic", "adventure"],
  "src": "/media/fantasy_loop.mp3",
  "loop": true,
  "license": "epidemic-sound-pro-2025-10"
}
```

### 4. Start Server
```bash
# Development mode (auto-restart on changes)
npm run dev

# Production mode
npm start
```

Server will start on http://localhost:3000

### 5. Test Endpoints

**Health check:**
```bash
curl http://localhost:3000/health
```

**Get sound catalog:**
```bash
curl http://localhost:3000/sounds
```

**Test analysis:**
```bash
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d "{\"transcript\":\"The dragon roars as thunder crashes\",\"mode\":\"dnd\"}"
```

### 6. Connect Frontend
- Frontend auto-detects localhost backend when running locally
- Open `index.html` in browser or use `start-server.bat`
- Check browser console for "✓ Loaded X sounds from backend"

---

## 🔧 Troubleshooting

### "Cannot find module" errors
```bash
rm -rf node_modules package-lock.json
npm install
```

### Chroma connection fails
- Check `CHROMA_HOST` URL in `.env`
- Verify API key is valid
- Backend will continue without Chroma (fallback mode)

### OpenAI rate limits
- Verify billing is set up at https://platform.openai.com/account/billing
- Check usage at https://platform.openai.com/account/usage
- Upgrade to paid tier if needed

### Port already in use
```bash
# Change PORT in .env
PORT=3001
```

---

## 📝 API Documentation

### POST /analyze
Analyzes transcript and returns sound decisions.

**Request:**
```json
{
  "transcript": "string",
  "mode": "dnd|bedtime|horror|christmas|halloween|sing|auto",
  "context": {
    "musicEnabled": true,
    "sfxEnabled": true,
    "moodBias": 0.5,
    "recentSounds": ["sound1", "sound2"],
    "recentMusic": "music_id"
  }
}
```

**Response:**
```json
{
  "scene": "description of detected scene",
  "music": {
    "id": "ep_fantasy_loop",
    "action": "play_or_continue",
    "volume": 0.7
  },
  "sfx": [
    {
      "id": "ep_dragon_roar",
      "when": "immediate",
      "volume": 0.9
    }
  ]
}
```

### WebSocket /ws/transcribe
Real-time audio streaming to Deepgram.

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:3000/ws/transcribe');

ws.onopen = () => {
  // Send audio data (binary)
  ws.send(audioBuffer);
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Transcript:', data.transcript);
};
```

---

## 🌐 Deployment

See main README.md for full Render deployment instructions.

Quick deploy:
1. Push to GitHub
2. Create Render Web Service
3. Link repo and use `render.yaml` blueprint
4. Set env vars in Render dashboard
5. Deploy!
