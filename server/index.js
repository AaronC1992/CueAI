// ===== CUEAI SERVER - Node Backend =====
// Handles: Deepgram STT, Chroma vector search, OpenAI analysis
// Endpoints: /sounds, /analyze, /health
// WebSocket: /ws/transcribe for real-time Deepgram streaming

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChromaClient } from 'chromadb';
import adminRouter from './routes/admin.js';
import chromaCollectionPromise from './config/chroma.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple in-memory rate limiting (per IP)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests per minute

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
  
  if (now > record.resetTime) {
    // Reset window
    record.count = 1;
    record.resetTime = now + RATE_LIMIT_WINDOW;
    rateLimitMap.set(ip, record);
    return true;
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  record.count++;
  rateLimitMap.set(ip, record);
  return true;
}

// Clean up old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  
  // Remove expired entries
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
  
  // Prevent memory leak: if map grows too large, clear oldest entries
  if (rateLimitMap.size > 10000) {
    const entries = Array.from(rateLimitMap.entries());
    // Sort by resetTime and keep only newest 5000
    entries.sort((a, b) => b[1].resetTime - a[1].resetTime);
    rateLimitMap.clear();
    entries.slice(0, 5000).forEach(([ip, record]) => rateLimitMap.set(ip, record));
    console.warn(`⚠️  Rate limit map grew to ${entries.length}, trimmed to 5000`);
  }
}, 300000);

// Middleware
app.use(cors());
app.use(express.json());

// Serve /media locally as a transparent fallback if CDN fails
// This enables the frontend to try /media URLs when R2 returns 404
app.use('/media', express.static(path.join(__dirname, 'media'), {
  fallthrough: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

// Request timeout middleware (prevent long-running requests on free tier)
app.use((req, res, next) => {
  req.setTimeout(28000); // 28 second timeout (under Render's 30s limit)
  res.setTimeout(28000);
  next();
});

// Admin routes
app.use('/admin', adminRouter);

// ===== LOAD SOUND CATALOG =====
let soundCatalog = [];

async function loadSoundCatalog() {
  try {
    const data = await readFile('./soundCatalog.json', 'utf-8');
    soundCatalog = JSON.parse(data);
    console.log(`✓ Loaded ${soundCatalog.length} sounds from catalog`);
    
    // NOTE: Media files now hosted on Cloudflare R2 CDN
    // No local file validation needed - all URLs point to remote storage
    console.log(`✓ All media files served from Cloudflare R2`);
  } catch (err) {
    console.error('Failed to load sound catalog:', err.message);
  }
}

// ===== ENDPOINTS =====

// GET /sounds - return full sound catalog
app.get('/sounds', (req, res) => {
  res.json({ sounds: soundCatalog });
});

// GET /test-chroma - test Chroma connection without OpenAI
app.get('/test-chroma', async (req, res) => {
  try {
    const collection = await chromaCollectionPromise;
    const queryResult = await collection.query({
      queryTexts: ["dragon roar"],
      nResults: 3
    });
    res.json({ 
      success: true,
      matches: queryResult.ids[0] || [],
      message: "Chroma is working"
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

// POST /analyze - semantic search + OpenAI analysis
app.post('/analyze', async (req, res) => {
  // Rate limiting check
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ 
      error: 'Too many requests. Please try again in a minute.' 
    });
  }
  
  const { transcript, mode, context } = req.body;
  
  if (!transcript) {
    return res.status(400).json({ error: 'transcript is required' });
  }
  
  try {
    // Step 1: Query Chroma for top 5 matching sounds
    let chromaResults = [];
    let matchedSounds = [];
    
    try {
      const collection = await chromaCollectionPromise;
      const queryResult = await collection.query({
        queryTexts: [transcript.toLowerCase()],
        nResults: 5
      });
      chromaResults = queryResult.ids[0] || [];
      console.log('Chroma matches:', chromaResults);
      
      // Map IDs to full sound objects
      matchedSounds = chromaResults
        .map(id => soundCatalog.find(s => s.id === id))
        .filter(Boolean);
    } catch (err) {
      console.warn('Chroma query failed (using all sounds):', err.message);
      // Fallback: use all sounds if Chroma fails
      matchedSounds = soundCatalog;
    }
    
    // Step 2: Build OpenAI prompt
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
app.get('/health', async (req, res) => {
  let chromaStatus = false;
  let deepgramStatus = false;

  // Backend-configured provider flags (fast checks)
  const openaiConfigured = !!process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('your_');
  const pixabayConfigured = !!process.env.PIXABAY_API_KEY && !process.env.PIXABAY_API_KEY.includes('your_');

  // For Freesound, this app uses CDN audio sources; treat "available" if catalog has entries
  const freesoundConfigured = soundCatalog.length > 0;
  
  // Check Chroma
  try {
    const collection = await chromaCollectionPromise;
    chromaStatus = !!collection;
  } catch (err) {
    console.warn('Chroma health check failed:', err.message);
  }
  
  // Check Deepgram (simple API key validation)
  if (process.env.DEEPGRAM_API_KEY && !process.env.DEEPGRAM_API_KEY.includes('your_')) {
    try {
      const dgResponse = await fetch('https://api.deepgram.com/v1/projects', {
        method: 'GET',
        headers: { 
          'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(3000)
      });
      deepgramStatus = dgResponse.ok;
    } catch (err) {
      console.warn('Deepgram health check failed:', err.message);
    }
  }
  
  res.json({ 
    status: 'ok', 
    chroma: chromaStatus,
    deepgram: deepgramStatus,
    sounds: soundCatalog.length,
    // Explicit provider availability for frontend indicators
    openai: openaiConfigured,
    freesound: freesoundConfigured,
    pixabay: pixabayConfigured
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
  
  // Add timeout and memory-efficient fetch
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout
  
  try {
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
        max_tokens: 300 // Reduced from 400 to save memory
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`OpenAI error: ${response.status} ${err.error?.message || ''}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('OpenAI request timed out after 25s');
    }
    throw err;
  }
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
// NOTE: This WebSocket implementation is complete but NOT YET INTEGRATED with frontend
// TODO: Frontend needs to connect to ws://backend/ws/transcribe and stream audio
// Currently, frontend uses browser's Web Speech API for speech recognition
// This would be an upgrade path for better accuracy and control
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
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎵 CueAI Server running on http://0.0.0.0:${PORT}`);
  console.log(`✓ Health: http://localhost:${PORT}/health`);
  console.log(`✓ Sounds: http://localhost:${PORT}/sounds`);
  
  // Log memory usage on startup
  const memUsage = process.memoryUsage();
  console.log(`📊 Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB used / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB total`);
});

// Memory monitoring for Render free tier (512MB limit)
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    if (heapUsedMB > 400) {
      console.warn(`⚠️ High memory usage: ${heapUsedMB}MB (limit: 512MB)`);
      if (global.gc) global.gc(); // Force garbage collection if enabled
    }
  }, 60000); // Check every minute
}

// Initialize async resources after server starts
loadSoundCatalog().catch(err => {
  console.error('Catalog load error:', err);
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
