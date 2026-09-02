<div align="center">

# SuiteRhythm

### Reactive Sound Studio for Games, Stories, Streams, and Voice Driven Scenes

SuiteRhythm listens to narration, live speech, and creator cues, then layers music, ambience, and sound effects in real time.

<br>

[![Open SuiteRhythm](https://img.shields.io/badge/Open-SuiteRhythm-8a2be2?style=for-the-badge&logoColor=white)](https://suiterhythm.vercel.app)
[![CI](https://github.com/CommonQuestStudios/SuiteRhythm/actions/workflows/ci.yml/badge.svg)](https://github.com/CommonQuestStudios/SuiteRhythm/actions/workflows/ci.yml)

</div>

## Live App

* App: [suiterhythm.vercel.app](https://suiterhythm.vercel.app)
* Repository: [CommonQuestStudios/SuiteRhythm](https://github.com/CommonQuestStudios/SuiteRhythm)

The app currently opens directly into the studio. The old public login and payment gate are disabled.

## What SuiteRhythm Does

SuiteRhythm gives storytellers, game masters, streamers, podcasters, and creators a live audio workstation that reacts while they perform.

Example moments:

* A player says, "I kick down the tavern door", and the sound board can fire a door impact or tavern cue.
* A narrator describes a thunderstorm, and storm sounds can layer under the scene.
* Combat begins, and music can shift into a more intense cue.
* A creator records a custom voice line, applies a voice effect, saves it as a sound, and uses it on the board.

## Current Features

| Feature | Current Status |
| --- | --- |
| Auto Detect | Listens to live narration and maps words, mood, and scene context to sound cues |
| Table Top RPG | Campaign focused controls for encounters, ambience, effects, and manual board playback |
| Story Teller | Narrative playback support with reactive story cues |
| Creator Studio | Live mode, studio media tools, transcript support, cue map preview, and render export |
| Sing Backing | Vocal energy and tempo aware accompaniment tools |
| Sound Library | 999 catalog entries with search, type filters, tag filters, discovery lanes, and review state |
| Control Board | Manual sound board buttons for music, ambience, SFX, and custom recordings |
| Voice Recorder | Local custom audio recording with gain, gate, monitor mode, and voice effects |
| Sound Audit | `/admin/sounds` catalog audit page plus in app audit metrics |
| OBS View | Browser source friendly route at `/obs` |

## Sound Library

The catalog currently contains:

| Type | Count |
| --- | ---: |
| Music | 278 |
| SFX | 664 |
| Ambience | 57 |
| Total | 999 |

Audio metadata lives in Supabase and the static fallback catalog at [public/saved-sounds.json](public/saved-sounds.json). Audio files live in Cloudflare R2 under the `sounds/` prefix. Legacy `Saved sounds/` routes still resolve as a compatibility bridge, but new catalog entries and scripts use `sounds/`.

Useful checks:

```powershell
npm run catalog:check
npm run keywords:check
npm run catalog:health
npm run catalog:health:r2
node scripts/measure-audio-coverage.mjs
```

## Voice Recorder

Open the recorder from:

```text
Sound Library -> Custom Sounds -> Record Sound
```

Recorder options:

* Save as SFX, music, or ambience
* Clean, warm, bright, radio, monster, and whisper effects
* Input gain control
* Noise gate control
* Monitor button for hearing the processed signal
* Tags and notes for later review

Custom recordings are stored locally in the browser. They appear in Custom Sounds, can be previewed, can be searched by the local audio engine, and can be assigned to Control Board buttons. Clearing browser storage removes these local recordings.

## Tech Stack

| Layer | Technology |
| --- | --- |
| App | Next.js 15, React 19 |
| Audio | Howler.js plus a custom Web Audio engine |
| AI Analysis | OpenAI GPT 4.1 through server routes |
| Speech | Web Speech API |
| Database | Supabase PostgreSQL |
| Sound Storage | Cloudflare R2 |
| Hosting | Vercel |
| Tests | Vitest, ESLint, Next build checks |

## Local Development

Install dependencies:

```powershell
npm install
```

Create `.env.local` from [.env.example](.env.example), then fill in the services you need. Local catalog and UI work can run without provider keys, but AI generation, transcription, TTS, R2 uploads, and Supabase writes need their matching secrets.

Run the app:

```powershell
npm run dev
```

Run validation:

```powershell
npm run lint
npm test
npm run build
```

## Environment Variables

Common production variables:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser safe Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server side Supabase admin operations |
| `OPENAI_API_KEY` | AI scene and transcript analysis |
| `API_AUTH_SECRET` | Signs internal API tokens |
| `R2_ACCOUNT_ID` | Cloudflare account id |
| `R2_ACCESS_KEY_ID` | R2 write and read credential id |
| `R2_SECRET_ACCESS_KEY` | R2 write and read credential secret |
| `R2_BUCKET_NAME` | R2 bucket, currently `cueai-media` |
| `R2_PUBLIC_URL` | Public R2 origin used by the `/r2-audio` proxy |
| `NEXT_PUBLIC_R2_CDN_URL` | Optional custom Cloudflare CDN domain |
| `ELEVENLABS_API_KEY` | ElevenLabs key for sound generation and TTS |
| `ELEVENLABS_VOICE_ID` | Voice used by the TTS route |
| `PIXABAY_API_KEY` | Optional Pixabay audio search proxy |
| `AI_SOUND_FALLBACK_ENABLED` | Enable ElevenLabs generation as a last-resort fallback for missing sounds |
| `SOUND_MATCH_THRESHOLD` | Min AI confidence required before a "missing sound" can trigger generation |
| `ELEVENLABS_CREDIT_CHECK_INTERVAL_MS` | How often to re-check ElevenLabs credit status while available |
| `ELEVENLABS_DEPLETED_RECHECK_INTERVAL_MS` | How often to re-check once the circuit breaker has opened |
| `ELEVENLABS_GENERATION_COOLDOWN_MS` | Min gap between generation requests for the same/similar cue |
| `ELEVENLABS_MINIMUM_CREDIT_RESERVE` | Stop generating once remaining credits fall at/below this reserve |
| `MAX_CONCURRENT_AI_SOUND_GENERATIONS` | Concurrent ElevenLabs Sound Generation calls allowed |
| `ELEVENLABS_SFX_DURATION_SECONDS` / `ELEVENLABS_AMBIENCE_DURATION_SECONDS` | Generated clip durations |

### AI sound generation fallback

`app/api/generate-sound/route.js` is a last-resort fallback used only after
the normal sound library (and the generated-sound cache) has no match for a
cue the AI reports via `missingSound` in `/api/analyze`. See
`lib/modules/elevenlabs-generation-manager.js` for credit checking, the
circuit breaker, cooldowns, and concurrency limiting, and
`lib/generated-sound-store.js` for the Supabase/R2-backed cache (falls back
to an in-memory cache if the `generated_sounds` table doesn't exist yet —
see the SQL comment at the bottom of that file). Admin status is visible at
`/admin/sounds`.

## Audio Storage Notes

Cloudflare R2 is the source of truth for audio files. The project recently migrated from:

```text
Saved sounds/
```

to:

```text
sounds/
```

The migration copied all referenced files, updated the local catalog, updated trigger mappings, and updated Supabase `sounds.file` rows.

Next hosting improvement: bind a custom domain such as `cdn.suiterhythm.com` to the R2 bucket, set CORS for `https://suiterhythm.vercel.app`, then set:

```text
NEXT_PUBLIC_R2_CDN_URL=https://cdn.suiterhythm.com
R2_PUBLIC_URL=https://cdn.suiterhythm.com
```

Until then, audio continues through the `/r2-audio` proxy fallback.

## External Controller API

SuiteRhythm exposes a browser command surface for Stream Deck style controls, OBS overlays, bookmarklets, and custom browser integrations.

```js
await window.SuiteRhythm.trigger('thunder');
await window.SuiteRhythm.trigger('rolling thunder', { volume: 0.8 });
await window.SuiteRhythm.stopAll();
await window.SuiteRhythm.scene('Combat');
window.SuiteRhythm.status();
```

Custom events are also supported:

```js
window.dispatchEvent(new CustomEvent('suiterhythm:command', {
  detail: { type: 'trigger', query: 'thunder' }
}));
```

OBS or iframe integrations can use `postMessage` with origin allowlisting:

```js
window.postMessage({ suiterhythm: 'trigger', query: 'thunder' }, '*');
```

## Useful Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start local development |
| `npm test` | Run Vitest tests |
| `npm run lint` | Run ESLint |
| `npm run build` | Build the Next app |
| `npm run catalog:check` | Check deterministic catalog tags |
| `npm run keywords:check` | Check deterministic keyword enrichment |
| `npm run catalog:health` | Check local catalog shape, duplicates, and old prefixes |
| `npm run catalog:health:r2` | Check every catalog object exists in R2 |
| `npm run sounds:plan` | Dry run the curated ElevenLabs batch |
| `npm run sounds:generate` | Generate the curated ElevenLabs batch |
| `npm run sounds:migrate-prefix` | Run the R2 and catalog prefix migration |

## Status

SuiteRhythm is a working public beta. The main app, R2 backed sound library, static catalog fallback, trigger preloading, voice recorder, sound board, and catalog audit tools are operational.

Known follow ups:

* Add a custom R2 CDN domain.
* Move custom recordings from browser local storage to user owned R2 objects.
* Add an in app review workflow for approving generated audio before publishing.
* Finish the remaining ElevenLabs batch when credits reset.

## Contact

Built by Aaron C. and Common Quest Studios.

* Live app: [suiterhythm.vercel.app](https://suiterhythm.vercel.app)
* GitHub: [CommonQuestStudios/SuiteRhythm](https://github.com/CommonQuestStudios/SuiteRhythm)
