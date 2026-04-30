// ═══════════════════════════════════════════════════════════
// Vite Stream Plugin — FFmpeg Integration (No Backend Needed)
// ═══════════════════════════════════════════════════════════
// All FFmpeg / upload logic runs inside Vite's dev server.
// Frontend calls the same /api/* endpoints via relative URLs.

import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';
import crypto from 'crypto';
import { getDb, dbLog } from '../db/init.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Active FFmpeg processes ──
const activeStreams = new Map();

// ── Adaptive Quality Tiers ──
const QUALITY_TIERS = [
  { tier: 1, name: '360p',  resolution: '640x360',   bitrate: '600',   fps: '24', keyint: 48 },
  { tier: 2, name: '480p',  resolution: '854x480',   bitrate: '1000',  fps: '30', keyint: 60 },
  { tier: 3, name: '720p',  resolution: '1280x720',  bitrate: '2500',  fps: '30', keyint: 60 },
  { tier: 4, name: '1080p', resolution: '1920x1080', bitrate: '4500',  fps: '30', keyint: 60 },
  { tier: 5, name: '4K',    resolution: '3840x2160', bitrate: '15000', fps: '30', keyint: 60 },
];

function getMaxTier() {
  const cores = os.cpus().length;
  if (cores >= 4) return 5;
  if (cores >= 2) return 4;
  return 3;
}

function resolutionToTier(res) {
  const map = { '3840x2160': 5, '1920x1080': 4, '1280x720': 3, '854x480': 2, '640x360': 1 };
  return map[res] || 3;
}

