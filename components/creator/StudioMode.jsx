'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import CueTimeline from './CueTimeline';
import PreviewMixer, { playCue } from './PreviewMixer';
import SoundCueEditor from './SoundCueEditor';
import TranscriptSelector from './TranscriptSelector';
import UploadRecorder from './UploadRecorder';
import {
  buildFallbackTranscript,
  buildStudioCueMap,
  migrateCueMap,
  normalizeStudioSound,
  validateCueMap,
} from '../../lib/studio/cue-map';

const STORAGE_KEY = 'SuiteRhythm_studio_cue_map';
const MB = 1024 * 1024;
const DEFAULT_DIRECT_TRANSCRIBE_MAX_MB = 4;
const DEFAULT_STAGED_TRANSCRIBE_MAX_MB = 100;

export default function StudioMode({ active }) {
  const mediaRef = useRef(null);
  const importInputRef = useRef(null);
  const singleCueAudioRef = useRef([]);
  const [media, setMedia] = useState(null);
  const [soundCatalog, setSoundCatalog] = useState([]);
  const [soundError, setSoundError] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptItems, setTranscriptItems] = useState([]);
  const [transcriptText, setTranscriptText] = useState('');
  const [manualTranscript, setManualTranscript] = useState('');
  const [transcriptError, setTranscriptError] = useState('');
  const [transcriptStatus, setTranscriptStatus] = useState('');
  const [selectedRange, setSelectedRange] = useState(null);
  const [cues, setCues] = useState([]);
  const [cueToEdit, setCueToEdit] = useState(null);
  const [savedAt, setSavedAt] = useState('');
  const [isRendering, setIsRendering] = useState(false);
  const [renderStatus, setRenderStatus] = useState('');
  const [renderError, setRenderError] = useState('');
  const [studioStatus, setStudioStatus] = useState(null);
  const maxImportFileMb = getMaxStudioImportFileMb(studioStatus);

  useEffect(() => {
    if (!active || soundCatalog.length) return;
    let cancelled = false;
    fetch('/api/sounds', { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`Sound catalog returned ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        const serverSounds = Array.isArray(data?.sounds) ? data.sounds.map(normalizeSoundRecord) : [];
        const customSounds = loadCustomSounds();
        setSoundCatalog([...customSounds, ...serverSounds]);
        setSoundError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setSoundError(err?.message || 'Sound catalog failed to load.');
      });
    return () => { cancelled = true; };
  }, [active, soundCatalog.length]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    getAuthToken()
      .then((token) => fetch('/api/studio/status', {
        cache: 'no-cache',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }))
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!cancelled && data) setStudioStatus(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [active]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = migrateCueMap(JSON.parse(raw));
      setCues(saved.cues);
      setTranscriptItems(saved.transcript.items);
      setTranscriptText(saved.transcript.text);
      setSavedAt(saved.updatedAt || saved.createdAt || '');
    } catch (_) {}
  }, []);

  useEffect(() => () => {
    if (media?.url) URL.revokeObjectURL(media.url);
  }, [media?.url]);

  useEffect(() => () => stopAudioBucket(singleCueAudioRef.current), []);

  const selection = useMemo(() => {
    if (!selectedRange) return null;
    const items = transcriptItems.slice(selectedRange.startIndex, selectedRange.endIndex + 1);
    if (!items.length) return null;
    return {
      phrase: items.map((item) => item.text).join(' ').replace(/\s+([,.!?;:])/g, '$1'),
      startTime: items[0].start || 0,
      endTime: items[items.length - 1].end || items[0].end || items[0].start || 0,
    };
  }, [selectedRange, transcriptItems]);

  const handleMediaChange = (file, kind) => {
    setMedia((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return {
        file,
        kind,
        name: file.name,
        url: URL.createObjectURL(file),
        duration: 0,
      };
    });
    setSelectedRange(null);
    setCueToEdit(null);
    setTranscriptError('');
    setTranscriptStatus('');
    setRenderError('');
    setRenderStatus('');
  };

  const handleDurationChange = (duration) => {
    setMedia((current) => current ? { ...current, duration } : current);
  };

  const transcribeTrack = async () => {
    if (!media?.file) {
      setTranscriptError('Load a track before transcribing.');
      return;
    }
    setIsTranscribing(true);
    setTranscriptError('');
    setTranscriptStatus('Preparing upload...');
    try {
      const token = await getAuthToken();
      const data = await transcribeMedia({ media, token, studioStatus, onStatus: setTranscriptStatus });
      setTranscriptText(data.text || '');
      setTranscriptItems(Array.isArray(data.words) ? data.words : []);
      setSelectedRange(null);
      setTranscriptStatus(`${Array.isArray(data.words) ? data.words.length : 0} Cue Words ready.`);
    } catch (err) {
      setTranscriptError(err?.message || 'Transcription failed.');
      setTranscriptStatus('');
    } finally {
      setIsTranscribing(false);
    }
  };

  const useManualTranscript = () => {
    const items = buildFallbackTranscript(manualTranscript, media?.duration || 0);
    setTranscriptText(manualTranscript.trim());
    setTranscriptItems(items);
    setTranscriptError('');
    setSelectedRange(null);
  };

  const saveCue = (cue) => {
    setCues((current) => {
      const exists = current.some((item) => item.id === cue.id);
      return exists ? current.map((item) => item.id === cue.id ? cue : item) : [...current, cue];
    });
    setCueToEdit(null);
    setSelectedRange(null);
  };

  const saveCueMap = () => {
    const saved = new Date().toISOString();
    const cueMap = buildCueMap({ media, transcriptText, transcriptItems, cues, savedAt: saved });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cueMap));
    setSavedAt(saved);
    setRenderStatus('Cue map saved locally.');
  };

  const exportCueMap = () => {
    const cueMap = buildCueMap({ media, transcriptText, transcriptItems, cues, savedAt: new Date().toISOString() });
    const blob = new Blob([JSON.stringify(cueMap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeFileName(media?.name || 'studio-cue-map')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importCueMap = async (file) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const validation = validateCueMap(data);
      if (!validation.valid) throw new Error(validation.errors.join(' '));
      setCues(validation.cueMap.cues);
      setTranscriptItems(validation.cueMap.transcript.items);
      setTranscriptText(validation.cueMap.transcript.text);
      setSavedAt(validation.cueMap.updatedAt || validation.cueMap.createdAt || '');
      setTranscriptError('');
      setRenderError('');
      setRenderStatus('Cue map imported.');
    } catch (err) {
      setTranscriptError(err?.message || 'Cue map import failed.');
    }
  };

  const renderCueMap = async (outputType) => {
    if (!media?.file) {
      setRenderError('Load a track before rendering.');
      return;
    }
    const cueMap = buildCueMap({ media, transcriptText, transcriptItems, cues, savedAt: new Date().toISOString() });
    const validation = validateCueMap(cueMap, { requireCues: true });
    if (!validation.valid) {
      setRenderError(validation.errors.join(' '));
      return;
    }

    setIsRendering(true);
    setRenderError('');
    setRenderStatus(outputType === 'video' ? 'Rendering video mix...' : 'Rendering audio mix...');
    try {
      const formData = new FormData();
      formData.append('media', media.file);
      formData.append('cueMap', JSON.stringify(validation.cueMap));
      formData.append('outputType', outputType);
      formData.append('outputFormat', 'wav');
      const token = await getAuthToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const response = await fetch('/api/studio/render', { method: 'POST', headers, body: formData });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || `Render returned ${response.status}`);
      }

      const blob = await response.blob();
      const fallbackName = `${sanitizeFileName(media.name || 'studio-render')}-mix.${outputType === 'video' ? 'mp4' : 'wav'}`;
      downloadBlob(blob, getDownloadFileName(response.headers.get('content-disposition'), fallbackName));
      setRenderStatus(outputType === 'video' ? 'Rendered video downloaded.' : 'Rendered audio downloaded.');
    } catch (err) {
      setRenderError(err?.message || 'Render failed.');
      setRenderStatus('');
    } finally {
      setIsRendering(false);
    }
  };

  const deleteCue = (cueId) => setCues((current) => current.filter((cue) => cue.id !== cueId));
  const updateCueOffset = (cueId, offset) => setCues((current) => current.map((cue) => cue.id === cueId ? { ...cue, offset } : cue));
  const updateCueDuration = (cueId, duration) => setCues((current) => current.map((cue) => cue.id === cueId ? { ...cue, duration: Math.max(0, Number(duration) || 0) } : cue));
  const previewSingleCue = (cue) => {
    stopAudioBucket(singleCueAudioRef.current);
    playCue(cue, singleCueAudioRef.current);
  };

  return (
    <div className={`creator-mode-panel studio-mode${active ? '' : ' hidden'}`} role="tabpanel" aria-label="Studio Mode">
      <p className="section-intro">
        Upload or record a track, select words in the transcript, add sound cues, and preview before publishing.
      </p>
      <div className="studio-grid">
        <div className="studio-main-column">
          <UploadRecorder
            ref={mediaRef}
            media={media}
            maxFileMb={maxImportFileMb}
            onMediaChange={handleMediaChange}
            onDurationChange={handleDurationChange}
          />

          <section className="studio-panel studio-transcribe-panel">
            <div className="studio-panel-heading">
              <span className="studio-step">Step 2</span>
              <h3>Transcribe</h3>
            </div>
            <div className="studio-action-row">
              <button type="button" className="btn-primary" onClick={transcribeTrack} disabled={!media || isTranscribing}>
                {isTranscribing ? 'Transcribing...' : 'Transcribe Track'}
              </button>
              <span className="studio-muted-text">{getTranscriptStatusText(transcriptItems, studioStatus)}</span>
            </div>
            {transcriptError && <div className="studio-error">{transcriptError}</div>}
            {transcriptStatus && <div className="studio-preview-status">{transcriptStatus}</div>}
            <div className="manual-transcript-box">
              <textarea
                value={manualTranscript}
                rows="3"
                placeholder="Paste transcript text"
                onChange={(event) => setManualTranscript(event.target.value)}
              />
              <button type="button" className="btn-secondary" onClick={useManualTranscript} disabled={!manualTranscript.trim()}>Use Manual Transcript</button>
            </div>
          </section>

          <TranscriptSelector
            transcriptItems={transcriptItems}
            selectedRange={selectedRange}
            onSelectRange={setSelectedRange}
            onClearSelection={() => setSelectedRange(null)}
            isLoading={isTranscribing}
          />

          <CueTimeline
            cues={cues}
            onPreviewCue={previewSingleCue}
            onEditCue={setCueToEdit}
            onDeleteCue={deleteCue}
            onOffsetChange={updateCueOffset}
            onDurationChange={updateCueDuration}
          />
        </div>

        <aside className="studio-side-column">
          {soundError && <div className="studio-error">{soundError}</div>}
          <SoundCueEditor
            selection={selection}
            sounds={soundCatalog}
            cueToEdit={cueToEdit}
            onSave={saveCue}
            onCancel={() => { setCueToEdit(null); setSelectedRange(null); }}
          />
          <PreviewMixer mediaRef={mediaRef} cues={cues} onPreviewCue={previewSingleCue} />
          <section className="studio-panel studio-export-panel">
            <div className="studio-panel-heading">
              <span className="studio-step">Step 6</span>
              <h3>Save/Export</h3>
            </div>
            <div className="studio-action-row stack">
              <button type="button" className="btn-primary" onClick={saveCueMap} disabled={!cues.length}>Save Cue Map</button>
              <button type="button" className="btn-secondary" onClick={exportCueMap} disabled={!cues.length}>Export Cue Map JSON</button>
              <button type="button" className="btn-secondary" onClick={() => renderCueMap('audio')} disabled={!media || !cues.length || isRendering}>
                {isRendering ? 'Rendering...' : 'Export Rendered Audio'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => renderCueMap('video')} disabled={!media || media.kind !== 'video' || !cues.length || isRendering}>
                Export Rendered Video
              </button>
              <button type="button" className="btn-secondary" onClick={() => importInputRef.current?.click()}>Import Cue Map JSON</button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  importCueMap(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </div>
            {savedAt && <div className="studio-muted-text">Saved {new Date(savedAt).toLocaleString()}</div>}
            {studioStatus?.render && <div className="studio-muted-text">{studioStatus.render.configured ? `Renderer ready (${studioStatus.render.maxFileMb} MB max)` : 'Renderer unavailable'}</div>}
            {renderStatus && <div className="studio-preview-status">{renderStatus}</div>}
            {renderError && <div className="studio-error">{renderError}</div>}
          </section>
        </aside>
      </div>
    </div>
  );
}

function normalizeSoundRecord(sound) {
  return normalizeStudioSound(sound);
}

function loadCustomSounds() {
  try {
    const raw = JSON.parse(localStorage.getItem('SuiteRhythm_custom_sounds') || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.map((sound) => normalizeSoundRecord({ ...sound, type: 'sfx', src: sound.dataUrl }));
  } catch (_) {
    return [];
  }
}

async function getAuthToken() {
  try {
    const response = await fetch('/api/auth/token', { cache: 'no-cache' });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data?.token || null;
  } catch (_) {
    return null;
  }
}

async function transcribeMedia({ media, token, studioStatus, onStatus }) {
  const file = media.file;
  const directMaxMb = Number(studioStatus?.transcription?.directUploadMaxFileMb) || DEFAULT_DIRECT_TRANSCRIBE_MAX_MB;
  const stagedMaxMb = Number(studioStatus?.transcription?.maxFileMb) || DEFAULT_STAGED_TRANSCRIBE_MAX_MB;

  if (file.size > stagedMaxMb * MB) {
    throw new Error(`This file is ${formatFileSize(file.size)}. Studio transcription currently accepts files up to ${stagedMaxMb} MB.`);
  }

  if (file.size > directMaxMb * MB) {
    if (studioStatus?.transcription && !studioStatus.transcription.stagedUploadConfigured) {
      throw new Error(`This file is ${formatFileSize(file.size)}, so it needs secure staged upload. Configure R2 storage for large Studio transcriptions.`);
    }
    return transcribeViaStagedUpload({ media, token, onStatus });
  }

  return transcribeDirectly({ media, token, onStatus });
}

async function transcribeDirectly({ media, token, onStatus }) {
  onStatus(`Uploading ${formatFileSize(media.file.size)} directly...`);
  const formData = new FormData();
  formData.append('file', media.file);
  if (media.duration) formData.append('duration', String(media.duration));
  const response = await fetch('/api/transcribe', {
    method: 'POST',
    headers: authHeaders(token),
    body: formData,
  });
  return parseJsonResponse(response, 'Transcription failed.');
}

async function transcribeViaStagedUpload({ media, token, onStatus }) {
  const file = media.file;
  onStatus(`Requesting secure upload for ${formatFileSize(file.size)}...`);
  const uploadInit = await fetch('/api/studio/upload-url', {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      purpose: 'transcribe',
    }),
  });
  const uploadInfo = await parseJsonResponse(uploadInit, 'Could not prepare secure upload.');

  onStatus('Uploading to secure temporary storage...');
  const uploadResponse = await uploadFileWithProgress({
    uploadUrl: uploadInfo.uploadUrl,
    headers: uploadInfo.headers || { 'Content-Type': file.type || 'application/octet-stream' },
    file,
    onProgress: (percent) => onStatus(`Uploading to secure temporary storage... ${percent}%`),
  });
  if (!uploadResponse.ok) {
    throw new Error(`Temporary upload failed (${uploadResponse.status}). Check R2 CORS allows PUT requests from this site.`);
  }

  onStatus('Preparing audio and transcribing...');
  const transcribeResponse = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadKey: uploadInfo.key,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      duration: media.duration || 0,
    }),
  });
  return parseJsonResponse(transcribeResponse, 'Transcription failed.');
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function uploadFileWithProgress({ uploadUrl, headers, file, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    Object.entries(headers || {}).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status });
    xhr.onerror = () => reject(new Error('Temporary upload failed. Check your network connection.'));
    xhr.send(file);
  });
}

async function parseJsonResponse(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `${fallbackMessage} (${response.status})`);
  return data;
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`;
}

function getMaxStudioImportFileMb(studioStatus) {
  if (!studioStatus) return DEFAULT_STAGED_TRANSCRIBE_MAX_MB;
  const backendLimits = [
    Number(studioStatus?.transcription?.maxFileMb),
    Number(studioStatus?.render?.maxFileMb),
  ].filter((limit) => Number.isFinite(limit) && limit > 0);
  return backendLimits.length ? Math.max(...backendLimits) : DEFAULT_STAGED_TRANSCRIBE_MAX_MB;
}

function buildCueMap({ media, transcriptText, transcriptItems, cues, savedAt }) {
  return buildStudioCueMap({ media, transcriptText, transcriptItems, cues, savedAt });
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function getDownloadFileName(contentDisposition, fallback) {
  const match = String(contentDisposition || '').match(/filename="?([^";]+)"?/i);
  return match?.[1] || fallback;
}

function getTranscriptStatusText(transcriptItems, studioStatus) {
  if (transcriptItems.length) return `${transcriptItems.length} Cue Words ready`;
  if (studioStatus?.transcription?.configured) return 'Server transcription ready';
  if (studioStatus) return 'Manual transcript fallback ready';
  return 'No transcript loaded';
}

function sanitizeFileName(name) {
  return name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'studio-cue-map';
}

function stopAudioBucket(bucket) {
  bucket.splice(0).forEach(({ audio }) => {
    audio.pause();
    audio.currentTime = 0;
  });
}
