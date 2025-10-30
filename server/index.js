// ===== CUEAI SERVER - Node Backend =====
// Handles: Deepgram STT, Chroma vector search, OpenAI analysis
// Endpoints: /sounds, /analyze, /health
// WebSocket: /ws/transcribe for real-time Deepgram streaming

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { readFile } from 'fs/promises';
import { ChromaClient } from 'chromadb';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // for hosting media files later

// ===== CHROMA CLIENT =====
let chromaClient;
let soundsCollection;

async function initChroma() {
  // Skip Chroma if no API key configured
  if (!process.env.CHROMA_API_KEY || process.env.CHROMA_API_KEY.includes('your_')) {
    console.warn('⚠ Chroma API key not configured, skipping vector search (will use OpenAI only)');
    return;
  }
  
  try {
    chromaClient = new ChromaClient({
      path: process.env.CHROMA_HOST || 'http://localhost:8000',
      tenant: process.env.CHROMA_TENANT || 'default_tenant',
      database: process.env.CHROMA_DATABASE || 'default_database',
      auth: process.env.CHROMA_API_KEY ? { 
        provider: 'token',
        credentials: process.env.CHROMA_API_KEY 
      } : undefined
    });
    
    // Get or create collection
    try {
      soundsCollection = await chromaClient.getOrCreateCollection({
        name: 'cueai-sounds',
        metadata: { description: 'CueAI sound effects and music catalog' }
      });
      console.log('✓ Chroma collection ready:', soundsCollection.name);
    } catch (err) {
      console.warn('Chroma collection setup skipped:', err.message);
    }
  } catch (err) {
    console.warn('Chroma client init failed (will skip vector search):', err.message);
  }
}

// ===== LOAD SOUND CATALOG =====
let soundCatalog = [];

async function loadSoundCatalog() {
  try {
    const data = await readFile('./soundCatalog.json', 'utf-8');
    soundCatalog = JSON.parse(data);
    console.log(`✓ Loaded ${soundCatalog.length} sounds from catalog`);
    
    // Optionally embed catalog into Chroma on startup
    if (soundsCollection && soundCatalog.length > 0) {
      await embedSoundCatalog();
    }
  } catch (err) {
    console.error('Failed to load sound catalog:', err.message);
  }
}

async function embedSoundCatalog() {
  try {
    const ids = soundCatalog.map(s => s.id);
    const documents = soundCatalog.map(s => 
      `${s.type} ${s.tags.join(' ')} ${s.id}`.toLowerCase()
    );
    const metadatas = soundCatalog.map(s => ({
      type: s.type,
      tags: s.tags.join(','),
      src: s.src
    }));
    
    await soundsCollection.add({
      ids,
      documents,
      metadatas
    });
    console.log('✓ Embedded sound catalog into Chroma');
  } catch (err) {
    console.warn('Failed to embed catalog into Chroma:', err.message);
  }
}

// ===== ENDPOINTS =====

// GET /sounds - return full sound catalog
app.get('/sounds', (req, res) => {
  res.json({ sounds: soundCatalog });
});

// POST /analyze - semantic search + OpenAI analysis
app.post('/analyze', async (req, res) => {
  const { transcript, mode, context } = req.body;
  
  if (!transcript) {
    return res.status(400).json({ error: 'transcript is required' });
  }
  
  try {
    // Step 1: Query Chroma for top 5 matching sounds
    let chromaResults = [];
    if (soundsCollection) {
      try {
        const queryResult = await soundsCollection.query({
          queryTexts: [transcript.toLowerCase()],
          nResults: 5
        });
        chromaResults = queryResult.ids[0] || [];
        console.log('Chroma matches:', chromaResults);
      } catch (err) {
        console.warn('Chroma query failed:', err.message);
      }
    }
    
    // Step 2: Build OpenAI prompt
    const matchedSounds = chromaResults
      .map(id => soundCatalog.find(s => s.id === id))
      .filter(Boolean);
    
    const prompt = buildAnalysisPrompt(transcript, mode, context, matchedSounds);
    
    // Step 3: Call OpenAI
    const aiResponse = await callOpenAI(prompt);
    
    // Step 4: Parse and validate response
    let decision;
    try {
      decision = JSON.parse(aiResponse);
    } catch (err) {
      console.error('OpenAI returned non-JSON, attempting repair...');
      decision = repairJSON(aiResponse);
    }
    
    // Validate IDs exist in catalog
    if (decision.music?.id && !soundCatalog.find(s => s.id === decision.music.id)) {
      console.warn('AI suggested unknown music ID:', decision.music.id);
      decision.music = null;
    }
    decision.sfx = (decision.sfx || []).filter(s => {
      if (!soundCatalog.find(c => c.id === s.id)) {
        console.warn('AI suggested unknown SFX ID:', s.id);
        return false;
      }
      return true;
    });
    
    res.json(decision);
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /health - healthcheck for Render
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    chroma: !!soundsCollection,
    sounds: soundCatalog.length 
  });
});