function buildStreamArgs({ mergedVideo, mergedAudio, vfFilter, tier, fullRtmpUrl, isRtmps }) {
  const [w, h] = tier.resolution.split('x');
  const needsEncode = !!vfFilter;

  let args = [];
  if (!mergedVideo && mergedAudio) {
    // Audio-only: must encode generated black video
    args = ['-re', '-stream_loop', '-1', '-i', mergedAudio,
      '-f', 'lavfi', '-i', `color=c=black:s=${w}x${h}:r=${tier.fps}`,
      '-map', '1:v:0', '-map', '0:a:0',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-threads', '1',
      '-profile:v', 'baseline', '-pix_fmt', 'yuv420p',
      '-b:v', `${tier.bitrate}k`, '-bufsize', `${parseInt(tier.bitrate) * 2}k`,
      '-g', `${tier.keyint}`, '-keyint_min', `${tier.keyint}`, '-sc_threshold', '0',
      '-c:a', 'copy',
      '-flvflags', 'no_duration_filesize', '-avoid_negative_ts', 'make_zero'];
  } else if (needsEncode) {
    // Encode mode — overlays require re-encoding
    const scaleFilter = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`;
    const fullVf = vfFilter ? `${scaleFilter},${vfFilter}` : scaleFilter;
    const enc = [
      '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-threads', '1',
      '-profile:v', 'baseline', '-level', '3.1', '-r', tier.fps, '-vf', fullVf,
      '-b:v', `${tier.bitrate}k`, '-maxrate', `${tier.bitrate}k`, '-bufsize', `${parseInt(tier.bitrate) * 2}k`,
      '-nal-hrd', 'cbr', '-pix_fmt', 'yuv420p',
      '-g', `${tier.keyint}`, '-keyint_min', `${tier.keyint}`, '-sc_threshold', '0',
      '-x264-params', 'ref=1:bframes=0:cabac=0:trellis=0:8x8dct=0:me=dia:subme=0:weightp=0',
    ];
    if (mergedVideo && mergedAudio) {
      args = ['-re', '-stream_loop', '-1', '-i', mergedVideo, '-stream_loop', '-1', '-i', mergedAudio,
        '-map', '0:v:0', '-map', '1:a:0', ...enc, '-c:a', 'copy',
        '-flvflags', 'no_duration_filesize', '-avoid_negative_ts', 'make_zero'];
    } else if (mergedVideo) {
      // Video with embedded audio — use audio from the same file
      args = ['-re', '-stream_loop', '-1', '-i', mergedVideo,
        '-map', '0:v:0', '-map', '0:a:0?',
        ...enc, '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
        '-flvflags', 'no_duration_filesize', '-avoid_negative_ts', 'make_zero'];
    }
  } else {
    // COPY mode — preprocessed file streamed as-is, ~5% CPU
    if (mergedVideo && mergedAudio) {
      args = ['-re', '-stream_loop', '-1', '-i', mergedVideo, '-stream_loop', '-1', '-i', mergedAudio,
        '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'copy',
        '-flvflags', 'no_duration_filesize', '-avoid_negative_ts', 'make_zero'];
    } else if (mergedVideo) {
      // Video with embedded audio — copy both tracks
      args = ['-re', '-stream_loop', '-1', '-i', mergedVideo,
        '-map', '0:v:0', '-map', '0:a:0?',
        '-c:v', 'copy', '-c:a', 'copy',
        '-flvflags', 'no_duration_filesize', '-avoid_negative_ts', 'make_zero'];
    }
  }

  args.push('-progress', 'pipe:2');
  if (isRtmps) { args.push('-tls_verify', '0', '-f', 'flv', fullRtmpUrl); }
  else { args.push('-f', 'flv', fullRtmpUrl); }
  return args;
}

// Re-encode merged video at a specific tier's bitrate/resolution for adaptive changes
async function reencodeForTier(inputPath, tier, ffmpegBin) {
  const [w, h] = tier.resolution.split('x');
  const outputPath = inputPath.replace(/(\.\w+)$/, `.tier${tier.tier}$1`);

  // Optimization: Reuse existing tier file if the merged video hasn't changed
  if (fs.existsSync(outputPath) && fs.existsSync(inputPath)) {
    const inputStat = fs.statSync(inputPath);
    const outputStat = fs.statSync(outputPath);
    if (outputStat.mtime > inputStat.mtime) {
      console.log(`[Adaptive] Reusing existing tier file: ${path.basename(outputPath)} (${tier.name})`);
      return outputPath;
    } else {
      console.log(`[Adaptive] Original video changed, deleting old tier file: ${path.basename(outputPath)}`);
      fs.unlinkSync(outputPath);
    }
  }

  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-threads', '1',
      '-profile:v', 'baseline', '-level', '3.1',
      '-vf', `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`,
      '-r', `${tier.fps}`,
      '-b:v', `${tier.bitrate}k`, '-minrate', `${tier.bitrate}k`, '-maxrate', `${tier.bitrate}k`,
      '-bufsize', `${parseInt(tier.bitrate) * 2}k`,
      '-nal-hrd', 'cbr', '-pix_fmt', 'yuv420p',
      '-g', `${tier.keyint}`, '-keyint_min', `${tier.keyint}`, '-sc_threshold', '0',
      '-x264-params', 'ref=1:bframes=0:cabac=0:trellis=0:8x8dct=0:me=dia:subme=0:weightp=0',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
      '-metadata', 'comment=yt_ready_v2',
      '-y', outputPath
    ];
    console.log(`[Adaptive] Re-encoding: ${path.basename(inputPath)} → ${tier.name} (${tier.bitrate}kbps)`);
    const proc = spawn(ffmpegBin, args, { shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    proc.stderr.on('data', () => {}); // drain stderr
    proc.on('close', code => {
      if (code === 0 && fs.existsSync(outputPath)) {
        console.log(`[Adaptive] Re-encode done: ${path.basename(outputPath)}`);
        resolve(outputPath);
      } else {
        reject(new Error(`Re-encode failed (code ${code})`));
      }
    });
    proc.on('error', reject);
  });
}

function attachFFmpegHandlers(proc, streamInfo, streamId) {
  proc.stderr.on('data', data => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => {
      streamInfo.logs.push(line);
      if (streamInfo.logs.length > 300) streamInfo.logs.shift();
      if (line.includes('frame=') || line.includes('speed=') || line.startsWith('progress=')) {
        streamInfo.status = 'live';
      }
      const speedMatch = line.match(/speed=\s*([0-9.]+)x/);
      if (speedMatch && streamInfo.adaptive) {
        streamInfo.adaptive.lastSpeed = parseFloat(speedMatch[1]);
      }
      const bitrateMatch = line.match(/bitrate=\s*([0-9.]+)kbits\/s/);
      if (bitrateMatch && streamInfo.adaptive) {
        streamInfo.adaptive.lastBitrate = parseFloat(bitrateMatch[1]);
      }
      if ((line.toLowerCase().includes('connection refused') || line.toLowerCase().includes('error'))
        && !line.includes('frame=') && !line.includes('bitrate=')) {
        streamInfo.error = line;
      }
    });
  });
  proc.stdout.on('data', data => {
    data.toString().split('\n').filter(l => l.trim()).forEach(l => streamInfo.logs.push(l));
  });
}

async function restartStreamWithTier(streamId, newTierNum, reason) {
  const stream = activeStreams.get(streamId);
  if (!stream || !stream.config || stream.adaptive?.changing) return false;
  const tier = QUALITY_TIERS.find(t => t.tier === newTierNum);
  if (!tier) return false;

  stream.adaptive.changing = true;
  const oldTier = stream.adaptive.currentTier;
  console.log(`[Adaptive ${streamId}] Tier ${oldTier} → ${newTierNum} (${tier.name})`);
  stream.logs.push(`[Adaptive] Changing: Tier ${oldTier} → ${newTierNum} (${tier.name})`);
  dbLog('info', 'adaptive', `Stream ${streamId}: Tier ${oldTier} → ${newTierNum} (${tier.name})`);

  // Kill current process — don't wait, start new one immediately for minimal gap
  try { if (stream.process && !stream.process.killed) stream.process.kill('SIGTERM'); } catch {}
  // Brief 200ms for RTMP connection cleanup (prevents "already publishing" errors)
  await new Promise(r => setTimeout(r, 200));

  const { mergedAudio, vfFilter, fullRtmpUrl, isRtmps, ffmpegBin } = stream.config;
  let mergedVideo = stream.config.mergedVideo;

  // Re-encode the file at new tier's bitrate (temporary CPU spike, then back to copy mode)
  if (mergedVideo && !vfFilter) {
    try {
      if (!stream.config.originalMergedVideo) {
        stream.config.originalMergedVideo = mergedVideo;
      }
      stream.logs.push(`[Adaptive] Re-processing for ${tier.name} (${tier.bitrate}kbps)...`);
      const newPath = await reencodeForTier(stream.config.originalMergedVideo, tier, ffmpegBin);
      mergedVideo = newPath;
      stream.config.mergedVideo = newPath;
      stream.logs.push(`[Adaptive] Re-processing done! Restarting in copy mode...`);
    } catch (err) {
      console.error(`[Adaptive ${streamId}] Re-encode failed:`, err.message);
      stream.logs.push(`[Adaptive] Re-encode failed: ${err.message}`);
      stream.adaptive.changing = false;
      return false;
    }
  }

  const args = buildStreamArgs({ mergedVideo, mergedAudio, vfFilter, tier, fullRtmpUrl, isRtmps });
  const proc = spawn(ffmpegBin, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });

  stream.process = proc;
  stream.status = 'live';
  stream.adaptive.currentTier = newTierNum;
  stream.adaptive.lastTierChange = Date.now();
  stream.adaptive.changing = false;
  stream.adaptive.speedSamples = [];
  stream.adaptive.bitrateSamples = [];
  stream.adaptive.stableSince = 0;
  stream.adaptive.tierHistory.push({ time: new Date().toISOString(), from: oldTier, to: newTierNum, reason: reason || '' });

  attachFFmpegHandlers(proc, stream, streamId);
  proc.on('close', code => {
    if (stream.process === proc && !stream.adaptive?.changing) {
      if (code !== 0 && code !== 255) stream.error = `FFmpeg exited (code ${code})`;
      stream.status = (code === 255 || stream.status === 'stopping') ? 'ended' : (code === 0 ? 'ended' : 'error');
    }
  });
  proc.on('error', err => { if (stream.process === proc) { stream.error = err.message; stream.status = 'error'; } });

  console.log(`[Adaptive ${streamId}] Restarted COPY mode: ${tier.name} ${tier.bitrate}kbps, PID: ${proc.pid}`);
  stream.logs.push(`[Adaptive] Now at ${tier.name} (${tier.bitrate}kbps) — copy mode`);
  return true;
}

function startAdaptiveMonitor(streamId) {
  const POLL_INTERVAL = 5000;
  const DOWNGRADE_SAMPLES = 3;        // 15 seconds of poor performance
  const UPGRADE_STABLE_MS = 60000;    // 60 seconds of good performance before upgrading
  const COOLDOWN_MS = 30000;          // 30 seconds between tier changes
  const BITRATE_LOW_RATIO = 0.60;     // Downgrade if actual < 60% of target
  const BITRATE_OK_RATIO = 0.85;      // Consider healthy if actual > 85% of target

  const iv = setInterval(() => {
    const stream = activeStreams.get(streamId);
    if (!stream || stream.status === 'ended' || stream.status === 'error' || stream.status === 'stopping') {
      clearInterval(iv); return;
    }
    if (!stream.adaptive?.enabled || stream.adaptive.changing) return;

    const now = Date.now();
    if (now - (stream.adaptive.lastTierChange || 0) < COOLDOWN_MS) return;

    const speed = stream.adaptive.lastSpeed || 0;
    const actualBitrate = stream.adaptive.lastBitrate || 0;
    const currentTier = QUALITY_TIERS.find(t => t.tier === stream.adaptive.currentTier);
    const targetBitrate = currentTier ? parseInt(currentTier.bitrate) : 2500;

    // Calculate bitrate ratio (how much of the target we're actually delivering)
    const bitrateRatio = targetBitrate > 0 && actualBitrate > 0 ? actualBitrate / targetBitrate : 1;

    // Store samples
    if (!stream.adaptive.bitrateSamples) stream.adaptive.bitrateSamples = [];
    if (actualBitrate > 0) stream.adaptive.bitrateSamples.push(bitrateRatio);
    if (stream.adaptive.bitrateSamples.length > 12) stream.adaptive.bitrateSamples.shift();
    if (speed > 0) {
      stream.adaptive.speedSamples.push(speed);
      if (stream.adaptive.speedSamples.length > 12) stream.adaptive.speedSamples.shift();
    }

    const recentBitrate = stream.adaptive.bitrateSamples.slice(-DOWNGRADE_SAMPLES);
    const avgBitrateRatio = recentBitrate.length > 0 ? recentBitrate.reduce((a, b) => a + b, 0) / recentBitrate.length : 1;
    
    const recentSpeed = stream.adaptive.speedSamples.slice(-DOWNGRADE_SAMPLES);
    const avgSpeed = recentSpeed.length > 0 ? recentSpeed.reduce((a, b) => a + b, 0) / recentSpeed.length : 1;

    // DOWNGRADE: either bitrate too low OR speed too slow
    const bitratePoor = recentBitrate.length >= DOWNGRADE_SAMPLES && avgBitrateRatio < BITRATE_LOW_RATIO;
    const speedPoor = recentSpeed.length >= DOWNGRADE_SAMPLES && avgSpeed < 0.85;
    
    if (bitratePoor || speedPoor) {
      const cur = stream.adaptive.currentTier;
      if (cur > 1) {
        const reason = bitratePoor
          ? `bitrate ${Math.round(actualBitrate)}kbps = ${Math.round(avgBitrateRatio*100)}% of ${targetBitrate}kbps target`
          : `speed avg ${avgSpeed.toFixed(2)}x too slow`;
        console.log(`[Adaptive ${streamId}] DOWNGRADE: ${reason}`);
        restartStreamWithTier(streamId, cur - 1, reason);
      }
      return;
    }

    // UPGRADE: bitrate healthy AND speed OK for sustained period
    const bitrateHealthy = avgBitrateRatio >= BITRATE_OK_RATIO;
    const speedHealthy = avgSpeed >= 1.0 || recentSpeed.length === 0; // no speed data = copy mode, assume OK
    
    if (bitrateHealthy && speedHealthy) {
      if (!stream.adaptive.stableSince) stream.adaptive.stableSince = now;
      if (now - stream.adaptive.stableSince >= UPGRADE_STABLE_MS) {
        const cur = stream.adaptive.currentTier;
        const maxTier = stream.adaptive.maxTier || getMaxTier();
        if (cur < maxTier) {
          restartStreamWithTier(streamId, cur + 1, `bitrate healthy ${Math.round(avgBitrateRatio*100)}% for 60s`);
          stream.adaptive.stableSince = 0;
        }
      }
    } else {
      stream.adaptive.stableSince = 0;
    }
  }, POLL_INTERVAL);

  return iv;
}

// ── Global Console Interceptor for Unified Logging ──
const origLog = console.log;
const origError = console.error;
const origWarn = console.warn;
let _isLogging = false;

console.log = (...args) => {
  origLog(...args);
  if (!_isLogging) {
    _isLogging = true;
    try { dbLog('info', 'backend', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')); } catch(e) {}
    _isLogging = false;
  }
};
console.error = (...args) => {
  origError(...args);
  if (!_isLogging) {
    _isLogging = true;
    try { dbLog('error', 'backend', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')); } catch(e) {}
    _isLogging = false;
  }
};
console.warn = (...args) => {
  origWarn(...args);
  if (!_isLogging) {
    _isLogging = true;
    try { dbLog('warn', 'backend', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')); } catch(e) {}
    _isLogging = false;
  }
};

// ── Network Monitor State ──
let lastNetStats = { rx: 0, tx: 0, time: Date.now() };

// ── Helpers ──
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function getPathParam(url, prefix) {
  // e.g. /api/stream/status/stream_123 → stream_123
  const rest = url.slice(prefix.length);
  return rest.split('?')[0];
}

// ── FFmpeg Helpers ──
async function getVideoInfo(filePath) {
  return new Promise((resolve) => {
    const proc = spawn('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath], { shell: true, windowsHide: true });
    let output = '';
    proc.stdout.on('data', d => output += d);
    proc.on('close', () => {
      try {
        const info = JSON.parse(output);
        const video = info.streams?.find(s => s.codec_type === 'video');
        const audio = info.streams?.find(s => s.codec_type === 'audio');
        const formatTags = info.format?.tags || {};
        const videoTags = video?.tags || {};
        const isYTReady = formatTags.comment === 'yt_ready_v2' || videoTags.comment === 'yt_ready_v2';
        resolve({
          codec: video?.codec_name || 'unknown',
          width: video?.width || 0,
          height: video?.height || 0,
          bitrate: parseInt(video?.bit_rate || info.format?.bit_rate || '0'),
          timescale: parseInt(video?.time_base?.split('/')[1] || '0'),
          audioCodec: audio?.codec_name || 'unknown',
          audioSampleRate: parseInt(audio?.sample_rate || '0'),
          isYTReady: isYTReady
        });
      } catch {
        resolve({ codec: 'unknown', width: 0, height: 0, timescale: 0, audioCodec: 'unknown', audioSampleRate: 0, isYTReady: false });
      }
    });
    proc.on('error', () => resolve({ codec: 'unknown', width: 0, height: 0, timescale: 0, audioCodec: 'unknown', audioSampleRate: 0, isYTReady: false }));
  });
}

async function preprocessVideo(inputPath, config, onLog) {
  const { codec, width, height, bitrate: fileBitrate, timescale, audioCodec, audioSampleRate, isYTReady } = await getVideoInfo(inputPath);
  const needsVideoTranscode = !isYTReady || codec !== 'h264';
  let resStr = config.resolution || '1280x720';
  if (resStr === '1080p') resStr = '1920x1080';
  else if (resStr === '720p') resStr = '1280x720';
  else if (resStr === '480p') resStr = '854x480';
  let [cw, ch] = resStr.split('x').map(Number);
  if (!cw || !ch) { cw = 1280; ch = 720; }
  
  const needsScale = width !== cw || height !== ch;
  const needsTimestampFix = timescale !== 90000;
  const hasAudio = audioCodec !== 'unknown' && audioCodec !== '';
  const needsAudioTranscode = hasAudio && (audioCodec !== 'aac' || audioSampleRate !== 44100);

  // Check if bitrate is significantly different from target (>30% off)
  const targetBitrateKbps = parseInt(config.bitrate) || 2500;
  const fileBitrateKbps = fileBitrate > 0 ? fileBitrate / 1000 : 0;
  const needsBitrateAdjust = fileBitrateKbps > 0 && (Math.abs(fileBitrateKbps - targetBitrateKbps) / targetBitrateKbps > 0.3);
  
  if (needsBitrateAdjust) {
    console.log(`[Preprocess] Bitrate mismatch: file=${Math.round(fileBitrateKbps)}kbps vs target=${targetBitrateKbps}kbps — forcing re-encode`);
  }

  if (!needsVideoTranscode && !needsScale && !needsTimestampFix && !needsAudioTranscode && !needsBitrateAdjust) {
    console.log(`[Preprocess] File already YouTube-ready at correct bitrate (${Math.round(fileBitrateKbps)}kbps) — skipping`);
    return { path: inputPath, needsFilter: false };
  }

  const tmpPath = inputPath + '.tmp.mp4';
  const needsFullEncode = needsVideoTranscode || needsScale || needsBitrateAdjust;
  const vfArgs = needsFullEncode
    ? ['-vf', `scale=${cw}:${ch}:force_original_aspect_ratio=decrease,pad=${cw}:${ch}:(ow-iw)/2:(oh-ih)/2`]
    : [];

  const fpsNum = parseInt(config.fps) || 30;
  const videoBitrateArgs = needsFullEncode
    ? [
        '-r', `${fpsNum}`,
        '-b:v', `${config.bitrate}k`,
        '-minrate', `${config.bitrate}k`,
        '-maxrate', `${config.bitrate}k`,
        '-bufsize', `${parseInt(config.bitrate) * 2}k`,
        '-nal-hrd', 'cbr',
        '-pix_fmt', 'yuv420p',
        '-g', `${fpsNum * 2}`,
        '-keyint_min', `${fpsNum * 2}`,
        '-sc_threshold', '0',
        '-force_key_frames', `expr:gte(t,n_forced*2)`
      ]
    : [];

  const logMsg = `[Preprocess] Processing video: ${path.basename(inputPath)} (encode=${needsFullEncode}, bitrateAdjust=${needsBitrateAdjust}, target=${targetBitrateKbps}kbps)`;
  console.log(logMsg);
  if (onLog) onLog(logMsg);

  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-c:v', needsFullEncode ? 'libx264' : 'copy',
      ...(needsFullEncode ? [
        '-preset', 'ultrafast', '-tune', 'zerolatency', '-threads', '1',
        '-profile:v', 'baseline', '-level', '3.1',
        '-x264-params', 'ref=1:bframes=0:cabac=0:trellis=0:8x8dct=0:me=dia:subme=0:weightp=0',
      ] : []),
      ...vfArgs,
      ...videoBitrateArgs,
      '-c:a', needsAudioTranscode ? 'aac' : 'copy',
      ...(needsAudioTranscode ? ['-b:a', '128k', '-ar', '44100'] : []),
      '-movflags', '+faststart',
      '-video_track_timescale', '90000',
      '-metadata', 'comment=yt_ready_v2',
      '-y', tmpPath
    ];
    const proc = spawn('ffmpeg', args, { shell: true, windowsHide: true });
    
    proc.stderr.on('data', d => {
        const text = d.toString();
        if (onLog && (text.includes('frame=') || text.includes('time='))) {
            const lines = text.split('\n').filter(l => l.trim() && (l.includes('frame=') || l.includes('time=')));
            lines.forEach(l => onLog(l));
        }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        fs.renameSync(tmpPath, inputPath);
        resolve({ path: inputPath, needsFilter: false });
      } else {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        reject(new Error(`Preprocess failed with code ${code}`));
      }
    });
    proc.on('error', reject);
  });
}

async function preprocessAudio(inputPath, onLog) {
  const { audioCodec, audioSampleRate } = await getVideoInfo(inputPath);
  if (audioCodec === 'aac' && audioSampleRate === 44100) return;

  const logMsg = `[Preprocess] Processing audio: ${path.basename(inputPath)}`;
  console.log(logMsg);
  if (onLog) onLog(logMsg);
  
  const tmpPath = inputPath + '.tmp.m4a';
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-i', inputPath, '-vn', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-y', tmpPath], { shell: true, windowsHide: true });
    proc.stderr.on('data', d => {
        const text = d.toString();
        if (onLog && (text.includes('time='))) {
            const lines = text.split('\n').filter(l => l.trim() && l.includes('time='));
            lines.forEach(l => onLog(l));
        }
    });
    proc.on('close', (code) => {
      if (code === 0) {
        fs.renameSync(tmpPath, inputPath);
        resolve();
      } else {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        reject(new Error(`Audio preprocess failed with code ${code}`));
      }
    });
    proc.on('error', reject);
  });
}

async function mergeFiles(filePaths, outputPath, onLog) {
  if (filePaths.length === 1) return filePaths[0];
  const concatListPath = outputPath + '.concat.txt';
  try {
    let content = 'ffconcat version 1.0\n';
    for (const fp of filePaths) {
      content += `file '${fp.replace(/\\/g, '/').replace(/'/g, "'\\''")}'\n`;
    }
    fs.writeFileSync(concatListPath, content);
    
    const logMsg = `[Preprocess] Merging ${filePaths.length} files...`;
    console.log(logMsg);
    if (onLog) onLog(logMsg);
    
    return await new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', ['-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', '-y', outputPath], { shell: true, windowsHide: true });
      proc.stderr.on('data', d => {
          const text = d.toString();
          if (onLog && (text.includes('frame=') || text.includes('time='))) {
              const lines = text.split('\n').filter(l => l.trim() && (l.includes('frame=') || l.includes('time=')));
              lines.forEach(l => onLog(l));
          }
      });
      proc.on('close', (code) => {
        if (code === 0) resolve(outputPath);
        else reject(new Error(`Merge failed with code ${code}`));
      });
      proc.on('error', reject);
    });
  } finally {
    if (fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath);
  }
}

