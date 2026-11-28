'use strict';
const fs = require('fs');
const path = require('path');
const { config } = require('./config');
const { probe, detectSilence, detectScenes } = require('./ffmpeg');
const { transcribe } = require('./transcribe');
const { buildEditPlan, writeExports } = require('./plan');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function loadPreset(name) {
  if (!name || name === 'default') {
    return require('../presets/default.json');
  }
  const p = path.resolve(process.cwd(), name);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function analyze(inputPath, { presetName, outDir } = {}) {
  if (!fs.existsSync(inputPath)) throw new Error(`Input not found: ${inputPath}`);
  const preset = loadPreset(presetName);
  const out = path.resolve(outDir || config.outputDir || './out', path.basename(inputPath, path.extname(inputPath)));
  const workDir = path.join(out, '_work');
  fs.mkdirSync(workDir, { recursive: true });

  console.log(`[smart-edit] probing ${inputPath}`);
  const meta = await probe(inputPath);
  console.log(`[smart-edit] duration=${meta.duration.toFixed(1)}s audio=${meta.hasAudio}`);

  console.log('[smart-edit] detecting silence…');
  const silenceGaps = meta.hasAudio
    ? await detectSilence(inputPath, preset.silence)
    : [];
  console.log(`[smart-edit] ${silenceGaps.length} silent gaps`);

  console.log('[smart-edit] detecting scenes…');
  const scenes = await detectScenes(inputPath, preset.scenes?.threshold);
  console.log(`[smart-edit] ${scenes.length} scene changes`);

  console.log(`[smart-edit] transcribing (provider=${config.transcribe.provider})…`);
  const { provider, segments, error } = await transcribe(inputPath, workDir);
  if (error) console.warn(`[smart-edit] transcription skipped: ${error}`);
  console.log(`[smart-edit] ${segments.length} caption segments`);

  const plan = buildEditPlan({
    source: inputPath,
    meta,
    silenceGaps,
    scenes,
    captions: segments,
    preset: presetName || 'default',
  });
  plan.transcription = { provider, segmentCount: segments.length, error: error || null };

  const outputPath = path.join(out, 'smart-cut.mp4');
  const files = writeExports(plan, out, { inputPath, outputPath });

  console.log('\n[smart-edit] done →', out);
  console.log('  files:', Object.keys(files).join(', '));
  console.log(`  keeps ${plan.stats.keepSegments} segments (${plan.stats.keepSeconds.toFixed(1)}s of ${plan.duration.toFixed(1)}s)`);
  console.log(`  removed ${plan.stats.silenceSecondsRemoved.toFixed(1)}s of silence`);
  console.log(`  render: bash render.sh   (or run the ffmpeg command inside)`);
  return { plan, outDir: out };
}

async function captionsOnly(inputPath, { outDir } = {}) {
  const out = path.resolve(outDir || './out', path.basename(inputPath, path.extname(inputPath)));
  fs.mkdirSync(out, { recursive: true });
  const { segments } = await transcribe(inputPath, out);
  const { toSrt, toVtt } = require('./plan');
  fs.writeFileSync(path.join(out, 'captions.srt'), toSrt(segments));
  fs.writeFileSync(path.join(out, 'captions.vtt'), toVtt(segments));
  console.log(`[smart-edit] captions → ${out}`);
}

async function renderFromPlan(planPath, { inputPath, outputPath } = {}) {
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const { buildFfmpegScript } = require('./plan');
  const input = inputPath || plan.source;
  const output = outputPath || path.join(path.dirname(planPath), 'smart-cut.mp4');
  const script = buildFfmpegScript({
    inputPath: input,
    keeps: plan.keeps,
    captionsPath: path.join(path.dirname(planPath), 'captions.srt'),
    outputPath: output,
  });
  const scriptPath = path.join(path.dirname(planPath), 'render.sh');
  fs.writeFileSync(scriptPath, script);
  console.log(`[smart-edit] render script → ${scriptPath}`);
  console.log(`[smart-edit] output → ${output}`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  const input = args._[0];

  switch (cmd) {
    case 'analyze':
    case 'plan':
      if (!input) throw new Error('Usage: smart-edit analyze <video> [--preset p] [--out dir]');
      await analyze(input, { presetName: args.preset, outDir: args.out });
      break;
    case 'captions':
      if (!input) throw new Error('Usage: smart-edit captions <video> [--out dir]');
      await captionsOnly(input, { outDir: args.out });
      break;
    case 'render':
      if (!input) throw new Error('Usage: smart-edit render <edit-plan.json> [--input v] [--out v]');
      await renderFromPlan(input, { inputPath: args.input, outputPath: args.out });
      break;
    default:
      console.log('Commands: analyze | plan | captions | render');
      console.log('See smart-editor/README.md');
      process.exit(cmd ? 1 : 0);
  }
}

main().catch((err) => {
  console.error('[smart-edit] error:', err.message);
  process.exit(1);
});
