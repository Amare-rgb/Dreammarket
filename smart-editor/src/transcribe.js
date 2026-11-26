'use strict';

/**
 * Transcription providers:
 *  - openai    : OpenAI Whisper API (whisper-1, verbose_json w/ timestamps)
 *  - whispercpp: local whisper.cpp binary
 *  - none      : skip
 * Returns segments: [{ start, end, text }]
 */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { config } = require('./config');
const { extractAudio } = require('./ffmpeg');

async function transcribeOpenAI(audioPath) {
  const key = config.transcribe.openaiKey;
  if (!key) throw new Error('OPENAI_API_KEY is not set');

  const form = new FormData();
  const buf = fs.readFileSync(audioPath);
  form.append('file', new Blob([buf]), path.basename(audioPath));
  form.append('model', config.transcribe.openaiModel);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Whisper API ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return (data.segments || []).map((s) => ({
    start: s.start,
    end: s.end,
    text: (s.text || '').trim(),
  }));
}

function runCli(cmd, args, timeoutMs = 30 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => (err ? reject(err) : resolve(stdout || stderr || '')));
  });
}

/** whisper.cpp outputs .srt next to the wav when -osrt is passed. */
async function transcribeWhisperCpp(audioPath, workDir) {
  const cli = config.transcribe.whisperCli;
  if (!cli || !fs.existsSync(cli)) {
    throw new Error('WHISPER_CLI not set or binary not found');
  }
  const base = path.join(workDir, 'whisper-out');
  await runCli(cli, [
    '-m', path.join(path.dirname(cli), config.transcribe.whisperModel + '.bin'),
    '-f', audioPath,
    '-osrt', '-of', base,
  ]);
  const srtPath = `${base}.srt`;
  if (!fs.existsSync(srtPath)) throw new Error('whisper.cpp produced no .srt');
  return parseSrt(fs.readFileSync(srtPath, 'utf8'));
}

/** Parse an SRT file into [{start,end,text}] (seconds). */
function parseSrt(srt) {
  const toSec = (t) => {
    const [h, m, rest] = t.split(':');
    const [s, ms] = rest.split(',');
    return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
  };
  const blocks = srt.trim().split(/\r?\n\r?\n/);
  const out = [];
  for (const b of blocks) {
    const lines = b.split(/\r?\n/);
    const timeLine = lines.find((l) => l.includes('-->'));
    if (!timeLine) continue;
    const [a, z] = timeLine.split('-->').map((x) => x.trim().split(/\s+/)[0]);
    const text = lines.slice(lines.indexOf(timeLine) + 1).join(' ').trim();
    if (text) out.push({ start: toSec(a), end: toSec(z), text });
  }
  return out;
}

/**
 * Main entry. Returns { provider, segments } — segments may be [].
 */
async function transcribe(inputPath, workDir) {
  const provider = config.transcribe.provider;
  if (provider === 'none') return { provider, segments: [] };

  const wav = path.join(workDir, 'audio-16k.wav');
  await extractAudio(inputPath, wav);

  try {
    if (provider === 'openai') {
      return { provider, segments: await transcribeOpenAI(wav) };
    }
    if (provider === 'whispercpp') {
      return { provider, segments: await transcribeWhisperCpp(wav, workDir) };
    }
  } catch (err) {
    return { provider, segments: [], error: err.message };
  }
  return { provider, segments: [] };
}

module.exports = { transcribe, parseSrt };