// ── Multipart parser — streams directly to disk for speed ──
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch) return reject(new Error('No boundary'));

    const boundary = boundaryMatch[1];
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const boundaryBuf = Buffer.from(`--${boundary}`);

      let start = buffer.indexOf(boundaryBuf) + boundaryBuf.length + 2;
      const endBoundary = Buffer.from(`--${boundary}--`);
      const endIdx = buffer.indexOf(endBoundary);
      if (endIdx === -1) return reject(new Error('Malformed multipart'));

      const partData = buffer.slice(start, endIdx);
      const headerEnd = partData.indexOf('\r\n\r\n');
      if (headerEnd === -1) return reject(new Error('No headers'));

      const headerStr = partData.slice(0, headerEnd).toString();
      const fileData = partData.slice(headerEnd + 4);
      const cleanData = fileData.slice(0, fileData.length - 2);

      const fnMatch = headerStr.match(/filename="([^"]+)"/);
      const ctMatch = headerStr.match(/Content-Type:\s*(.+)/i);

      resolve({
        filename: fnMatch ? fnMatch[1] : 'upload',
        mimetype: ctMatch ? ctMatch[1].trim() : 'application/octet-stream',
        data: cleanData,
      });
    });
    req.on('error', reject);
  });
}

// ── Stream-to-disk multipart: writes file directly without full RAM buffering ──
function streamMultipartToDisk(req, destPath) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch) return reject(new Error('No boundary'));

    const boundary = `--${boundaryMatch[1]}`;
    const endBoundary = `${boundary}--`;
    let headerParsed = false;
    let filename = 'upload';
    let mimetype = 'application/octet-stream';
    let headerBuf = Buffer.alloc(0);
    let ws = null;
    let totalBytes = 0;
    let trailingBuf = Buffer.alloc(0);

    req.on('data', (chunk) => {
      if (!headerParsed) {
        headerBuf = Buffer.concat([headerBuf, chunk]);
        const headerEndIdx = headerBuf.indexOf('\r\n\r\n');
        if (headerEndIdx === -1) return; // wait for more data

        // Parse headers from the first boundary section
        const headerSection = headerBuf.slice(0, headerEndIdx).toString();
        const fnMatch = headerSection.match(/filename="([^"]+)"/);
        const ctMatch = headerSection.match(/Content-Type:\s*(.+)/i);
        if (fnMatch) filename = fnMatch[1];
        if (ctMatch) mimetype = ctMatch[1].trim();

        headerParsed = true;
        ws = fs.createWriteStream(destPath, { highWaterMark: 1024 * 1024 });
        ws.on('error', reject);

        // Write remaining data after headers
        const remaining = headerBuf.slice(headerEndIdx + 4);
        if (remaining.length > 0) {
          ws.write(remaining);
          totalBytes += remaining.length;
        }
        headerBuf = null; // free
      } else {
        ws.write(chunk);
        totalBytes += chunk.length;
      }
    });

    req.on('end', () => {
      if (!ws) return reject(new Error('No file data received'));
      ws.end(() => {
        // Trim trailing boundary from the written file
        try {
          const fd = fs.openSync(destPath, 'r+');
          const stat = fs.fstatSync(fd);
          // Read last 256 bytes to find boundary
          const tailSize = Math.min(stat.size, 512);
          const tailBuf = Buffer.alloc(tailSize);
          fs.readSync(fd, tailBuf, 0, tailSize, stat.size - tailSize);
          const tailStr = tailBuf.toString('binary');
          
          // Find the end boundary
          const endBoundaryIdx = tailStr.lastIndexOf(endBoundary);
          if (endBoundaryIdx !== -1) {
            // Also trim the \r\n before the boundary
            let trimPoint = stat.size - tailSize + endBoundaryIdx;
            if (trimPoint >= 2) trimPoint -= 2; // remove \r\n before boundary
            fs.ftruncateSync(fd, trimPoint);
          }
          fs.closeSync(fd);
        } catch (e) {
          // If trim fails, file is still usable
          console.warn('[Upload] Boundary trim warning:', e.message);
        }

        resolve({ filename, mimetype, size: fs.statSync(destPath).size, destPath });
      });
    });

    req.on('error', (err) => {
      if (ws) ws.destroy();
      reject(err);
    });
  });
}

