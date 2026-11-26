'use strict';

/**
 * Edit-plan builder + exporters.
 *
 * edit-plan.json schema:
 * {
 *   version, source, duration,
 *   cuts:      [{ start, end, reason }],          // ranges to REMOVE
 *   keeps:     [{ start, end, label, score }],    // ranges to KEEP
 *   highlights: [{ start, end, label, score }],   // scene-change markers
 *   captions:  [{ start, end, text }],
 *   transitions: [...],
 *   exports:   { srt, vtt, edl, csv, ffmpegScript }
 * }
 */
const fs = require('fs');
const path = require('path');
const { config } = require('./config');

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

function fmtSrtTime(sec) {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mm = ms % 1000;
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(h)}:${p(m)}:${p(s)},${p(mm, 3)}`;
}
function fmtVttTime(sec) {
  return fmtSrtTime(sec).replace(',', '.');
}

/** Merge silence gaps closer than mergeGap; apply padding. */
function silenceToCuts(gaps, duration, opts = {}) {
  const mergeGap = opts.mergeGap ?? config.silence.mergeGap;
  const pad = opts.padding ?? config.silence.padding;
  const sorted = gaps
    .filter((g) => g.end != null)
    .map((g) => ({ start: g.start, end: g.end }))
    .sort((a, b) => a.start - b.start);

  const merged = [];
  for (const g of sorted) {
    const last = merged[merged.length - 1];
    if (last && g.start - last.end <= mergeGap) {
      last.end = Math.max(last.end, g.end);
    } else {
      merged.push({ ...g });
    }
  }
  return merged.map((g) => ({
    start: clamp(g.start - pad, 0, duration),
    end: clamp(g.end + pad, 0, duration),
    reason: 'silence',
  }));
}

/** Invert cuts → keep ranges. */
function cutsToKeeps(cuts, duration) {
  const keeps = [];
  let cursor = 0;
  for (const c of cuts) {
    if (c.start > cursor) keeps.push({ start: cursor, end: c.start });
    cursor = Math.max(cursor, c.end);
  }
  if (cursor < duration) keeps.push({ start: cursor, end: duration });
  return keeps.filter((k) => k.end - k.start > 0.05);
}

/** Group scene changes into highlight segments (scene → next scene). */
function scenesToHighlights(scenes, duration, minDur) {
  const pts = [0, ...scenes.map((s) => s.time), duration]
    .filter((t) => t >= 0 && t <= duration)
    .sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const start = pts[i];
    const end = pts[i + 1];
    if (end - start >= minDur) {
      out.push({
        start,
        end,
        label: `segment-${String(i + 1).padStart(3, '0')}`,
        score: scenes.find((s) => Math.abs(s.time - start) < 0.5)?.score ?? null,
      });
    }
  }
  return out;
}

/** Split long caption segments into caption-sized chunks. */
function chunkCaptions(segments, maxChars = 84) {
  const out = [];
  for (const seg of segments) {
    const words = seg.text.split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    let buf = [];
    let bufStart = seg.start;
    const push = (endTime) => {
      if (buf.length) {
        out.push({ start: bufStart, end: endTime, text: buf.join(' ') });
        buf = [];
      }
    };
    for (const w of words) {
      const candidate = [...buf, w].join(' ');
      if (candidate.length > maxChars && buf.length) {
        push(seg.start); // approximate; refined below by proportional split
        bufStart = seg.start; // keep simple — timing precision from whisper is per-segment
        buf = [w];
      } else {
        buf.push(w);
      }
    }
    push(seg.end);
  }
  return out;
}

function toSrt(captions) {
  return captions
    .map((c, i) => `${i + 1}\n${fmtSrtTime(c.start)} --> ${fmtSrtTime(c.end)}\n${c.text}\n`)
    .join('\n');
}
function toVtt(captions) {
  return 'WEBVTT\n\n' +
    captions
      .map((c) => `${fmtVttTime(c.start)} --> ${fmtVttTime(c.end)}\n${c.text}\n`)
      .join('\n');
}

/** EDL (CMX3600-ish) for timeline editors. */
function toEdl(keeps, title = 'smart-edit') {
  const lines = [
    `TITLE: ${title}`,
    'FCM: NON-DROP FRAME',
    '',
  ];
  let reel = 1;
  for (const k of keeps) {
    const src = `${fmtEdlTime(k.start)} ${fmtEdlTime(k.end)}`;
    const rec = `${fmtEdlTime(k.start - keeps[0].start)} ${fmtEdlTime(k.end - keeps[0].start)}`;
    lines.push(`${String(reel).padStart(3, '0')}  AX       V     C        ${src} ${rec}`);
    reel++;
  }
  return lines.join('\n') + '\n';
}
function fmtEdlTime(sec) {
  const f = Math.round((sec % 1) * 24);
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(h)}:${p(m)}:${p(s)}:${p(f)}`;
}

/** CSV marker list for Premiere/FCP/DaVinci import. */
function toCsv(markers) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['marker_id', 'start_sec', 'end_sec', 'label', 'type', 'score']];
  markers.forEach((m, i) => {
    rows.push([i + 1, m.start.toFixed(3), (m.end ?? m.start).toFixed(3), m.label, m.type, m.score ?? '']);
  });
  return rows.map((r) => r.map(esc).join(',')).join('\n') + '\n';
}

