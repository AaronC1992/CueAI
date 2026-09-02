<div align="center">

# SuiteRhythm

### Reactive Sound Studio for Games, Stories, and Broadcasts

An interactive sound application that listens to live narration and layers music, ambience, and sound effects in real time.

<br>

[![Play Now](https://img.shields.io/badge/Play%20Now-SuiteRhythm-8a2be2?style=for-the-badge&logoColor=white)](https://suiterhythm.vercel.app)

<br>

</div>

---

## What It Does

SuiteRhythm provides live audio tools for tabletop games, narrated stories, streams, podcasts, and vocal performance.

## Core Experience

Choose a studio mode, provide narration or microphone input, and let SuiteRhythm react with sounds that match the current action, setting, and mood.

- A player says *"I kick down the tavern door"*, tavern ambience fades in
- A narrator describes a thunderstorm, rain and thunder start rolling
- Combat breaks out, the music shifts to battle drums

The creator stays focused on the moment while the audio adapts around them.

## How It Works

SuiteRhythm uses **speech recognition** to capture live conversation, sends it through an **AI analysis layer** (GPT 4.1), and maps the output to a curated library of **700+ sound effects, ambience beds, and music tracks** in real time.

```
Voice Input -> Speech Recognition -> AI Context Analysis -> Sound Matching -> Playback
```

### Key Capabilities

| Feature | Description |
|---|---|
| **Auto Detect Mode** | Listens to live speech and triggers sounds automatically via AI |
| **Story Mode** | Written narrative scenes with timed audio cues |
| **Sound Library** | 700+ categorized sounds for ambience, combat, weather, creatures, and music |
| **Session Recording** | Browser mixed session export for review, editing, and show notes |
| **Control Board** | Manual triggers for users who want direct control alongside auto detect |
| **Smart Layering** | Multiple sounds play simultaneously with intelligent volume balancing |
| **Instant Response** | Fast response from spoken word to audio playback |

### Studio Modes

- **Auto Detect** listens to narration and reacts with contextual audio
- **Table Top RPG** brings campaign sessions, encounters, and locations to life
- **Story Teller** provides genre focused support for narrated stories
- **Creator Studio** offers live tools and timeline based audio scoring
- **Sing Backing** reacts to tempo and vocal energy with accompaniment

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15, React 19 |
| **Audio Engine** | Howler.js — custom engine with layering, fading, preloading |
| **AI Analysis** | OpenAI GPT-4.1 (server-side) |
| **Speech Recognition** | Web Speech API (native browser) |
| **Database** | Supabase (PostgreSQL) |
| **Media Storage** | Cloudflare R2 (700+ audio files via CDN proxy) |
| **Hosting** | Vercel (serverless, edge-optimized) |

## Public Access

The app is open for direct use without a sign in flow. Production deployments must configure `API_AUTH_SECRET` to protect internal API tokens, and should add a managed quota system before enabling cost bearing AI features for unrestricted public traffic.

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   Browser Client                  │
│                                                    │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  Speech   │→│    AI     │→│  Sound Engine   │  │
│  │  Input    │  │ Director  │  │  (Howler.js)   │  │
│  └──────────┘  └──────────┘  └────────────────┘  │
│                      ↕                             │
└──────────────────────┼─────────────────────────────┘
                       │ API
          ┌────────────┼────────────┐
          │            │            │
    ┌─────▼─────┐ ┌───▼────┐ ┌───▼────┐
    │  OpenAI   │ │Supabase│ │  R2    │
    │  GPT-4.1  │ │  (DB)  │ │ (CDN)  │
    └───────────┘ └────────┘ └────────┘
```

## Traction & Status

- **Fully functional product** — live and playable today
- **700+ curated sound assets** hosted on CDN
- **AI pipeline operational** — real-time analysis with sub-second response
- **Zero-config user experience** — open the app and press play

## Business Model (Planned)

| Tier | Price | Features |
|---|---|---|
| **Beta** | $0 | Core auto-detect, full current library, scene presets |
| **Pro** | $15/mo planned | Story mode, custom sounds, priority AI, OBS overlay |
| **Table License** | Contact | Multi-device sync, shared sessions, commercial use |

## Roadmap

- **Multi-device sync** — shared audio across a full table of players
- **Custom sound uploads** — bring your own audio library
- **VTT integrations** — Foundry VTT, Roll20, Owlbear Rodeo
- **Mobile companion app** — control board from your phone
- **Community marketplace** — user-created sound packs and story scenes

## External Controllers (`window.SuiteRhythm`)

SuiteRhythm exposes a small, stable command surface for external controllers — Stream Deck plugins, OBS browser sources, bookmarklets, webhooks, and anonymous Twitch chat. Every channel funnels into the same rate-limited handler, so your integration never depends on engine internals.

### Command channels

```js
// 1. Direct JS (same-page integrations / devtools)
await window.SuiteRhythm.trigger('thunder');                 // by name or id
await window.SuiteRhythm.trigger('rolling thunder', { volume: 0.8 });
await window.SuiteRhythm.stopAll();
await window.SuiteRhythm.scene('Combat');
window.SuiteRhythm.status();                                 // { mode, mood, listening, music, activeSounds, twitch }

// 2. CustomEvent (for modules that load before window.SuiteRhythm is attached)
window.dispatchEvent(new CustomEvent('suiterhythm:command', {
    detail: { type: 'trigger', query: 'thunder' }
}));

// 3. postMessage (OBS browser sources / iframes — origin-gated)
window.postMessage({ suiterhythm: 'trigger', query: 'thunder' }, '*');
```

All `trigger` calls resolve to `{ ok, name, soundId, url, source }` so you can later stop a specific instance with the engine API.

### Twitch chat bridge (no OAuth)

```js
window.SuiteRhythm.twitch.connect('aaronc1992');
// Viewers can now type in chat:
//   !sfx thunder       → plays a thunder SFX
//   !stop              → stops all audio
//   !scene Combat      → applies the Combat scene preset
window.SuiteRhythm.twitch.disconnect();
```

SuiteRhythm joins as an anonymous `justinfan*` user over Twitch's WebSocket IRC gateway — **read-only, no tokens, no chat writes**. Unknown bang-commands are ignored. Commands are rate-limited (500ms per `type:query` pair by default) so a chat flood can't thrash the audio graph.

### Rate limiting & origin allowlist

- Default rate limit: 500ms per command key.
- `postMessage` commands from cross-origin pages are rejected unless the origin is in `allowedOrigins` (set when constructing the bridge). Same-origin messages always pass.
- Unknown command types return `{ ok: false, error: 'unknown command' }` rather than throwing, so older clients don't crash when a newer bridge adds commands.

## Get in Touch

Interested in SuiteRhythm? Reach out:

- **Live Demo:** [suiterhythm.vercel.app](https://suiterhythm.vercel.app)
- **GitHub:** [AaronC1992/SuiteRhythm](https://github.com/AaronC1992/SuiteRhythm)

---

<div align="center">

Built by **Aaron C.** — solo developer, game master, and audio nerd.

</div>
