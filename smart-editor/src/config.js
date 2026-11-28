'use strict';
const fs = require('fs');
const path = require('path');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

loadEnvFile(path.join(__dirname, '..', '.env'));
loadEnvFile(path.join(__dirname, '..', '..', 'server', '.env'));

const num = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const config = {
  ffmpeg: process.env.FFMPEG_PATH || 'ffmpeg',
  ffprobe: process.env.FFPROBE_PATH || 'ffprobe',
  silence: {
    noise: process.env.SILENCE_NOISE || '-35dB',
    minDuration: num(process.env.SILENCE_MIN_DURATION, 0.6),
    mergeGap: num(process.env.SILENCE_MERGE_GAP, 0.3),
    padding: num(process.env.SILENCE_PADDING, 0.08),
  },
  scenes: {
    threshold: num(process.env.SCENE_THRESHOLD, 0.35),
    highlightMinDuration: num(process.env.HIGHLIGHT_MIN_DURATION, 4),
  },
  transcribe: {
    provider: (process.env.TRANSCRIBE_PROVIDER || 'none').toLowerCase(),
    openaiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: process.env.OPENAI_WHISPER_MODEL || 'whisper-1',
    whisperCli: process.env.WHISPER_CLI || '',
    whisperModel: process.env.WHISPER_MODEL || 'base',
  },
  captions: {
    maxCharsPerLine: num(process.env.CAPTION_MAX_CHARS, 42),
    maxLines: num(process.env.CAPTION_MAX_LINES, 2),
  },
  render: {
    crf: num(process.env.RENDER_CRF, 20),
    preset: process.env.RENDER_PRESET || 'medium',
    burnSubtitles: process.env.RENDER_BURN_SUBTITLES !== 'false',
  },
};

module.exports = { config };