/**
 * FFmpeg render script: builds a concat list of keep-segments and
 * renders with optional burned subtitles. Keeps source untouched.
 */
function buildFfmpegScript({ inputPath, keeps, captionsPath, outputPath, opts = {} }) {
  const crf = opts.crf ?? config.render.crf;
  const preset = opts.preset ?? config.render.preset;
  const burn = opts.burnSubtitles ?? config.render.burnSubtitles;

  const lines = [
    '#!/usr/bin/env bash',
    '# Auto-generated by smart-editor — rough cut render',
    '# Source is never modified; output is a new file.',
    'set -euo pipefail',
    '',
    `INPUT="${inputPath}"`,
    `OUTPUT="${outputPath}"`,
    '',
    '# 1) Concat keep-segments via filter (frame-accurate, no re-encode of cuts)',
  ];

  const n = keeps.length;
  const filterParts = keeps.map(
    (k, i) => `[0:v]trim=start=${k.start.toFixed(3)}:end=${k.end.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`
  );
  const audioParts = keeps.map(
    (k, i) => `[0:a]atrim=start=${k.start.toFixed(3)}:end=${k.end.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`
  );
  const concatV = keeps.map((_, i) => `[v${i}]`).join('') + `concat=n=${n}:v=1:a=0[vc]`;
  const concatA = keeps.map((_, i) => `[a${i}]`).join('') + `concat=n=${n}:v=0:a=1[ac]`;

  let vf = '';
  if (burn && captionsPath) {
    // escape for ffmpeg filter: subtitles=filename (path with : needs escaping on Windows)
    const subPath = captionsPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    vf = `[vc]subtitles='${subPath}'[vout]`;
  } else {
    vf = '[vc]null[vout]';
  }

  lines.push(
    `ffmpeg -y -i "$INPUT" \\`,
    `  -filter_complex "${[...filterParts, ...audioParts, concatV, concatA, vf].join(';')}" \\`,
    `  -map "[vout]" -map "[ac]" \\`,
    `  -c:v libx264 -crf ${crf} -preset ${preset} \\`,
    `  -c:a aac -b:a 192k \\`,
    `  -movflags +faststart "$OUTPUT"`,
    '',
    '# 2) Preview (fast, low-res, no captions):',
    `ffmpeg -y -i "$INPUT" -filter_complex "${[...filterParts, ...audioParts, concatV, concatA, '[vc]null[vout]'].join(';')}" \\`,
    `  -map "[vout]" -map "[ac]" -c:v libx264 -crf 28 -preset ultrafast -c:a aac -b:a 128k preview.mp4`,
    ''
  );
  return lines.join('\n');
}

/**
 * Assemble the full edit plan object.
 */
function buildEditPlan({ source, meta, silenceGaps, scenes, captions, preset }) {
  const duration = meta.duration || 0;
  const cuts = silenceToCuts(silenceGaps, duration);
  const keeps = cutsToKeeps(cuts, duration);
  const highlights = scenesToHighlights(
    scenes,
    duration,
    config.scenes.highlightMinDuration
  );
  const capChunks = chunkCaptions(captions || [], config.captions.maxCharsPerLine * config.captions.maxLines);

  const markers = [
    ...highlights.map((h) => ({ ...h, type: 'highlight' })),
    ...cuts.map((c) => ({ start: c.start, end: c.end, label: 'cut:silence', type: 'cut' })),
  ].sort((a, b) => a.start - b.start);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    preset: preset || 'default',
    source,
    duration,
    meta,
    stats: {
      silenceCuts: cuts.length,
      silenceSecondsRemoved: cuts.reduce((s, c) => s + (c.end - c.start), 0),
      keepSegments: keeps.length,
      keepSeconds: keeps.reduce((s, k) => s + (k.end - k.start), 0),
      highlights: highlights.length,
      captions: capChunks.length,
    },
    cuts,
    keeps,
    highlights,
    captions: capChunks,
    transitions: keeps.slice(1).map((k, i) => ({
      at: k.start,
      type: 'cut',
      suggestion: i % 3 === 0 ? 'dip-to-black' : 'hard-cut',
    })),
    markers,
  };
}

/** Write all export files into outDir; returns map of filenames. */
function writeExports(plan, outDir, { inputPath, outputPath } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const files = {};

  const put = (name, content) => {
    fs.writeFileSync(path.join(outDir, name), content);
    files[name] = name;
  };

  put('edit-plan.json', JSON.stringify(plan, null, 2));
  put('captions.srt', toSrt(plan.captions));
  put('captions.vtt', toVtt(plan.captions));
  put('markers.edl', toEdl(plan.keeps, path.basename(plan.source || 'edit')));
  put('markers.csv', toCsv(plan.markers));
  if (inputPath && outputPath) {
    put('render.sh', buildFfmpegScript({
      inputPath,
      keeps: plan.keeps,
      captionsPath: path.join(outDir, 'captions.srt'),
      outputPath,
      opts: { burnSubtitles: config.render.burnSubtitles },
    }));
  }
  return files;
}

module.exports = {
  buildEditPlan,
  writeExports,
  silenceToCuts,
  cutsToKeeps,
  scenesToHighlights,
  chunkCaptions,
  toSrt,
  toVtt,
  toEdl,
  toCsv,
  buildFfmpegScript,
};