// ═══ API Middleware ═══
export const apiMiddleware = async (req, res, next) => {
  const url = req.url;

        // ── Serve uploaded files (with range support for max download speed) ──
        if (url.startsWith('/uploads/')) {
          const relativePath = decodeURIComponent(url.slice('/uploads/'.length)).replace(/\.\./g, '');
          let filePath = path.join(UPLOAD_DIR, relativePath);
          
          // Auto-fallback: if file not found in subdirectories (like images/file.jpg), check root
          if (!fs.existsSync(filePath) && relativePath.includes('/')) {
            const fallbackPath = path.join(UPLOAD_DIR, path.basename(relativePath));
            if (fs.existsSync(fallbackPath) && !fs.statSync(fallbackPath).isDirectory()) {
              filePath = fallbackPath;
            }
          }

          if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeMap = {
              '.mp4': 'video/mp4', '.webm': 'video/webm', '.mkv': 'video/x-matroska',
              '.avi': 'video/x-msvideo', '.mov': 'video/quicktime',
              '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac',
              '.ogg': 'audio/ogg', '.aac': 'audio/aac', '.m4a': 'audio/x-m4a',
              '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
              '.gif': 'image/gif', '.webp': 'image/webp',
            };
            const stat = fs.statSync(filePath);
            const contentType = mimeMap[ext] || 'application/octet-stream';
            const range = req.headers.range;

            if (range) {
              const parts = range.replace(/bytes=/, '').split('-');
              const start = parseInt(parts[0], 10);
              const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
              res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': end - start + 1,
                'Content-Type': contentType,
              });
              fs.createReadStream(filePath, { start, end, highWaterMark: 1024 * 1024 }).pipe(res);
            } else {
              res.writeHead(200, {
                'Content-Type': contentType,
                'Content-Length': stat.size,
                'Accept-Ranges': 'bytes',
              });
              fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 }).pipe(res);
            }
            return;
          }
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        // ══════════════════════════════════════
        // ── AUTH ROUTES ──
        // ══════════════════════════════════════

        // ── Register ──
        if (url === '/api/auth/register' && req.method === 'POST') {
          try {
            const { nickname, email, password } = await readBody(req);
            if (!nickname || !email || !password) return sendJSON(res, 400, { error: 'nickname, email, password wajib diisi' });
            if (password.length < 6) return sendJSON(res, 400, { error: 'Password minimal 6 karakter' });
            const db = getDb();
            const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
            if (existing) return sendJSON(res, 400, { error: 'Email sudah terdaftar' });

            const id = 'user_' + Date.now();
            const salt = crypto.randomBytes(16).toString('hex');
            const hash = crypto.scryptSync(password, salt, 64).toString('hex');
            const colors = [
              'linear-gradient(135deg, #a855f7, #4d8eff)', 'linear-gradient(135deg, #ff3b5c, #ffc144)',
              'linear-gradient(135deg, #2dd4a8, #4d8eff)', 'linear-gradient(135deg, #ffc144, #ff3b5c)',
            ];
            const avatarColor = colors[Math.floor(Math.random() * colors.length)];

            db.prepare('INSERT INTO users (id, nickname, email, password_hash, salt, avatar_color, role) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, nickname, email.toLowerCase(), hash, salt, avatarColor, 'public');

            const token = crypto.randomBytes(32).toString('hex');
            // Simple token = base64(userId:random)
            const tokenPayload = Buffer.from(JSON.stringify({ userId: id, r: token })).toString('base64');

            dbLog('info', 'auth', `User registered: ${nickname} (${email})`);
            return sendJSON(res, 200, { success: true, token: tokenPayload, user: { id, nickname, email: email.toLowerCase(), avatarColor, avatar_url: null, role: 'public', createdAt: new Date().toISOString() } });
          } catch (err) {
            console.error('[Auth Register]', err);
            return sendJSON(res, 500, { error: err.message });
          }
        }

        // ── Login ──
        if (url === '/api/auth/login' && req.method === 'POST') {
          try {
            const { email, password } = await readBody(req);
            if (!email || !password) return sendJSON(res, 400, { error: 'Email dan password wajib diisi' });
            const db = getDb();
            const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
            if (!user) return sendJSON(res, 400, { error: 'Email atau password salah' });

            const hash = crypto.scryptSync(password, user.salt, 64).toString('hex');
            if (hash !== user.password_hash) return sendJSON(res, 400, { error: 'Email atau password salah' });

            const token = crypto.randomBytes(32).toString('hex');
            const tokenPayload = Buffer.from(JSON.stringify({ userId: user.id, r: token })).toString('base64');

            dbLog('info', 'auth', `User logged in: ${user.nickname}`);
            return sendJSON(res, 200, { success: true, token: tokenPayload, user: { id: user.id, nickname: user.nickname, email: user.email, avatarColor: user.avatar_color, avatar_url: user.avatar_url, role: user.role, createdAt: user.created_at } });
          } catch (err) {
            console.error('[Auth Login]', err);
            return sendJSON(res, 500, { error: err.message });
          }
        }

        // ── Get current user ──
        if (url === '/api/auth/me' && req.method === 'GET') {
          try {
            const auth = req.headers.authorization;
            if (!auth || !auth.startsWith('Bearer ')) return sendJSON(res, 401, { error: 'Not authenticated' });
            const tokenPayload = auth.slice(7);
            let userId;
            try { userId = JSON.parse(Buffer.from(tokenPayload, 'base64').toString()).userId; } catch { return sendJSON(res, 401, { error: 'Invalid token' }); }
            const db = getDb();
            const user = db.prepare('SELECT id, nickname, email, avatar_color, avatar_url, role, created_at FROM users WHERE id = ?').get(userId);
            if (!user) return sendJSON(res, 401, { error: 'User not found' });
            return sendJSON(res, 200, { user: { id: user.id, nickname: user.nickname, email: user.email, avatarColor: user.avatar_color, avatar_url: user.avatar_url, role: user.role, createdAt: user.created_at } });
          } catch (err) {
            return sendJSON(res, 500, { error: err.message });
          }
        }

        // ── Update profile ──
        if (url === '/api/auth/profile' && req.method === 'PUT') {
          try {
            const auth = req.headers.authorization;
            if (!auth || !auth.startsWith('Bearer ')) return sendJSON(res, 401, { error: 'Not authenticated' });
            let userId;
            try { userId = JSON.parse(Buffer.from(auth.slice(7), 'base64').toString()).userId; } catch { return sendJSON(res, 401, { error: 'Invalid token' }); }
            const { nickname, email, avatarColor, avatar_url } = await readBody(req);
            const db = getDb();
            if (nickname) db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(nickname, userId);
            if (email) {
              const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
              if (existing) return sendJSON(res, 400, { error: 'Email sudah digunakan' });
              db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, userId);
            }
            if (avatarColor) db.prepare('UPDATE users SET avatar_color = ? WHERE id = ?').run(avatarColor, userId);
            if (avatar_url !== undefined) db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatar_url, userId);
            
            const user = db.prepare('SELECT id, nickname, email, avatar_color, avatar_url, created_at FROM users WHERE id = ?').get(userId);
            return sendJSON(res, 200, { success: true, user: { id: user.id, nickname: user.nickname, email: user.email, avatarColor: user.avatar_color, avatar_url: user.avatar_url, createdAt: user.created_at } });
          } catch (err) {
            return sendJSON(res, 500, { error: err.message });
          }
        }

        // ── Change password ──
        if (url === '/api/auth/password' && req.method === 'PUT') {
          try {
            const auth = req.headers.authorization;
            if (!auth || !auth.startsWith('Bearer ')) return sendJSON(res, 401, { error: 'Not authenticated' });
            let userId;
            try { userId = JSON.parse(Buffer.from(auth.slice(7), 'base64').toString()).userId; } catch { return sendJSON(res, 401, { error: 'Invalid token' }); }
            const { currentPassword, newPassword } = await readBody(req);
            if (!currentPassword || !newPassword) return sendJSON(res, 400, { error: 'currentPassword dan newPassword wajib' });
            if (newPassword.length < 6) return sendJSON(res, 400, { error: 'Password baru minimal 6 karakter' });
            const db = getDb();
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
            if (!user) return sendJSON(res, 404, { error: 'User not found' });
            const hash = crypto.scryptSync(currentPassword, user.salt, 64).toString('hex');
            if (hash !== user.password_hash) return sendJSON(res, 400, { error: 'Password lama salah' });
            const newSalt = crypto.randomBytes(16).toString('hex');
            const newHash = crypto.scryptSync(newPassword, newSalt, 64).toString('hex');
            db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(newHash, newSalt, userId);
            return sendJSON(res, 200, { success: true });
          } catch (err) {
            return sendJSON(res, 500, { error: err.message });
          }
        }

        // ══════════════════════════════════════
        // ── REST API FOR ENTITIES ──
        // ══════════════════════════════════════
        const entityMatch = url.match(/^\/api\/data\/([a-z_]+)(?:\/(.+))?$/);
        if (entityMatch) {
          const entity = entityMatch[1];
          const entityId = entityMatch[2];
          const validEntities = ['streams', 'playlists', 'overlays', 'media_files', 'youtube_channels'];
          
          if (!validEntities.includes(entity)) return sendJSON(res, 400, { error: 'Invalid entity' });

          try {
            const auth = req.headers.authorization;
            if (!auth || !auth.startsWith('Bearer ')) return sendJSON(res, 401, { error: 'Not authenticated' });
            let userId;
            try { userId = JSON.parse(Buffer.from(auth.slice(7), 'base64').toString()).userId; } catch { return sendJSON(res, 401, { error: 'Invalid token' }); }
            
            const db = getDb();
            
            if (req.method === 'GET') {
              if (entity === 'media_files') {
                try {
                  const scanDir = (dir, prefix = '') => {
                    let results = [];
                    const list = fs.readdirSync(dir);
                    list.forEach(file => {
                      const fullPath = path.join(dir, file);
                      const stat = fs.statSync(fullPath);
                      if (stat.isDirectory()) {
                        // Skip .thumbnails and merged directories for auto-sync
                        if (file !== '.thumbnails' && file !== 'merged') {
                          results = results.concat(scanDir(fullPath, path.join(prefix, file)));
                        }
                      } else {
                        results.push(path.join(prefix, file));
                      }
                    });
                    return results;
                  };
                  
                  const files = scanDir(UPLOAD_DIR);
                  const userPrefix = `${userId}_`;
                  const userFiles = files.filter(f => path.basename(f).startsWith(userPrefix));
                  
                  // 1. Remove ghost records from DB (files that no longer exist on disk)
                  const existingRecords = db.prepare('SELECT id, data FROM media_files WHERE user_id = ?').all(userId);
                  existingRecords.forEach(row => {
                    try {
                      const data = JSON.parse(row.data);
                      let fileExists = false;
                      if (data.serverPath && fs.existsSync(data.serverPath)) {
                        fileExists = true;
                      } else if (data.serverFilename) {
                        const checkPath = path.join(UPLOAD_DIR, data.serverFilename);
                        if (fs.existsSync(checkPath)) fileExists = true;
                      }
                      
                      if (!fileExists) {
                        db.prepare('DELETE FROM media_files WHERE id = ? AND user_id = ?').run(row.id, userId);
                        console.log(`[Sync] Removed ghost DB record: ${data.name}`);
                      }
                    } catch (err) {}
                  });

                  // 2. Add missing physical files to DB
                  userFiles.forEach(f => {
                    // f is the relative path like 'images/123_abc.jpg'
                    const exists = db.prepare('SELECT id FROM media_files WHERE user_id = ? AND data LIKE ?').get(userId, `%"serverFilename":"${f}"%`);
                    if (!exists) {
                      const fullPath = path.join(UPLOAD_DIR, f);
                      try {
                        const stat = fs.statSync(fullPath);
                        let type = 'video';
                        const ext = path.extname(f).toLowerCase();
                        if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) type = 'image';
                        else if (['.mp3', '.wav', '.m4a', '.aac'].includes(ext)) type = 'audio';

                        const basename = path.basename(f);
                        const parts = basename.split('_');
                        const origName = parts.length >= 3 ? parts.slice(2).join('_') : basename;
                        
                        const newMedia = {
                          id: `media_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                          name: origName,
                          type,
                          duration: '0:00',
                          size: stat.size,
                          serverPath: fullPath,
                          serverFilename: f,
                          url: `/uploads/${f.replace(/\\/g, '/')}`,
                          category: 'Uncategorized',
                          createdAt: stat.birthtime.toISOString()
                        };
                        
                        db.prepare(`INSERT INTO media_files (id, user_id, data) VALUES (?, ?, ?)`).run(newMedia.id, userId, JSON.stringify(newMedia));
                        console.log(`[Sync] Added missing physical file to DB: ${f}`);
                      } catch (err) {
                        console.error('[Sync] Error recovering file:', err);
                      }
                    }
                  });
                } catch (e) {
                  console.error('[Sync] Failed to read UPLOAD_DIR:', e);
                }
              }

              const rows = db.prepare(`SELECT id, data FROM ${entity} WHERE user_id = ?`).all(userId);
              const data = rows.map(r => JSON.parse(r.data));
              return sendJSON(res, 200, { success: true, data });
            } 
            else if (req.method === 'POST') {
              const item = await readBody(req);
              if (!item.id) return sendJSON(res, 400, { error: 'Item must have an id' });
              
              db.prepare(`INSERT INTO ${entity} (id, user_id, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`).run(item.id, userId, JSON.stringify(item));
              return sendJSON(res, 200, { success: true });
            }
            else if (req.method === 'DELETE' && entityId) {
              db.prepare(`DELETE FROM ${entity} WHERE id = ? AND user_id = ?`).run(entityId, userId);
              return sendJSON(res, 200, { success: true });
            }
          } catch (err) {
            return sendJSON(res, 500, { error: err.message });
          }
          return;
        }

        // ══════════════════════════════════════
        // ── REST API FOR SETTINGS ──
        // ══════════════════════════════════════
        const settingsMatch = url.match(/^\/api\/settings\/([a-zA-Z0-9_]+)$/);
        if (settingsMatch) {
          const key = settingsMatch[1];
          try {
            const auth = req.headers.authorization;
            if (!auth || !auth.startsWith('Bearer ')) return sendJSON(res, 401, { error: 'Not authenticated' });
            let userId;
            try { userId = JSON.parse(Buffer.from(auth.slice(7), 'base64').toString()).userId; } catch { return sendJSON(res, 401, { error: 'Invalid token' }); }
            
            const db = getDb();
            
            if (req.method === 'GET') {
              const row = db.prepare('SELECT value FROM user_settings WHERE user_id = ? AND key = ?').get(userId, key);
              return sendJSON(res, 200, { success: true, data: row ? JSON.parse(row.value) : null });
            }
            else if (req.method === 'POST') {
              const body = await readBody(req);
              // If frontend sends { value: ... } use it, otherwise use the whole body
              const valToSave = (body && typeof body === 'object' && 'value' in body) ? body.value : body;
              db.prepare('INSERT INTO user_settings (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value').run(userId, key, JSON.stringify(valToSave));
              return sendJSON(res, 200, { success: true });
            }
          } catch (err) {
            return sendJSON(res, 500, { error: err.message });
          }
          return;
        }

        // ══════════════════════════════════════
        // ── STORAGE INFO ──
        // ══════════════════════════════════════
        if (url === '/api/storage/info' && req.method === 'GET') {
          try {
            const driveLetter = path.parse(UPLOAD_DIR).root || 'C:\\';
            let total = 0, free = 0;
            if (os.platform() === 'win32') {
              const out = execSync(`wmic logicaldisk where "DeviceID='${driveLetter.replace(/\\$/, '')}'" get Size,FreeSpace /format:csv`, { timeout: 5000 }).toString();
              const lines = out.trim().split('\n').filter(l => l.trim() && !l.startsWith('Node'));
              if (lines.length > 0) {
                const parts = lines[lines.length - 1].split(',');
                free = parseInt(parts[1]) || 0;
                total = parseInt(parts[2]) || 0;
              }
            } else {
              const out = execSync(`df -B1 "${UPLOAD_DIR}" | tail -1`, { timeout: 5000 }).toString();
              const parts = out.trim().split(/\s+/);
              total = parseInt(parts[1]) || 0;
              free = parseInt(parts[3]) || 0;
            }
            const used = total - free;
            // Also get uploads folder size
            let uploadsSize = 0;
            try {
              const files = fs.readdirSync(UPLOAD_DIR);
              files.forEach(f => { try { uploadsSize += fs.statSync(path.join(UPLOAD_DIR, f)).size; } catch {} });
            } catch {}
            return sendJSON(res, 200, {
              total, free, used, uploadsSize,
              totalGB: (total / 1073741824).toFixed(1),
              freeGB: (free / 1073741824).toFixed(1),
              usedGB: (used / 1073741824).toFixed(1),
              uploadsSizeGB: (uploadsSize / 1073741824).toFixed(2),
            });
          } catch (err) {
            return sendJSON(res, 200, { total: 0, free: 0, used: 0, uploadsSize: 0, totalGB: '0', freeGB: '0', usedGB: '0', uploadsSizeGB: '0', error: err.message });
          }
        }

        // ══════════════════════════════════════
        // ── ANALYTICS ──
        // ══════════════════════════════════════
        if (url === '/api/analytics/streams' && req.method === 'GET') {
          try {
            const auth = req.headers.authorization;
            let userId = null;
            if (auth && auth.startsWith('Bearer ')) {
              try { userId = JSON.parse(Buffer.from(auth.slice(7), 'base64').toString()).userId; } catch {}
            }
            if (!userId) return sendJSON(res, 401, { error: 'Not authenticated' });

            const db = getDb();
            const sessions = db.prepare('SELECT * FROM stream_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT 100').all(userId);
            const totalSessions = db.prepare('SELECT COUNT(*) as cnt FROM stream_sessions WHERE user_id = ?').get(userId).cnt;
            const liveSessions = db.prepare("SELECT COUNT(*) as cnt FROM stream_sessions WHERE user_id = ? AND status = 'started'").get(userId).cnt;
            const errorSessions = db.prepare("SELECT COUNT(*) as cnt FROM stream_sessions WHERE user_id = ? AND status = 'error'").get(userId).cnt;
            const totalFrames = db.prepare('SELECT COALESCE(SUM(total_frames), 0) as tf FROM stream_sessions WHERE user_id = ?').get(userId).tf;
            return sendJSON(res, 200, { sessions, stats: { totalSessions, liveSessions, errorSessions, totalFrames } });
          } catch (err) {
            return sendJSON(res, 200, { sessions: [], stats: { totalSessions: 0, liveSessions: 0, errorSessions: 0, totalFrames: 0 } });
          }
        }

        if (url.startsWith('/api/analytics/live/') && req.method === 'GET') {
          const streamId = getPathParam(url, '/api/analytics/live/');
          const stream = activeStreams.get(streamId);
          if (!stream) return sendJSON(res, 200, { active: false });
          let progress = {};
          const lastLog = [...stream.logs].reverse().find(l => l.includes('frame=') && l.includes('bitrate='));
          if (lastLog) {
            const fm = lastLog.match(/frame=\s*(\d+)/), fpm = lastLog.match(/fps=\s*([\d.]+)/);
            const sm = lastLog.match(/size=\s*(\S+)/), tm = lastLog.match(/time=\s*([\d:.]+)/);
            const bm = lastLog.match(/bitrate=\s*([\d.]+\S+)/);
            progress = { frame: fm ? +fm[1] : 0, fps: fpm ? +fpm[1] : 0, size: sm ? sm[1] : '0kB', time: tm ? tm[1] : '00:00:00', bitrate: bm ? bm[1] : '0kbits/s' };
          }
          if (!progress.frame) {
            const recent = stream.logs.slice(-50);
            const kv = {};
            recent.forEach(l => { const m = l.match(/^(\w+)=(.+)$/); if (m) kv[m[1]] = m[2]; });
            if (kv.frame || kv.fps) progress = { frame: +kv.frame || 0, fps: +kv.fps || 0, size: kv.total_size ? (+kv.total_size / 1024).toFixed(0) + 'kB' : '0kB', time: kv.out_time ? kv.out_time.split('.')[0] : '00:00:00', bitrate: kv.bitrate || '0kbits/s' };
          }
          return sendJSON(res, 200, { active: stream.status === 'live' || stream.status === 'starting', status: stream.status, startedAt: stream.startedAt, progress, error: stream.error });
        }

        // ══════════════════════════════════════
        // ── APP LOGS (synced) ──
        // ══════════════════════════════════════
        if (url === '/api/logs' && req.method === 'POST') {
          try {
            const body = await readBody(req);
            const entries = Array.isArray(body) ? body : (body.entries || [body]);
            const db = getDb();
            const insert = db.prepare('INSERT INTO app_logs (timestamp, level, category, message, data_json, source) VALUES (?, ?, ?, ?, ?, ?)');
            const insertMany = db.transaction((items) => {
              for (const e of items) insert.run(e.timestamp || new Date().toISOString(), e.level || 'info', e.category || 'system', e.message || '', e.data ? JSON.stringify(e.data) : null, 'frontend');
            });
            insertMany(entries);
            return sendJSON(res, 200, { success: true, count: entries.length });
          } catch (err) {
            return sendJSON(res, 500, { error: err.message });
          }
        }

        if (url.startsWith('/api/logs') && req.method === 'GET') {
          try {
            const params = new URL(url, 'http://localhost').searchParams;
            const level = params.get('level');
            const category = params.get('category');
            const limit = parseInt(params.get('limit')) || 500;
            const offset = parseInt(params.get('offset')) || 0;
            let sql = 'SELECT * FROM app_logs WHERE 1=1';
            const args = [];
            if (level && level !== 'all') { sql += ' AND level = ?'; args.push(level); }
            if (category && category !== 'all') { sql += ' AND category = ?'; args.push(category); }
            sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
            args.push(limit, offset);
            const db = getDb();
            const logs = db.prepare(sql).all(...args);
            const total = db.prepare('SELECT COUNT(*) as cnt FROM app_logs').get().cnt;
            return sendJSON(res, 200, { logs: logs.reverse(), total });
          } catch (err) {
            return sendJSON(res, 200, { logs: [], total: 0 });
          }
        }

        if (url === '/api/logs' && req.method === 'DELETE') {
          try {
            getDb().prepare('DELETE FROM app_logs').run();
            return sendJSON(res, 200, { success: true });
          } catch (err) {
            return sendJSON(res, 500, { error: err.message });
          }
        }

        // ── Health check ──
        if (url === '/api/health' && req.method === 'GET') {
          return sendJSON(res, 200, { status: 'ok', activeStreams: activeStreams.size, mode: 'integrated', db: true });
        }

        // ── FFmpeg check ──
        if (url === '/api/ffmpeg/check' && req.method === 'GET') {
          const proc = spawn('ffmpeg', ['-version'], { shell: true, windowsHide: true });
          let output = '';
          proc.stdout.on('data', d => { output += d.toString(); });
          proc.stderr.on('data', d => { output += d.toString(); });
          proc.on('close', code => {
            if (code === 0) {
              const vm = output.match(/ffmpeg version (\S+)/);
              sendJSON(res, 200, { available: true, version: vm?.[1] || 'unknown' });
            } else {
              sendJSON(res, 200, { available: false, error: 'FFmpeg not found' });
            }
          });
          proc.on('error', () => {
            sendJSON(res, 200, { available: false, error: 'FFmpeg not found. Install FFmpeg and add to PATH.' });
          });
          return;
        }

        // ── System Stats ──
        if (url === '/api/system/stats' && req.method === 'GET') {
          const totalMem = os.totalmem();
          const freeMem = os.freemem();
          const usedMem = totalMem - freeMem;
          const ramUsagePercent = ((usedMem / totalMem) * 100).toFixed(1);

          // Real-time CPU measurement: compare two snapshots 200ms apart
          const getCpuSnapshot = () => {
            const cpus = os.cpus();
            let idle = 0, total = 0;
            cpus.forEach(cpu => {
              for (let type in cpu.times) total += cpu.times[type];
              idle += cpu.times.idle;
            });
            return { idle, total };
          };
          const snap1 = getCpuSnapshot();
          await new Promise(r => setTimeout(r, 200));
          const snap2 = getCpuSnapshot();
          const idleDelta = snap2.idle - snap1.idle;
          const totalDelta = snap2.total - snap1.total;
          const cpuUsagePercent = totalDelta > 0 ? (100 - (100 * idleDelta / totalDelta)).toFixed(1) : '0.0';

          let networkDownStr = '0.00', networkUpStr = '0.00';
          try {
            const out = execSync(os.platform() === 'win32' ? 'netstat -e' : 'cat /proc/net/dev', { timeout: 1000 }).toString();
            let rx = 0, tx = 0;
            if (os.platform() === 'win32') {
              const lines = out.split('\n');
              const bytesLine = lines.find(l => l.trim().toLowerCase().startsWith('bytes'));
              if (bytesLine) {
                const parts = bytesLine.trim().split(/\s+/);
                if (parts.length >= 3) { rx = parseInt(parts[1], 10); tx = parseInt(parts[2], 10); }
              }
            } else {
              const lines = out.split('\n');
              lines.forEach(l => {
                if (l.includes(':')) {
                  const parts = l.split(':')[1].trim().split(/\s+/);
                  rx += parseInt(parts[0], 10) || 0; tx += parseInt(parts[8], 10) || 0;
                }
              });
            }
            
            const now = Date.now();
            const dt = (now - lastNetStats.time) / 1000;
            if (dt > 0 && lastNetStats.rx > 0 && rx > 0) {
               const rxSpeed = Math.max(0, rx - lastNetStats.rx) / dt;
               const txSpeed = Math.max(0, tx - lastNetStats.tx) / dt;
               networkDownStr = (rxSpeed * 8 / 1000000).toFixed(2);
               networkUpStr = (txSpeed * 8 / 1000000).toFixed(2);
            }
            if (rx > 0 && tx > 0) lastNetStats = { rx, tx, time: now };
          } catch(err) { }

          return sendJSON(res, 200, {
            ramTotal: (totalMem / 1024 / 1024 / 1024).toFixed(1),
            ramUsed: (usedMem / 1024 / 1024 / 1024).toFixed(1),
            ramPercent: ramUsagePercent,
            cpuPercent: cpuUsagePercent,
            cpuCount: os.cpus().length,
            networkDown: networkDownStr,
            networkUp: networkUpStr
          });
        }

        // ── Speedtest: Real Download (server → client) ──
        if (url.startsWith('/api/speedtest/download') && req.method === 'GET') {
          const sizeParam = new URL(url, 'http://localhost').searchParams.get('size');
          const sizeMB = Math.min(Math.max(parseInt(sizeParam) || 10, 1), 100); // 1-100 MB
          const totalBytes = sizeMB * 1024 * 1024;
          const chunkSize = 256 * 1024; // 256KB chunks for max throughput
          
          res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Content-Length': totalBytes,
            'Cache-Control': 'no-store',
            'X-Start-Time': Date.now().toString(),
          });
          
          // Stream random-ish data in chunks (much faster than crypto.randomBytes per chunk)
          const chunk = Buffer.alloc(chunkSize, 0x42); // Fill with 'B' — fast, no crypto overhead
          let sent = 0;
          const write = () => {
            let ok = true;
            while (sent < totalBytes && ok) {
              const remaining = totalBytes - sent;
              const toSend = remaining < chunkSize ? chunk.slice(0, remaining) : chunk;
              ok = res.write(toSend);
              sent += toSend.length;
            }
            if (sent >= totalBytes) {
              res.end();
            } else {
              res.once('drain', write);
            }
          };
          write();
          return;
        }

        // ── Speedtest: Real Upload (client → server) ──
        if (url === '/api/speedtest/upload' && req.method === 'POST') {
          const startTime = Date.now();
          let totalBytes = 0;
          
          req.on('data', (chunk) => {
            totalBytes += chunk.length;
            // Discard data — we only measure throughput
          });
          
          req.on('end', () => {
            const elapsed = (Date.now() - startTime) / 1000;
            const mbps = elapsed > 0 ? (totalBytes * 8 / 1000000) / elapsed : 0;
            return sendJSON(res, 200, {
              success: true,
              bytes: totalBytes,
              elapsed: elapsed.toFixed(3),
              mbps: mbps.toFixed(2),
            });
          });
          
          req.on('error', (err) => {
            return sendJSON(res, 500, { error: err.message });
          });
          return;
        }

        // ── Speedtest: Ping (RTT measurement) ──
        if (url === '/api/speedtest/ping' && req.method === 'GET') {
          return sendJSON(res, 200, { pong: Date.now() });
        }

        // ── Upload file (streaming to disk for max speed) ──
        if (url === '/api/upload' && req.method === 'POST') {
          try {
            const auth = req.headers.authorization;
            if (!auth || !auth.startsWith('Bearer ')) return sendJSON(res, 401, { error: 'Not authenticated' });
            let userId;
            try { userId = JSON.parse(Buffer.from(auth.slice(7), 'base64').toString()).userId; } catch { return sendJSON(res, 401, { error: 'Invalid token' }); }

            // First, stream to a temp file on disk (avoids RAM bottleneck)
            const tmpName = `tmp_${userId}_${Date.now()}`;
            const tmpPath = path.join(UPLOAD_DIR, tmpName);
            const result = await streamMultipartToDisk(req, tmpPath);

            const { filename: origName, mimetype } = result;
            const allowed = /video\/|audio\/|image\//;
            if (!allowed.test(mimetype)) {
              try { fs.unlinkSync(tmpPath); } catch {}
              return sendJSON(res, 400, { error: 'Only video, audio, and image files are allowed' });
            }

            let category = 'others';
            if (mimetype.startsWith('image/')) category = 'images';
            else if (mimetype.startsWith('video/')) category = 'videos';
            else if (mimetype.startsWith('audio/')) category = 'audio';

            const categoryDir = path.join(UPLOAD_DIR, category);
            if (!fs.existsSync(categoryDir)) fs.mkdirSync(categoryDir, { recursive: true });

            const safeName = origName.replace(/[^a-zA-Z0-9._-]/g, '_');
            const finalName = `${userId}_${Date.now()}_${safeName}`;
            const filePath = path.join(categoryDir, finalName);
            const relativePath = `${category}/${finalName}`;
            
            // Rename temp file to final destination (instant, no copy needed)
            fs.renameSync(tmpPath, filePath);
            const fileSize = fs.statSync(filePath).size;

            return sendJSON(res, 200, {
              success: true,
              file: {
                filename: relativePath,
                originalname: origName,
                size: fileSize,
                mimetype,
                path: filePath,
                url: `/uploads/${relativePath}`,
              },
            });
          } catch (err) {
            return sendJSON(res, 500, { error: `Upload failed: ${err.message}` });
          }
        }

        // ── List files ──
        if (url === '/api/files' && req.method === 'GET') {
          try {
            const files = [];
            const categories = ['images', 'videos', 'audio', 'others'];
            for (const cat of categories) {
              const catDir = path.join(UPLOAD_DIR, cat);
              if (!fs.existsSync(catDir)) continue;
              const catFiles = fs.readdirSync(catDir);
              for (const name of catFiles) {
                const fullPath = path.join(catDir, name);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) continue;
                const relativePath = `${cat}/${name}`;
                files.push({ filename: relativePath, size: stat.size, createdAt: stat.birthtime, url: `/uploads/${relativePath}`, path: fullPath });
              }
            }
            return sendJSON(res, 200, { files });
          } catch {
            return sendJSON(res, 200, { files: [] });
          }
        }

        // ── Video Thumbnail ──
        if (url.startsWith('/api/video/thumbnail/') && req.method === 'GET') {
          const relativePath = decodeURIComponent(getPathParam(url, '/api/video/thumbnail/')).replace(/\.\./g, '');
          const filePath = path.join(UPLOAD_DIR, relativePath);
          const ext = path.extname(filePath).toLowerCase();
          
          if (!fs.existsSync(filePath)) {
            res.writeHead(404);
            return res.end('File not found');
          }

          // If it's an image, just serve it
          if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
            const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' }[ext];
            res.writeHead(200, { 'Content-Type': mime });
            return fs.createReadStream(filePath).pipe(res);
          }

          // If audio, serve a placeholder or 404 (handled by frontend onError)
          if (['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg'].includes(ext)) {
             res.writeHead(404);
             return res.end('Audio has no thumbnail');
          }

          const filename = path.basename(filePath);
          const thumbDir = path.join(UPLOAD_DIR, '.thumbnails');
          if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });
          
          const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
          const thumbPath = path.join(thumbDir, safeName + '.jpg');
          
          if (fs.existsSync(thumbPath)) {
            res.writeHead(200, { 'Content-Type': 'image/jpeg' });
            return fs.createReadStream(thumbPath).pipe(res);
          }
          
          // Generate using ffmpeg
          try {
            await new Promise((resolve, reject) => {
              const proc = spawn('ffmpeg', ['-i', filePath, '-ss', '00:00:01.000', '-vframes', '1', '-vf', 'scale=320:-1', '-y', thumbPath], { shell: true, windowsHide: true });
              proc.on('close', code => {
                if (code === 0) resolve();
                else reject(new Error('ffmpeg failed'));
              });
            });
            if (fs.existsSync(thumbPath)) {
              res.writeHead(200, { 'Content-Type': 'image/jpeg' });
              return fs.createReadStream(thumbPath).pipe(res);
            }
          } catch(err) {
             res.writeHead(500);
             return res.end('Thumbnail generation failed');
          }
        }

        // ── Delete file ──
        if (url.startsWith('/api/files/') && req.method === 'DELETE') {
          const relativePath = decodeURIComponent(getPathParam(url, '/api/files/')).replace(/\.\./g, '');
          const filePath = path.join(UPLOAD_DIR, relativePath);
          if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
            fs.unlinkSync(filePath);
            return sendJSON(res, 200, { success: true });
          }
          return sendJSON(res, 404, { error: 'File not found' });
        }

        // ── Start stream ──
        if (url === '/api/stream/start' && req.method === 'POST') {
          try {
          const body = await readBody(req);
          const {
            streamId, filePath: bodyFilePath, filename, playlistData,
            rtmpUrl, streamKey,
            bitrate = '2500', fps = '30', resolution = '1280x720',
            loopVideo = false, sceneData = null, adaptiveEnabled = false,
            delay = 'none'
          } = body;

          if (!streamId || !rtmpUrl || !streamKey) {
            return sendJSON(res, 400, { error: 'streamId, rtmpUrl, dan streamKey wajib diisi' });
          }

          let validVItems = [];
          let validAItems = [];
          let actualFilePath = null;

          if (playlistData) {
            const vItems = playlistData.items ? playlistData.items.filter(i => i.type === 'video') : [];
            const aItems = playlistData.items ? playlistData.items.filter(i => i.type === 'music') : [];
            
            const resolveItemPath = (item) => {
              if (item.serverPath && fs.existsSync(item.serverPath)) return item.serverPath;
              if (item.serverFilename) {
                 const check = path.join(UPLOAD_DIR, item.serverFilename);
                 if (fs.existsSync(check)) return check;
              }
              if (item.name) {
                const check = path.join(UPLOAD_DIR, item.name);
                if (fs.existsSync(check)) return check;
              }
              return null;
            };
            validVItems = vItems.map(resolveItemPath).filter(Boolean);
            validAItems = aItems.map(resolveItemPath).filter(Boolean);
            if (!validVItems.length && !validAItems.length) {
               return sendJSON(res, 400, { error: 'Playlist kosong atau file tidak ditemukan di server. Pastikan file sudah di-upload melalui Media Library.' });
            }
          } else {
            if (bodyFilePath && fs.existsSync(bodyFilePath)) {
              actualFilePath = bodyFilePath;
            } else if (filename) {
              const candidate = path.join(UPLOAD_DIR, filename);
              if (fs.existsSync(candidate)) actualFilePath = candidate;
            }
            if (!actualFilePath) {
              return sendJSON(res, 400, { error: 'Media file tidak ditemukan. Upload file terlebih dahulu.' });
            }
            const ext = path.extname(actualFilePath).toLowerCase();
            const isAudioOnly = ['.mp3', '.wav', '.flac', '.ogg', '.aac', '.m4a'].includes(ext);
            if (isAudioOnly) {
              validAItems.push(actualFilePath);
            } else {
              validVItems.push(actualFilePath);
            }
          }

          // Return 200 IMMEDIATELY to prevent frontend timeout (Failed to fetch)
          sendJSON(res, 200, {
            success: true, streamId,
            message: 'Stream sedang dipersiapkan dan akan segera Live...',
            rtmpUrl: `${rtmpUrl.replace(/\/$/, '')}/${streamKey}`,
            file: actualFilePath || 'playlist',
          });

          // Background processing thread (Async IFFE)
          (async () => {
            try {
              // Update status
              activeStreams.set(streamId, {
                process: null, startedAt: new Date().toISOString(),
                status: 'starting', logs: ['System: Pre-processing media files in background...'], error: null,
                filePath: actualFilePath || 'playlist'
              });

              const pushLog = (msg) => {
                  const s = activeStreams.get(streamId);
                  if (s) {
                      s.logs.push(msg);
                      if (s.logs.length > 300) s.logs.shift();
                  }
              };
              
              // Pre-process all video files
          for (let i = 0; i < validVItems.length; i++) {
              try {
                  pushLog(`System: Pre-processing video ${i+1}/${validVItems.length}...`);
                  const result = await preprocessVideo(validVItems[i], { resolution, bitrate, fps }, pushLog);
                  validVItems[i] = result.path;
              } catch (e) {
                  console.warn(`[Stream ${streamId}] Video preprocess skipped [${i}]: ${e.message}`);
              }
          }

          // Pre-process all audio files
          for (let i = 0; i < validAItems.length; i++) {
              try {
                  pushLog(`System: Pre-processing audio ${i+1}/${validAItems.length}...`);
                  await preprocessAudio(validAItems[i], pushLog);
              } catch (e) {
                  console.warn(`[Stream ${streamId}] Audio preprocess skipped [${i}]: ${e.message}`);
              }
          }

          const MERGED_DIR = path.join(UPLOAD_DIR, 'merged');
          if (!fs.existsSync(MERGED_DIR)) fs.mkdirSync(MERGED_DIR, { recursive: true });

          if (validVItems.length > 1) pushLog(`System: Merging ${validVItems.length} videos...`);
          const mergedVideo = validVItems.length > 0
              ? await mergeFiles(validVItems, path.join(MERGED_DIR, `${streamId}_video.mp4`), pushLog)
              : null;
              
          if (validAItems.length > 1) pushLog(`System: Merging ${validAItems.length} audios...`);
          const mergedAudio = validAItems.length > 0
              ? await mergeFiles(validAItems, path.join(MERGED_DIR, `${streamId}_audio.m4a`), pushLog)
              : null;

          pushLog(`System: Pre-processing complete.`);

          // ── Apply user-configured delay ──
          const delayMs = delay === '30s' ? 30000 : delay === '60s' ? 60000 : delay === '5m' ? 300000 : delay === '10m' ? 600000 : 0;
          if (delayMs > 0) {
            const delaySec = delayMs / 1000;
            pushLog(`System: Added delay ${delay} — stream will start in ${delaySec}s...`);
            console.log(`[Stream ${streamId}] Delay: ${delay} (${delaySec}s)`);
            const s = activeStreams.get(streamId);
            if (s) s.status = 'waiting_delay';
            // Countdown log every 10 seconds (or every second if < 30s)
            const interval = delaySec <= 30 ? 5 : 10;
            for (let remaining = delaySec; remaining > 0; remaining -= interval) {
              pushLog(`System: Starting in ${remaining}s...`);
              await new Promise(r => setTimeout(r, Math.min(interval, remaining) * 1000));
            }
            pushLog(`System: Delay complete. Launching stream now...`);
          } else {
            pushLog(`System: Starting stream...`);
          }

          // Kill existing
          if (activeStreams.has(streamId)) {
            const existing = activeStreams.get(streamId);
            try { if (existing.process && !existing.process.killed) existing.process.kill('SIGTERM'); } catch {}
            // Don't delete stream here, we just use existing logs! Next assignment will update the stream process.
          }

          const baseUrl = rtmpUrl.replace(/\/$/, '');
          const fullRtmpUrl = `${baseUrl}/${streamKey}`;
          let streamResStr = resolution || '1280x720';
          if (streamResStr === '1080p') streamResStr = '1920x1080';
          else if (streamResStr === '720p') streamResStr = '1280x720';
          else if (streamResStr === '480p') streamResStr = '854x480';
          const [width, height] = streamResStr.split('x');
          const isRtmps = fullRtmpUrl.startsWith('rtmps://');

          let args = [];

          let vfFilter = null;
          if (sceneData && Array.isArray(sceneData)) {
             const filterParts = [];
             sceneData.forEach(item => {
                 if (!item.visible) return;
                 if (item.type === 'text' && item.label) {
                     const safeText = item.label.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "'\\\\''");
                     const xExpr = `(W*${Math.max(0, parseFloat(item.x) || 0)}/100)`;
                     const yExpr = `(H*${Math.max(0, parseFloat(item.y) || 0)}/100)`;
                     const color = item.fontcolor || 'white';
                     const fontFileStr = process.platform === 'win32' ? "fontfile='C\\:/Windows/Fonts/arial.ttf':" : "";
                     const size = parseFloat(item.fontsize) || 40;
                     filterParts.push(`drawtext=${fontFileStr}text='${safeText}':x=${xExpr}:y=${yExpr}:fontsize=${size}:fontcolor=${color}`);
                 }
             });
             if (filterParts.length > 0) {
                 vfFilter = filterParts.join(',');
             }
          }

          // ── Video args: use COPY mode if preprocessed (no re-encoding = ~5% CPU) ──
          // Only re-encode if overlay filters are active or source needs transcoding
          const needsEncode = !!vfFilter; // Overlays require re-encoding
          
          const ytVideoArgs = needsEncode ? [
              // Full encoding (only when overlays/filters active)
              '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-threads', '1',
              '-profile:v', 'baseline', '-level', '3.1',
              '-r', `${parseInt(fps)}`,
              '-b:v', `${bitrate}k`, '-minrate', `${bitrate}k`, '-maxrate', `${bitrate}k`, '-bufsize', `${parseInt(bitrate) * 2}k`,
              '-nal-hrd', 'cbr',
              '-pix_fmt', 'yuv420p',
              '-g', `${parseInt(fps) * 2}`, '-keyint_min', `${parseInt(fps) * 2}`, '-sc_threshold', '0',
              '-x264-params', 'ref=1:bframes=0:cabac=0:trellis=0:8x8dct=0:me=dia:subme=0:weightp=0',
          ] : [
              // Copy mode — preprocessed file is already YouTube-ready (~5% CPU)
              '-c:v', 'copy',
          ];

          console.log(`[Stream ${streamId}] Video mode: ${needsEncode ? 'ENCODE (overlays active)' : 'COPY (no re-encode, minimal CPU)'}`);

          if (mergedVideo && mergedAudio) {
              args = [
                  '-re',
                  '-stream_loop', '-1', '-i', mergedVideo,
                  '-stream_loop', '-1', '-i', mergedAudio,
                  '-map', '0:v:0', '-map', '1:a:0',
                  ...(vfFilter ? ['-vf', vfFilter] : []),
                  ...ytVideoArgs,
                  '-c:a', 'copy',
                  '-flvflags', 'no_duration_filesize',
                  '-avoid_negative_ts', 'make_zero'
              ];
          } else if (mergedVideo) {
              // Video with embedded audio — use audio from video file
              args = [
                  '-re',
                  '-stream_loop', '-1', '-i', mergedVideo,
                  '-map', '0:v:0', '-map', '0:a:0?',
                  ...(vfFilter ? ['-vf', vfFilter] : []),
                  ...ytVideoArgs,
                  '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
                  '-flvflags', 'no_duration_filesize',
                  '-avoid_negative_ts', 'make_zero'
              ];
          } else if (mergedAudio) {
              args = [
                  '-re',
                  '-stream_loop', '-1', '-i', mergedAudio,
                  '-f', 'lavfi', '-i', `color=c=black:s=${width}x${height}:r=${fps}`,
                  '-map', '1:v:0', '-map', '0:a:0',
                  // Audio-only with generated video always needs encoding
                  '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-threads', '1',
                  '-profile:v', 'baseline', '-level', '3.1',
                  '-pix_fmt', 'yuv420p',
                  '-b:v', `${bitrate}k`, '-bufsize', `${parseInt(bitrate) * 2}k`,
                  '-g', `${parseInt(fps) * 2}`, '-keyint_min', `${parseInt(fps) * 2}`, '-sc_threshold', '0',
                  '-x264-params', 'ref=1:bframes=0:cabac=0:trellis=0:8x8dct=0:me=dia:subme=0:weightp=0',
                  '-c:a', 'copy',
                  '-flvflags', 'no_duration_filesize',
                  '-avoid_negative_ts', 'make_zero'
              ];
          } else {
            return sendJSON(res, 400, { error: 'No media files provided' });
          }

          // Progress reporting to stderr for real-time monitoring
          args.push('-progress', 'pipe:2');

          // RTMPS (TLS) requires special options
          if (isRtmps) {
            args.push('-tls_verify', '0', '-f', 'flv', fullRtmpUrl);
          } else {
            args.push('-f', 'flv', fullRtmpUrl);
          }

          console.log(`[Stream ${streamId}] Starting FFmpeg → ${fullRtmpUrl}`);
          console.log(`  Args (${args.length}): ffmpeg ${args.join(' ')}`);

          // Log to SQLite
          try {
            let userId = null;
            const auth = req.headers.authorization;
            if (auth && auth.startsWith('Bearer ')) {
              try { userId = JSON.parse(Buffer.from(auth.slice(7), 'base64').toString()).userId; } catch {}
            }
            getDb().prepare('INSERT INTO stream_sessions (user_id, stream_id, rtmp_url, title, status) VALUES (?, ?, ?, ?, ?)').run(userId, streamId, fullRtmpUrl, streamId, 'started');
            dbLog('info', 'ffmpeg', `Memulai stream: ${streamId} ke ${isRtmps ? 'RTMPS' : 'RTMP'}`);
          } catch {}

          // Use spawn with shell:false for correct argument passing (no shell interpretation of special chars)
          // Resolve ffmpeg path first
          let ffmpegBin = 'ffmpeg';
          try {
            ffmpegBin = execSync('where ffmpeg', { timeout: 5000 }).toString().trim().split('\n')[0].trim();
            console.log(`  FFmpeg binary: ${ffmpegBin}`);
          } catch { console.log('  Using ffmpeg from PATH'); }
          
          const proc = spawn(ffmpegBin, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });

          const existingStream = activeStreams.get(streamId);
          const initialTier = resolutionToTier(resolution);
          const streamInfo = {
            process: proc,
            startedAt: existingStream ? existingStream.startedAt : new Date().toISOString(),
            status: 'starting',
            logs: existingStream ? existingStream.logs : [],
            error: null,
            filePath: actualFilePath || mergedVideo || mergedAudio || 'playlist',
            rtmpUrl: fullRtmpUrl,
            config: { mergedVideo, mergedAudio, vfFilter, fullRtmpUrl, isRtmps, ffmpegBin },
            adaptive: {
              enabled: true,  // Always auto — no manual mode
              currentTier: initialTier,
              maxTier: getMaxTier(),
              lastSpeed: 0,
              speedSamples: [],
              stableSince: 0,
              lastTierChange: 0,
              changing: false,
              tierHistory: [],
              monitorInterval: null,
            },
          };

          console.log(`  FFmpeg PID: ${proc.pid || 'unknown'}, Adaptive: ALWAYS ON, Tier: ${initialTier}, MaxTier: ${streamInfo.adaptive.maxTier}`);

          // Attach shared FFmpeg output handlers
          attachFFmpegHandlers(proc, streamInfo, streamId);

          proc.on('close', code => {
            // Skip cleanup if adaptive is restarting FFmpeg
            if (streamInfo.adaptive?.changing) return;
            if (streamInfo.process !== proc) return;

            console.log(`[Stream ${streamId}] FFmpeg exited with code ${code}`);
            if (code !== 0 && code !== 255 && !streamInfo.error) {
              streamInfo.error = `FFmpeg exited (code ${code}): ${streamInfo.logs.slice(-5).join(' | ')}`;
            }
            if (code === 255 || streamInfo.status === 'stopping') {
              streamInfo.status = 'ended';
              streamInfo.error = null;
            } else {
              streamInfo.status = code === 0 ? 'ended' : 'error';
            }
            try {
              const finalStatus = streamInfo.status;
              const lastLog = [...streamInfo.logs].reverse().find(l => l.includes('frame='));
              let totalFrames = 0, peakFps = 0;
              if (lastLog) {
                const fm = lastLog.match(/frame=\s*(\d+)/); if (fm) totalFrames = +fm[1];
                const fpm = lastLog.match(/fps=\s*([\d.]+)/); if (fpm) peakFps = +fpm[1];
              }
              getDb().prepare('UPDATE stream_sessions SET ended_at = datetime("now"), status = ?, total_frames = ?, peak_fps = ?, error_msg = ? WHERE stream_id = ? AND ended_at IS NULL').run(finalStatus, totalFrames, peakFps, streamInfo.error || null, streamId);
              dbLog('info', 'stream', `Stream ended: ${streamId} (code ${code})`);
            } catch {}
            try {
              const mergedDir = path.join(UPLOAD_DIR, 'merged');
              const vPath = path.join(mergedDir, `${streamId}_video.mp4`);
              const aPath = path.join(mergedDir, `${streamId}_audio.m4a`);
              if (fs.existsSync(vPath)) fs.unlinkSync(vPath);
              if (fs.existsSync(aPath)) fs.unlinkSync(aPath);
            } catch (err) { console.error('Cleanup error:', err); }
            // Clear adaptive monitor
            if (streamInfo.adaptive?.monitorInterval) clearInterval(streamInfo.adaptive.monitorInterval);
            setTimeout(() => activeStreams.delete(streamId), 60000);
          });

          proc.on('error', err => {
            console.error(`[Stream ${streamId}] Process error:`, err.message);
            streamInfo.status = 'error';
            streamInfo.error = `Cannot start FFmpeg: ${err.message}`;
          });

          activeStreams.set(streamId, streamInfo);

          // Always start adaptive quality monitor
          streamInfo.adaptive.monitorInterval = startAdaptiveMonitor(streamId);
          console.log(`[Stream ${streamId}] Adaptive monitor started (max tier: ${streamInfo.adaptive.maxTier})`);

            } catch (bgError) {
              console.error(`[Background Processing Error] Stream ${streamId} failed:`, bgError);
              const s = activeStreams.get(streamId);
              if (s) { s.status = 'error'; s.error = bgError.message; }
            }
          })();

          // End of API endpoint (Response already sent safely).
          return;
          } catch (err) {
            console.error(`[Stream Start] Unhandled API error:`, err);
            return sendJSON(res, 500, { success: false, error: `Server error: ${err.message}` });
          }
        }

        // ── Stop stream ──
        if (url === '/api/stream/stop' && req.method === 'POST') {
          const { streamId } = await readBody(req);
          if (!streamId) return sendJSON(res, 400, { error: 'streamId is required' });

          const stream = activeStreams.get(streamId);
          if (!stream) return sendJSON(res, 404, { error: 'Stream not found or already stopped' });

          if (stream.process && !stream.process.killed) {
            stream.process.kill('SIGTERM');
            stream.status = 'stopping';
            setTimeout(() => {
              if (stream.process && !stream.process.killed) stream.process.kill('SIGKILL');
            }, 5000);
          }
          return sendJSON(res, 200, { success: true, message: 'Stream stopping...' });
        }

        // ── Stream status ──
        if (url.startsWith('/api/stream/status/') && req.method === 'GET') {
          const streamId = getPathParam(url, '/api/stream/status/');
          const stream = activeStreams.get(streamId);
          if (!stream) return sendJSON(res, 200, { status: 'offline', active: false });

          let progress = {};
          
          // Method 1: Try parsing traditional single-line FFmpeg output (frame= fps= size= time= bitrate=)
          const lastLog = [...stream.logs].reverse().find(l => l.includes('frame=') && l.includes('bitrate='));
          if (lastLog) {
            const frameMatch = lastLog.match(/frame=\s*(\d+)/);
            const fpsMatch = lastLog.match(/fps=\s*([\d.]+)/);
            const sizeMatch = lastLog.match(/size=\s*(\S+)/);
            const timeMatch = lastLog.match(/time=\s*([\d:.]+)/);
            const bitrateMatch = lastLog.match(/bitrate=\s*([\d.]+\S+)/);
            progress = {
              frame: frameMatch ? parseInt(frameMatch[1]) : 0,
              fps: fpsMatch ? parseFloat(fpsMatch[1]) : 0,
              size: sizeMatch ? sizeMatch[1] : '0kB',
              time: timeMatch ? timeMatch[1] : '00:00:00',
              bitrate: bitrateMatch ? bitrateMatch[1] : '0kbits/s',
            };
          }
          
          // Method 2: If method 1 didn't find anything, try -progress pipe:2 format (key=value on separate lines)
          if (!progress.frame) {
            const recentLogs = stream.logs.slice(-50);
            const kvMap = {};
            recentLogs.forEach(l => {
              const kv = l.match(/^(\w+)=(.+)$/);
              if (kv) kvMap[kv[1]] = kv[2];
            });
            if (kvMap.frame || kvMap.fps || kvMap.bitrate || kvMap.out_time) {
              progress = {
                frame: parseInt(kvMap.frame) || 0,
                fps: parseFloat(kvMap.fps) || 0,
                size: kvMap.total_size ? (parseInt(kvMap.total_size) / 1024).toFixed(0) + 'kB' : (progress.size || '0kB'),
                time: kvMap.out_time ? kvMap.out_time.split('.')[0] : (progress.time || '00:00:00'),
                bitrate: kvMap.bitrate || progress.bitrate || '0kbits/s',
              };
            }
          }

          const tierInfo = stream.adaptive ? QUALITY_TIERS.find(t => t.tier === stream.adaptive.currentTier) : null;
          return sendJSON(res, 200, {
            active: stream.status === 'live' || stream.status === 'starting',
            status: stream.status,
            startedAt: stream.startedAt,
            error: stream.error,
            progress,
            lastLogs: stream.logs.slice(-10),
            adaptive: stream.adaptive ? {
              enabled: stream.adaptive.enabled,
              currentTier: stream.adaptive.currentTier,
              tierName: tierInfo?.name || 'unknown',
              tierResolution: tierInfo?.resolution || '',
              tierBitrate: tierInfo?.bitrate || '',
              maxTier: stream.adaptive.maxTier,
              speed: stream.adaptive.lastSpeed || 0,
              actualBitrate: stream.adaptive.lastBitrate || 0,
              bitrateHealth: (() => {
                const target = tierInfo ? parseInt(tierInfo.bitrate) : 0;
                const actual = stream.adaptive.lastBitrate || 0;
                if (!target || !actual) return 'unknown';
                const ratio = actual / target;
                return ratio >= 0.85 ? 'good' : ratio >= 0.60 ? 'fair' : 'poor';
              })(),
              changing: stream.adaptive.changing,
              tierHistory: stream.adaptive.tierHistory.slice(-10),
            } : null,
          });
        }

        // ── Stream logs ──
        if (url.startsWith('/api/stream/logs/') && req.method === 'GET') {
          const streamId = getPathParam(url, '/api/stream/logs/');
          const stream = activeStreams.get(streamId);
          if (!stream) return sendJSON(res, 200, { logs: [], status: 'offline' });
          return sendJSON(res, 200, { logs: stream.logs, status: stream.status, error: stream.error });
        }

        // ── Active streams list ──
        if (url === '/api/streams/active' && req.method === 'GET') {
          const streams = [];
          activeStreams.forEach((info, id) => {
            streams.push({ streamId: id, status: info.status, startedAt: info.startedAt, error: info.error });
          });
          return sendJSON(res, 200, { streams });
        }

        // ── Adaptive quality control ──
        if (url === '/api/stream/adaptive' && req.method === 'POST') {
          const { streamId, enabled, manualTier } = await readBody(req);
          if (!streamId) return sendJSON(res, 400, { error: 'streamId required' });
          const stream = activeStreams.get(streamId);
          if (!stream) return sendJSON(res, 404, { error: 'Stream not found' });
          if (!stream.adaptive) return sendJSON(res, 400, { error: 'Stream has no adaptive state' });

          if (typeof enabled === 'boolean') {
            stream.adaptive.enabled = enabled;
            if (enabled && !stream.adaptive.monitorInterval) {
              stream.adaptive.monitorInterval = startAdaptiveMonitor(streamId);
            }
            if (!enabled && stream.adaptive.monitorInterval) {
              clearInterval(stream.adaptive.monitorInterval);
              stream.adaptive.monitorInterval = null;
            }
            console.log(`[Adaptive ${streamId}] ${enabled ? 'Enabled' : 'Disabled'}`);
          }

          if (typeof manualTier === 'number' && manualTier >= 1 && manualTier <= 5) {
            const maxT = stream.adaptive.maxTier || getMaxTier();
            const clampedTier = Math.min(manualTier, maxT);
            if (clampedTier !== stream.adaptive.currentTier) {
              await restartStreamWithTier(streamId, clampedTier, `manual set to tier ${clampedTier}`);
            }
          }

          const tierInfo = QUALITY_TIERS.find(t => t.tier === stream.adaptive.currentTier);
          return sendJSON(res, 200, {
            success: true,
            adaptive: {
              enabled: stream.adaptive.enabled,
              currentTier: stream.adaptive.currentTier,
              tierName: tierInfo?.name || 'unknown',
              maxTier: stream.adaptive.maxTier,
            },
          });
        }

        // ── YouTube OAuth: exchange code for token + fetch channel info ──
        if (url === '/api/youtube/token' && req.method === 'POST') {
          const body = await readBody(req);
          const { code, clientId, clientSecret, redirectUri } = body;

          if (!code || !clientId || !clientSecret) {
            return sendJSON(res, 400, { error: 'code, clientId, clientSecret are required' });
          }

          try {
            // 1) Exchange authorization code for access token
            const tokenUrl = 'https://oauth2.googleapis.com/token';
            const tokenBody = new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: redirectUri || `${req.headers.origin || 'http://localhost:5173'}/auth/youtube/callback`,
              grant_type: 'authorization_code',
            });

            const tokenRes = await fetch(tokenUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: tokenBody.toString(),
            });
            const tokenData = await tokenRes.json();

            if (tokenData.error) {
              console.error('[YouTube OAuth] Token error:', tokenData);
              return sendJSON(res, 400, { error: `OAuth error: ${tokenData.error_description || tokenData.error}` });
            }

            const accessToken = tokenData.access_token;

            // 2) Fetch YouTube channel info
            const channelRes = await fetch(
              'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const channelData = await channelRes.json();

            // 3) Fetch user profile info (for email + photo)
            const userInfoRes = await fetch(
              'https://www.googleapis.com/oauth2/v2/userinfo',
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const userInfo = await userInfoRes.json();

            if (!channelData.items || channelData.items.length === 0) {
              return sendJSON(res, 400, { error: 'No YouTube channel found for this account' });
            }

            const ch = channelData.items[0];
            const result = {
              id: ch.id,
              name: ch.snippet.title,
              handle: ch.snippet.customUrl || `@${ch.snippet.title.replace(/\s/g, '')}`,
              email: userInfo.email || '',
              avatarUrl: ch.snippet.thumbnails?.default?.url || ch.snippet.thumbnails?.medium?.url || '',
              subscribers: parseInt(ch.statistics.subscriberCount) || 0,
              videoCount: parseInt(ch.statistics.videoCount) || 0,
              viewCount: parseInt(ch.statistics.viewCount) || 0,
              description: ch.snippet.description || '',
              accessToken,
              refreshToken: tokenData.refresh_token || null,
            };

            console.log(`[YouTube] Channel connected: ${result.name} (${result.id})`);
            return sendJSON(res, 200, { success: true, channel: result });

          } catch (err) {
            console.error('[YouTube OAuth] Error:', err);
            return sendJSON(res, 500, { error: `YouTube API error: ${err.message}` });
          }
        }
        // ── YouTube OAuth: refresh access token ──
        if (url === '/api/youtube/refresh-token' && req.method === 'POST') {
          const body = await readBody(req);
          const { refreshToken, clientId, clientSecret } = body;

          if (!refreshToken || !clientId || !clientSecret) {
            return sendJSON(res, 400, { error: 'refreshToken, clientId, clientSecret required' });
          }

          try {
            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
              }).toString(),
            });
            const tokenData = await tokenRes.json();

            if (tokenData.error) {
              console.error('[YouTube Refresh] Error:', tokenData);
              return sendJSON(res, 400, { error: tokenData.error_description || tokenData.error });
            }

            console.log('[YouTube] Token refreshed successfully');
            return sendJSON(res, 200, { success: true, accessToken: tokenData.access_token });
          } catch (err) {
            console.error('[YouTube Refresh] Error:', err);
            return sendJSON(res, 500, { error: err.message });
          }
        }

        // ── YouTube Live Broadcast: auto-create stream key ──
        if (url === '/api/youtube/broadcast' && req.method === 'POST') {
          const body = await readBody(req);
          const { accessToken, title, description, privacy, scheduledStartTime, category, tags, thumbnailBase64, streamResolution, streamFps } = body;

          if (!accessToken) {
            return sendJSON(res, 400, { error: 'accessToken is required. Connect a YouTube channel first.' });
          }

          // Map our resolution format (e.g. '1280x720') to YouTube CDN format (e.g. '720p')
          const resMap = { '1920x1080': '1080p', '1280x720': '720p', '854x480': '480p', '640x360': '360p' };
          const ytResolution = resMap[streamResolution] || '720p';
          const ytFrameRate = streamFps === '60' ? '60fps' : '30fps';

          try {
            const headers = {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            };

            // 1) Create liveBroadcast
            const broadcastBody = {
              snippet: {
                title: title || 'Live Stream',
                description: description || '',
                scheduledStartTime: scheduledStartTime || new Date().toISOString(),
              },
              status: {
                privacyStatus: privacy || 'unlisted',
                selfDeclaredMadeForKids: false,
              },
              contentDetails: {
                enableAutoStart: true,
                enableAutoStop: false,
                enableDvr: true,
                recordFromStart: true,
                monitorStream: { enableMonitorStream: false },
              },
            };

            const broadcastRes = await fetch(
              'https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails',
              { method: 'POST', headers, body: JSON.stringify(broadcastBody) }
            );
            const broadcast = await broadcastRes.json();

            if (broadcast.error) {
              console.error('[YouTube Broadcast] Error:', broadcast.error);
              return sendJSON(res, 400, { error: broadcast.error.message || 'Failed to create broadcast' });
            }

            // 2) Update the Video for Category and Tags
            try {
              const categoryMap = {
                'Film & Animation': '1', 'Music': '10', 'Sports': '17', 'Gaming': '20',
                'People & Blogs': '22', 'Comedy': '23', 'Entertainment': '24',
                'News & Politics': '25', 'Howto & Style': '26', 'Education': '27',
                'Science & Technology': '28', 'Travel & Events': '19'
              };
              const catId = categoryMap[category] || '22';

              const videoRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${broadcast.id}`, { headers });
              const videoData = await videoRes.json();
              if (videoData.items && videoData.items.length > 0) {
                const snippet = videoData.items[0].snippet;
                snippet.categoryId = catId;
                if (tags && tags.length > 0) snippet.tags = tags;
                snippet.description = description || '';

                await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet`, {
                  method: 'PUT',
                  headers,
                  body: JSON.stringify({ id: broadcast.id, snippet })
                });
              }
            } catch (videoErr) {
              console.warn('[YouTube Broadcast] Failed to update category/tags:', videoErr.message);
            }

            // 3) Create liveStream — tell YouTube the ACTUAL resolution & fps we will send
            const streamBody = {
              snippet: { title: `${title || 'Stream'} - ingestion` },
              cdn: {
                frameRate: ytFrameRate,
                ingestionType: 'rtmp',
                resolution: ytResolution,
              },
            };

            const streamRes = await fetch(
              'https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn',
              { method: 'POST', headers, body: JSON.stringify(streamBody) }
            );
            const liveStream = await streamRes.json();

            if (liveStream.error) {
              console.error('[YouTube Stream] Error:', liveStream.error);
              return sendJSON(res, 400, { error: liveStream.error.message || 'Failed to create stream' });
            }

            // 3) Bind broadcast to stream
            await fetch(
              `https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${broadcast.id}&part=id,contentDetails&streamId=${liveStream.id}`,
              { method: 'POST', headers }
            );

            // 4) Upload Thumbnail if provided
            if (thumbnailBase64) {
              try {
                const base64Data = thumbnailBase64.replace(/^data:image\/\w+;base64,/, '');
                const imageBuffer = Buffer.from(base64Data, 'base64');
                // Auto-detect content type from data URI
                const contentType = thumbnailBase64.startsWith('data:image/png') ? 'image/png'
                  : thumbnailBase64.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
                await fetch(
                  `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${broadcast.id}`,
                  {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${accessToken}`,
                      'Content-Type': contentType,
                    },
                    body: imageBuffer,
                  }
                );
                console.log(`[YouTube] Thumbnail uploaded for broadcast ${broadcast.id}`);
              } catch (err) {
                console.error('[YouTube] Thumbnail upload failed:', err.message);
              }
            }

            const result = {
              broadcastId: broadcast.id,
              streamId: liveStream.id,
              rtmpUrl: liveStream.cdn?.ingestionInfo?.ingestionAddress || 'rtmps://a.rtmp.youtube.com/live2',
              streamKey: liveStream.cdn?.ingestionInfo?.streamName || '',
              dashboardUrl: `https://studio.youtube.com/video/${broadcast.id}/livestreaming`,
              videoUrl: `https://www.youtube.com/watch?v=${broadcast.id}`,
            };

            console.log(`[YouTube] Broadcast created: ${broadcast.id}, Stream key: ${result.streamKey}`);
            return sendJSON(res, 200, { success: true, ...result });

          } catch (err) {
            console.error('[YouTube Broadcast] Error:', err);
            return sendJSON(res, 500, { error: `YouTube API error: ${err.message}` });
          }
        }

        // ── YouTube Live Broadcast: stop stream ──
        if (url === '/api/youtube/broadcast/stop' && req.method === 'POST') {
          const body = await readBody(req);
          const { accessToken, broadcastId } = body;
          
          if (!accessToken || !broadcastId) {
            return sendJSON(res, 400, { error: 'accessToken and broadcastId required' });
          }

          try {
            const resData = await fetch(
              `https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?id=${broadcastId}&broadcastStatus=complete&part=id,status`,
              { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const data = await resData.json();

            if (data.error) {
              return sendJSON(res, 400, { error: data.error.message || 'Failed to stop broadcast' });
            }

            console.log(`[YouTube] Broadcast completed: ${broadcastId}`);
            return sendJSON(res, 200, { success: true, message: 'Broadcast stopped' });
          } catch (err) {
            console.error('[YouTube Broadcast Stop] Error:', err);
            return sendJSON(res, 500, { error: err.message });
          }
        }

        // ── Generate video thumbnail via FFmpeg ──
        if (url.startsWith('/api/video/thumbnail/') && req.method === 'GET') {
          const filename = decodeURIComponent(getPathParam(url, '/api/video/thumbnail/'));
          const filePath = path.join(UPLOAD_DIR, filename);

          if (!fs.existsSync(filePath)) {
            return sendJSON(res, 404, { error: 'File not found' });
          }

          const thumbPath = path.join(UPLOAD_DIR, `thumb_${filename}.jpg`);

          // Return cached thumbnail if exists
          if (fs.existsSync(thumbPath)) {
            res.writeHead(200, { 'Content-Type': 'image/jpeg' });
            fs.createReadStream(thumbPath).pipe(res);
            return;
          }

          // Generate thumbnail at 1 second mark
          const proc = spawn('ffmpeg', [
            '-i', filePath,
            '-ss', '00:00:01',
            '-vframes', '1',
            '-q:v', '8',
            '-vf', 'scale=320:-1',
            '-y', thumbPath,
          ], { shell: false, windowsHide: true });

          proc.on('close', (code) => {
            if (code === 0 && fs.existsSync(thumbPath)) {
              res.writeHead(200, { 'Content-Type': 'image/jpeg' });
              fs.createReadStream(thumbPath).pipe(res);
            } else {
              sendJSON(res, 500, { error: 'Failed to generate thumbnail' });
            }
          });

          proc.on('error', () => {
            sendJSON(res, 500, { error: 'FFmpeg not available for thumbnail generation' });
          });
          return;
        }

        // ── Transcode video for browser playback ──
        if (url.startsWith('/api/video/play/') && req.method === 'GET') {
          const filename = decodeURIComponent(getPathParam(url, '/api/video/play/'));
          const filePath = path.join(UPLOAD_DIR, filename);

          if (!fs.existsSync(filePath)) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }

          const ext = path.extname(filePath).toLowerCase();
          const browserNative = ['.mp4', '.webm', '.ogg', '.ogv'];

          // Browser-native formats: serve directly
          if (browserNative.includes(ext)) {
            const mimeMap = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogg': 'video/ogg', '.ogv': 'video/ogg' };
            const stat = fs.statSync(filePath);
            // Support range requests for seeking
            const range = req.headers.range;
            if (range) {
              const parts = range.replace(/bytes=/, '').split('-');
              const start = parseInt(parts[0], 10);
              const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
              res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': end - start + 1,
                'Content-Type': mimeMap[ext] || 'video/mp4',
              });
              fs.createReadStream(filePath, { start, end, highWaterMark: 1024 * 1024 }).pipe(res);
            } else {
              res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'video/mp4', 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
              fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 }).pipe(res);
            }
            return;
          }

          // Non-browser formats: transcode on-the-fly to MP4 via FFmpeg
          res.writeHead(200, {
            'Content-Type': 'video/mp4',
            'Transfer-Encoding': 'chunked',
          });

          const proc = spawn('ffmpeg', [
            '-i', filePath,
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
            '-c:a', 'aac', '-b:a', '128k',
            '-movflags', 'frag_keyframe+empty_moov+faststart',
            '-f', 'mp4',
            'pipe:1',
          ], { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });

          proc.stdout.pipe(res);
          proc.on('error', () => { res.end(); });
          req.on('close', () => { proc.kill('SIGTERM'); });
          return;
        }

  // Not our route, pass to Vite
  if (next) next();
};
