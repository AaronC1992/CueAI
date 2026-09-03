import Link from 'next/link';

const tutorialSections = [
  {
    id: 'start',
    title: 'Start Here',
    summary: 'Use this if you are brand new and want the shortest path into the app.',
    points: [
      'SuiteRhythm is a live sound workstation. It can listen to narration, help match sounds to a scene, and let you trigger sounds by hand.',
      'The fastest way to learn is to open Auto Detect, allow microphone access, say a short scene, then open Sound Library and preview what the catalog can do.',
      'Use Control Board when you want manual buttons. Use Creator Studio when you want to work with uploaded media and timed cues. Use Sound Library when you want to find, review, record, or disable sounds.',
    ],
    workflow: ['Open the app', 'Pick Auto Detect', 'Allow the microphone', 'Speak a short scene', 'Use Sound Library to tune the results'],
  },
  {
    id: 'modes',
    title: 'Modes',
    summary: 'Pick the workspace that matches what you are trying to do.',
    points: [
      'Auto Detect is for live speech. It listens for action, mood, location, weather, creatures, combat, and story changes.',
      'Table Top RPG is for game sessions. It is built around encounters, locations, ambience, combat music, and dramatic effects.',
      'Story Teller is for reading or performing narrative scenes with reactive support from the sound engine.',
      'Creator Studio is for uploaded media, transcripts, cue maps, preview mixes, and exports.',
      'Control Board is for manual buttons that trigger music, ambience, SFX, and custom recordings.',
      'Sing Backing is for vocal performance, tempo feel, and backing support.',
    ],
    workflow: ['Choose the mode', 'Set music and SFX levels', 'Start listening or pick sounds by hand', 'Adjust mood', 'Stop or change scenes as needed'],
  },
  {
    id: 'auto-detect',
    title: 'Auto Detect',
    summary: 'Use this when you want SuiteRhythm to react while you speak.',
    points: [
      'Auto Detect listens to spoken words and uses local trigger rules plus server analysis to choose audio.',
      'Short action words can fire instantly. Examples include thunder, knock, door, sword, bird, applause, and heartbeat.',
      'Mood bias affects whether the app leans calm, tense, heroic, eerie, or intense.',
      'If a sound is not right for your session, disable it in Sound Library so it stops being selected.',
    ],
    workflow: ['Press the listen control', 'Speak naturally', 'Let music and SFX respond', 'Use undo music if needed', 'Tune disabled sounds in the library'],
  },
  {
    id: 'sound-library',
    title: 'Sound Library',
    summary: 'Use this to find, preview, filter, review, disable, record, and upload audio.',
    points: [
      'The library has 999 catalog entries across music, SFX, and ambience.',
      'Search accepts names, moods, genres, objects, actions, and keyword tags.',
      'Filters let you narrow by music, SFX, ambience, custom sounds, recently added sounds, disabled sounds, and review status.',
      'Review buttons let you mark sounds as approved, needs review, or rejected. This review state stays in your browser for now.',
      'The audit panel shows totals, old prefix issues, tag coverage, disabled counts, and review progress.',
      'Disable is useful when a sound is technically correct but wrong for your table, stream, story, or tone.',
    ],
    workflow: ['Search for a sound', 'Preview it', 'Approve or reject it', 'Disable unwanted items', 'Use tags to find related audio'],
  },
  {
    id: 'control-board',
    title: 'Control Board',
    summary: 'Use this for manual playback when you want direct control.',
    points: [
      'Buttons can play music, ambience, SFX, or custom recordings.',
      'Music and ambience loop until stopped. SFX play once.',
      'Scene tabs help you organize buttons by encounter, location, character, act, show segment, or stream scene.',
      'Search can find saved catalog sounds and local custom recordings from the Voice Recorder.',
      'Recent sounds help you build new buttons faster once you are in a session flow.',
    ],
    workflow: ['Open Control Board', 'Create a scene tab', 'Add a sound button', 'Search by mood or action', 'Place the button where it makes sense'],
  },
  {
    id: 'voice-recorder',
    title: 'Voice Recorder',
    summary: 'Use this to create custom sounds, music snippets, ambience beds, voice lines, and character cues.',
    points: [
      'Open it from Sound Library, then Custom Sounds, then Record Sound.',
      'Save recordings as SFX, music, or ambience. Music and ambience can loop on the Control Board.',
      'Voice effects include clean, warm, bright, radio, monster, and whisper.',
      'Recording is captured clean, so you can switch the voice effect after recording and press play to compare. The effect you leave selected is the one that gets saved.',
      'Input gain changes the microphone level before saving. Noise gate reduces quiet room noise. Monitor lets you hear the processed sound while recording.',
      'Tags make recordings searchable. Notes help you remember where a sound belongs.',
      'Custom recordings currently live in browser storage on this device. Moving them to cloud storage is a later upgrade.',
    ],
    workflow: ['Open Record Sound', 'Set gain and gate', 'Record', 'Preview', 'Try different effects', 'Save with tags'],
  },
  {
    id: 'creator-studio',
    title: 'Creator Studio',
    summary: 'Use this for timeline based work with uploaded media and planned cues.',
    points: [
      'Live mode is for active performance and creator narration.',
      'Studio mode is for uploaded audio or video, transcripts, cue maps, preview mixes, and rendered exports.',
      'Cue maps connect phrases or timestamps to sounds, music, ambience, fades, and stop commands.',
      'Preview Mix lets you hear the media and cue timing before rendering the final output.',
      'Render tools create a finished audio or video mix when the cue map is ready.',
    ],
    workflow: ['Upload media', 'Generate or paste transcript', 'Add cues', 'Preview the mix', 'Adjust timing', 'Render export'],
  },
  {
    id: 'story-tools',
    title: 'Story Tools',
    summary: 'Use these when you are writing or reading a scene instead of improvising live.',
    points: [
      'Story Editor stores story or campaign text and can build cue maps for planned playback.',
      'Story Teller is better for performing a written scene while letting the engine react to pacing and mood.',
      'Set the Scene gives the engine extra context so it can make better choices for genre, place, tone, and world details.',
      'Saved stories are useful for repeat sessions, rehearsals, and prepared episodes.',
    ],
    workflow: ['Write or paste a scene', 'Add context', 'Save it', 'Open Story Teller', 'Start playback or live narration'],
  },
  {
    id: 'settings',
    title: 'Settings',
    summary: 'Use settings to tune how loud, fast, intense, and visual the app feels.',
    points: [
      'Music level controls backing music. SFX level controls effects. Ambience has separate behavior through mode and sound choice.',
      'Mood bias moves the sound engine between calm and intense choices.',
      'Low latency mode warms more instant trigger sounds for faster response on strong devices and networks.',
      'Music ducking lowers music while effects play so important sounds cut through clearly.',
      'Theme controls change the look of the app without changing audio behavior.',
    ],
    workflow: ['Set music level', 'Set SFX level', 'Pick mood bias', 'Enable low latency if needed', 'Save your preferred theme'],
  },
  {
    id: 'obs',
    title: 'OBS and Stream Use',
    summary: 'Use this when SuiteRhythm is part of a stream, show, or external control setup.',
    points: [
      'The OBS route is made for browser source use and a cleaner streaming view.',
      'External controls can trigger sounds, stop audio, switch scenes, and inspect status through the browser command surface.',
      'Twitch chat support can listen for simple sound commands without needing OAuth.',
      'Use Control Board for planned live buttons and Auto Detect for narration driven sound.',
    ],
    workflow: ['Open the OBS route', 'Add it as a browser source', 'Set transparent or scene layout options', 'Test audio triggers', 'Use Control Board during the show'],
  },
  {
    id: 'audio-engine',
    title: 'Audio Engine',
    summary: 'Learn what happens after the app chooses a sound.',
    points: [
      'Howler handles playback while custom engine code manages layering, fading, volume, caching, and source fallbacks.',
      'Instant trigger sounds are preloaded within a byte budget so common effects respond quickly without huge startup downloads.',
      'Music crossfades smooth out track changes. Ducking gives SFX space. Disabled sounds are skipped during matching.',
      'Cloudflare R2 stores the audio files under the sounds prefix. The app can serve through the current proxy or a future custom CDN domain.',
    ],
    workflow: ['Sound is selected', 'URL is normalized', 'Cache is checked', 'Audio starts', 'Volume and fades are applied'],
  },
  {
    id: 'audit',
    title: 'Sound Audit',
    summary: 'Use this when you want to maintain the catalog instead of perform with it.',
    points: [
      'The in app audit panel gives quick local counts and review status.',
      'The admin audit page at /admin/sounds gives a larger catalog overview.',
      'Catalog health checks catch malformed entries, duplicate names, duplicate files, old prefixes, and missing R2 objects.',
      'Keyword checks keep search terms rich enough for matching and discovery.',
    ],
    workflow: ['Open Sound Library', 'Review audit cards', 'Open /admin/sounds', 'Run catalog checks before deployment', 'Fix missing metadata'],
  },
  {
    id: 'trouble-shooting',
    title: 'Trouble Shooting',
    summary: 'Use this when the app starts but something feels wrong.',
    points: [
      'If the old login or payment screen appears, unregister the service worker and hard refresh after the latest deployment is live.',
      'If the microphone does not start, check browser permission and make sure the page has focus.',
      'If audio does not play, click anywhere in the app first so the browser allows playback.',
      'If AI, transcription, or TTS fails, check provider keys and quota in Vercel.',
      'If a catalog sound is missing, run catalog health with R2 enabled.',
      'If custom recordings disappear, browser storage was likely cleared or you opened a different browser profile.',
    ],
    workflow: ['Check deployment status', 'Hard refresh', 'Check microphone permission', 'Open DevTools console', 'Run local validation if needed'],
  },
];

