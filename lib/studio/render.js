import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import ffmpegStaticPath from 'ffmpeg-static';
import { getRenderableCues, validateCueMap } from './cue-map.js';
import { joinAudioUrlBase } from '../modules/audio-url.js';

const RENDER_TIMEOUT_MS = Number(process.env.STUDIO_RENDER_TIMEOUT_MS || 120_000);

export function getFfmpegBinaryPath() {
  return process.env.FFMPEG_PATH || ffmpegStaticPath || 'ffmpeg';
}

export function getRenderFileName(cueMap, outputType, outputFormat) {
  const base = sanitizeFileName(cueMap?.media?.name || 'studio-render');
  const ext = outputType === 'video' ? 'mp4' : outputFormat === 'mp3' ? 'mp3' : 'wav';
  return `${base}-mix.${ext}`;
}

export async function renderStudioMedia({ mediaFile, cueMap, outputType = 'audio', outputFormat = 'wav' }) {
  const validation = validateCueMap(cueMap, { requireCues: true });
  if (!validation.valid) {
    throw new RenderError(`Invalid cue map: ${validation.errors.join(' ')}`, 400);
  }

  const normalizedCueMap = validation.cueMap;
  if (outputType === 'video' && normalizedCueMap.media.kind !== 'video') {
    throw new RenderError('Video export requires a video source track.', 400);
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'suiterhythm-studio-'));
  try {
    const inputExt = extensionFromName(mediaFile?.name) || extensionFromType(mediaFile?.type) || (normalizedCueMap.media.kind === 'video' ? '.mp4' : '.webm');
    const mediaPath = path.join(tempDir, `source${inputExt}`);
    await fs.writeFile(mediaPath, Buffer.from(await mediaFile.arrayBuffer()));

    const cues = getRenderableCues(normalizedCueMap);
    const cueAssets = await resolveCueAssets(cues, tempDir);
    const output = buildOutputSpec(outputType, outputFormat, tempDir);
    const args = buildFfmpegArgs({ mediaPath, cueAssets, outputPath: output.path, outputType, outputFormat: output.format });

    await runFfmpeg(args);
    const buffer = await fs.readFile(output.path);

    return {
      buffer,
      contentType: output.contentType,
      fileName: getRenderFileName(normalizedCueMap, outputType, output.format),
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function resolveCueAssets(cues, tempDir) {
  const cache = new Map();
  const assets = [];

  for (const cue of cues) {
    const source = cue.soundDataUrl || cue.soundSrc;
    if (!source) continue;

    if (!cache.has(source)) {
      cache.set(source, await writeSourceToTempFile(source, tempDir, cache.size));
    }

    assets.push({ cue, filePath: cache.get(source) });
  }

  return assets;
}

async function writeSourceToTempFile(source, tempDir, index) {
  if (source.startsWith('data:')) {
    const parsed = parseDataUrl(source);
    const ext = extensionFromType(parsed.contentType) || '.audio';
    const filePath = path.join(tempDir, `cue-${index}${ext}`);
    await fs.writeFile(filePath, parsed.buffer);
    return filePath;
  }

  if (/^https?:\/\//i.test(source)) {
    return downloadSourceToTempFile(source, tempDir, index);
  }

  const localPath = await resolveLocalPublicPath(source);
  if (localPath) return localPath;

  return downloadSourceToTempFile(buildR2Url(source), tempDir, index);
}

async function resolveLocalPublicPath(source) {
  const cleaned = decodeURIComponent(String(source).replace(/^\/+/, ''));
  if (!cleaned || cleaned.includes('..')) return null;
  const candidate = path.join(process.cwd(), 'public', cleaned);
  try {
    await fs.access(candidate);
    return candidate;
  } catch {
    return null;
  }
}

async function downloadSourceToTempFile(url, tempDir, index) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new RenderError(`Could not load cue sound (${response.status}).`, 502);
  }
  const contentType = response.headers.get('content-type') || '';
  const ext = extensionFromType(contentType) || extensionFromName(new URL(url).pathname) || '.audio';
  const filePath = path.join(tempDir, `cue-${index}${ext}`);
  await fs.writeFile(filePath, Buffer.from(await response.arrayBuffer()));
  return filePath;
}

