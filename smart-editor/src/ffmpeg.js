'use strict';
const { execFile } = require('child_process');
const { config } = require('./config');

function run(cmd, args, { timeoutMs = 10 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          const out = `${stdout || ''}\n${stderr || ''}`;
          if (out.trim()) return resolve(out);
          return reject(err);
        }
        resolve(`${stdout || ''}\n${stderr || ''}`);
      }
    );
  });
}
async function probe(inputPath) {
  const out = await run(config.ffprobe, [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    inputPath,
  ]);
  const data = JSON.parse(out);
  const video = (data.streams || []).find((s) => s.codec_type === 'video');
  const audio = (data.streams || []).find((s) => s.codec_type === 'audio');
  return {
    duration: Number(data.format?.duration) || 0,
    size: Number(data.format?.size) || 0,
    hasAudio: Boolean(audio),
    width: video?.width || null,
    height: video?.height || null,
    fps: video?.avg_frame_rate
      ? eval(video.avg_frame_rate) || null
      : null,
  };
}
async function detectSilence(inputPath, opts = {}) {
  const noise = opts.noise || config.silence.noise;
  const minDur = opts.minDuration ?? config.silence.minDuration;
  const out = await run(
    config.ffmpeg,
    [
      '-hide_banner', '-nostats', '-i', inputPath,
      '-af', `silencedetect=noise=${noise}:d=${minDur}`,
      '-f', 'null', '-',
    ],
    { timeoutMs: 15 * 60 * 1000 }
  );

  const starts = [];
  const ends = [];
  for (const line of out.split(/\r?\n/)) {
    const s = line.match(/silence_start:\s*([\d.]+)/);
    const e = line.match(/silence_end:\s*([\d.]+)/);
    if (s) starts.push(Number(s[1]));
    if (e) ends.push(Number(e[1]));
  }
  const gaps = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = ends[i] !== undefined ? ends[i] : null;
    gaps.push({ start, end, duration: end != null ? end - start : null });
  }
  return gaps;
}
async function detectScenes(inputPath, threshold) {
  const th = threshold ?? config.scenes.threshold;
  const out = await run(
    config.ffmpeg,
    [
      '-hide_banner', '-nostats', '-i', inputPath,
      '-vf', `select='gt(scene,${th})',showinfo`,
      '-f', 'null', '-',
    ],
    { timeoutMs: 15 * 60 * 1000 }
  );

  const scenes = [];
  for (const line of out.split(/\r?\n/)) {
    const t = line.match(/pts_time:([\d.]+)/);
    const sc = line.match(/scene_score=([\d.]+)/);
    if (t) {
      scenes.push({ time: Number(t[1]), score: sc ? Number(sc[1]) : null });
    }
  }
  return scenes;
}
async function extractAudio(inputPath, outWav) {
  await run(config.ffmpeg, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', inputPath,
    '-vn', '-ac', '1', '-ar', '16000',
    outWav,
  ]);
}

module.exports = { run, probe, detectSilence, detectScenes, extractAudio };