const quickPaths = [
  { need: 'I want sounds to react while I talk', use: 'Auto Detect', target: 'auto-detect' },
  { need: 'I want manual sound buttons', use: 'Control Board', target: 'control-board' },
  { need: 'I want to find or disable sounds', use: 'Sound Library', target: 'sound-library' },
  { need: 'I want to record my own voice cue', use: 'Voice Recorder', target: 'voice-recorder' },
  { need: 'I want to score uploaded media', use: 'Creator Studio', target: 'creator-studio' },
  { need: 'I want stream friendly output', use: 'OBS', target: 'obs' },
  { need: 'I want to check catalog health', use: 'Sound Audit', target: 'audit' },
  { need: 'Something is not working', use: 'Trouble Shooting', target: 'trouble-shooting' },
];

export const metadata = {
  title: 'SuiteRhythm Tutorial',
  description: 'A complete user guide for SuiteRhythm modes, tools, sound library, recorder, and control workflows.',
};

export default function TutorialPage() {
  return (
    <main id="top" className="tutorial-page">
      <section className="tutorial-hero-panel">
        <Link href="/" className="tutorial-back-link">Back to App</Link>
        <p className="tutorial-kicker">Complete Guide</p>
        <h1>SuiteRhythm Tutorial</h1>
        <p>
          Learn what every mode and tool does, where to find it, and which workflow to use for your session.
        </p>
      </section>

      <section className="tutorial-layout">
        <aside className="tutorial-sidebar" aria-label="Tutorial sections">
          <h2>Learn by Area</h2>
          <nav>
            {tutorialSections.map((section) => (
              <a key={section.id} href={`#${section.id}`}>{section.title}</a>
            ))}
          </nav>
        </aside>

        <div className="tutorial-main-column">
          <section className="tutorial-decision-panel">
            <h2>What do you need right now?</h2>
            <div className="tutorial-decision-grid">
              {quickPaths.map((item) => (
                <a key={item.target} href={`#${item.target}`} className="tutorial-decision-card">
                  <span>{item.need}</span>
                  <strong>{item.use}</strong>
                </a>
              ))}
            </div>
          </section>

          {tutorialSections.map((section) => (
            <section key={section.id} id={section.id} className="tutorial-detail-section">
              <div className="tutorial-section-heading">
                <span>{section.title}</span>
                <a href="#top">Top</a>
              </div>
              <h2>{section.title}</h2>
              <p className="tutorial-summary">{section.summary}</p>
              <div className="tutorial-detail-grid">
                <div>
                  <h3>What to know</h3>
                  <ul>
                    {section.points.map((point) => <li key={point}>{point}</li>)}
                  </ul>
                </div>
                <div>
                  <h3>Typical workflow</h3>
                  <ol>
                    {section.workflow.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                </div>
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