function buildR2Url(source) {
  const base = String(
    process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_CDN_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '',
  ).trim();
  if (!base) {
    throw new RenderError('Sound storage is not configured (set R2_PUBLIC_URL).', 500);
  }
  const cleaned = String(source).replace(/^\/+/, '').replace(/^r2-audio\//, '');
  return joinAudioUrlBase(base, cleaned);
}

function buildOutputSpec(outputType, outputFormat, tempDir) {
  if (outputType === 'video') {
    return { path: path.join(tempDir, 'render.mp4'), format: 'mp4', contentType: 'video/mp4' };
  }

  if (outputFormat === 'mp3') {
    return { path: path.join(tempDir, 'render.mp3'), format: 'mp3', contentType: 'audio/mpeg' };
  }

  return { path: path.join(tempDir, 'render.wav'), format: 'wav', contentType: 'audio/wav' };
}

export function buildFfmpegArgs({ mediaPath, cueAssets, outputPath, outputType, outputFormat }) {
  const args = ['-y', '-i', mediaPath];
  cueAssets.forEach(({ cue, filePath }) => {
    if (cue.repeatMode === 'loop' && cue.duration > 0) args.push('-stream_loop', '-1');
    args.push('-i', filePath);
  });

  const filters = ['[0:a]aresample=48000,volume=1[basea]'];
  const mixInputs = ['[basea]'];

  cueAssets.forEach(({ cue }, assetIndex) => {
    const inputIndex = assetIndex + 1;
    const delayMs = Math.round(Math.max(0, cue.renderTime) * 1000);
    const requestedVolume = Number(cue.volume);
    const volume = (Number.isFinite(requestedVolume) ? requestedVolume : 0.75).toFixed(3);
    const label = `cue${assetIndex}`;
    const trimStart = Math.max(0, Number(cue.trimStart) || 0);
    const duration = Math.max(0, Number(cue.duration) || 0);
    const playbackRate = Math.max(0.5, Math.min(2, Number(cue.playbackRate) || 1));
    let filter = `[${inputIndex}:a]aresample=48000`;
    if (trimStart > 0) filter += `,atrim=start=${trimStart}`;
    filter += ',asetpts=PTS-STARTPTS';
    if (playbackRate !== 1) filter += `,atempo=${playbackRate}`;
    if (duration > 0) filter += `,atrim=duration=${duration},asetpts=PTS-STARTPTS`;
    filter += `,volume=${volume}`;
    if (cue.fadeIn > 0) filter += `,afade=t=in:st=0:d=${cue.fadeIn}`;
    if (cue.fadeOut > 0) {
      const fadeStart = duration > 0 ? Math.max(0, duration - cue.fadeOut) : 0;
      if (duration > 0) filter += `,afade=t=out:st=${fadeStart}:d=${cue.fadeOut}`;
    }
    filter += `,adelay=${delayMs}:all=1[${label}]`;
    filters.push(filter);
    mixInputs.push(`[${label}]`);
  });

  filters.push(`${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=longest:dropout_transition=0,alimiter=limit=0.95[mix]`);

  args.push('-filter_complex', filters.join(';'));

  if (outputType === 'video') {
    args.push('-map', '0:v:0', '-map', '[mix]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', outputPath);
    return args;
  }

  if (outputFormat === 'mp3') {
    args.push('-map', '[mix]', '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', outputPath);
    return args;
  }

  args.push('-map', '[mix]', '-vn', '-c:a', 'pcm_s16le', outputPath);
  return args;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(getFfmpegBinaryPath(), args, { windowsHide: true });
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new RenderError('Render timed out before ffmpeg finished.', 504));
    }, RENDER_TIMEOUT_MS);

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(new RenderError(`ffmpeg could not start: ${err.message}`, 500));
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new RenderError(`ffmpeg render failed.${stderr ? ` ${stderr}` : ''}`, 500));
    });
  });
}

function parseDataUrl(source) {
  const match = source.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) throw new RenderError('Invalid custom sound data URL.', 400);
  const contentType = match[1] || 'application/octet-stream';
  const body = match[3] || '';
  const buffer = match[2] ? Buffer.from(body, 'base64') : Buffer.from(decodeURIComponent(body));
  return { contentType, buffer };
}

function extensionFromName(name = '') {
  const ext = path.extname(String(name).split('?')[0]).toLowerCase();
  return ext && ext.length <= 8 ? ext : '';
}

function extensionFromType(type = '') {
  const normalized = type.split(';')[0].trim().toLowerCase();
  const map = {
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'audio/wav': '.wav',
    'audio/x-wav': '.wav',
    'audio/webm': '.webm',
    'audio/ogg': '.ogg',
    'audio/mp4': '.m4a',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
  };
  return map[normalized] || '';
}

function sanitizeFileName(name) {
  return String(name)
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || `studio-render-${crypto.randomUUID().slice(0, 8)}`;
}

export class RenderError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'RenderError';
    this.status = status;
  }
}