function buildAnalysisPrompt(transcript, mode, context, matchedSounds) {
  const catalogStr = matchedSounds.length > 0 
    ? matchedSounds.map(s => `${s.id} (${s.type}, tags: ${s.tags.join(',')})`).join('\n')
    : 'No matching sounds from vector search.';
  
  return `You are CueAI, an intelligent audio companion. Your job is to analyze spoken transcript and decide what music and sound effects to play.

Mode: ${mode || 'auto'}
Recent sounds played: ${context?.recentSounds?.join(', ') || 'none'}
Current music: ${context?.recentMusic || 'none'}

Transcript:
"${transcript}"

Top matching sounds from our catalog:
${catalogStr}

Full catalog available (use IDs only from this list):
${soundCatalog.map(s => `${s.id} (${s.type})`).join(', ')}

Rules:
- Return STRICT JSON only, no markdown
- Use "id" values exactly as shown above
- Music: choose one looping track or null
- SFX: max 2 effects per response
- SFX "when": "immediate" or "after_music_start"
- Volume: 0.0 to 1.0

Response format (STRICT JSON):
{
  "scene": "short description of what's happening",
  "music": {
    "id": "ep_fantasy_tension_loop",
    "action": "play_or_continue",
    "volume": 0.85
  },
  "sfx": [
    {
      "id": "ep_door_creak_01",
      "when": "immediate",
      "volume": 0.9
    }
  ]
}

Return only valid JSON, no extra text.`;
}

async function callOpenAI(prompt) {
  // Check if API key is configured
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('your_')) {
    throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY in .env file.');
  }
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a JSON-only audio decision engine. Always return valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 400
    })
  });
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`OpenAI error: ${response.status} ${err.error?.message || ''}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content.trim();
}

function repairJSON(text) {
  // Try to extract JSON from markdown code blocks or strip extra text
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (e) {
      console.error('JSON repair failed');
    }
  }
  // Fallback: empty response
  return { scene: 'parsing error', music: null, sfx: [] };
}

// ===== WEBSOCKET FOR DEEPGRAM STREAMING =====
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws) => {
  console.log('Client connected to /ws/transcribe');
  
  let deepgramWs = null;
  
  // TODO: Adjust Deepgram connection params based on audio format from browser
  // For now, assume browser sends linear16 PCM at 16kHz
  const deepgramUrl = 'wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1';
  
  try {
    deepgramWs = new WebSocket(deepgramUrl, {
      headers: {
        'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`
      }
    });
    
    deepgramWs.on('open', () => {
      console.log('✓ Connected to Deepgram');
    });
    
    deepgramWs.on('message', (data) => {
      try {
        const result = JSON.parse(data.toString());
        if (result.channel?.alternatives?.[0]?.transcript) {
          const transcript = result.channel.alternatives[0].transcript;
          // Send transcript back to browser
          ws.send(JSON.stringify({ transcript }));
        }
      } catch (err) {
        console.error('Deepgram message parse error:', err.message);
      }
    });
    
    deepgramWs.on('error', (err) => {
      console.error('Deepgram error:', err.message);
      ws.send(JSON.stringify({ error: 'Deepgram connection error' }));
    });
    
    deepgramWs.on('close', () => {
      console.log('Deepgram connection closed');
    });
  } catch (err) {
    console.error('Failed to connect to Deepgram:', err.message);
    ws.send(JSON.stringify({ error: 'Could not connect to Deepgram' }));
  }
  
  // Pipe browser audio to Deepgram
  ws.on('message', (audioData) => {
    // TODO: Handle audio resampling if browser sends different format
    // For now, pass through directly
    if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
      deepgramWs.send(audioData);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected from /ws/transcribe');
    if (deepgramWs) {
      deepgramWs.close();
    }
  });
  
  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });
});

// ===== START SERVER =====
const server = app.listen(PORT, () => {
  console.log(`🎵 CueAI Server running on port ${PORT}`);
  console.log(`✓ Health: http://localhost:${PORT}/health`);
  console.log(`✓ Sounds: http://localhost:${PORT}/sounds`);
});

// Initialize async resources after server starts
initChroma().then(() => loadSoundCatalog()).catch(err => {
  console.error('Initialization error:', err);
});

// Attach WebSocket upgrade handler
server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws/transcribe') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
