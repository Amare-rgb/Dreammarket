'use strict';
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);

const UPLOAD_ROOT = path.resolve(__dirname, '..', 'uploads');
const SMART_ROOT = path.join(UPLOAD_ROOT, 'smart-edit');
const videoFilter = (req, file, cb) => {
  const ok =
    (file.mimetype || '').startsWith('video/') ||
    /\.(mp4|mov|mkv|webm|avi|m4v|mpg|mpeg|ts|m2ts)$/i.test(file.originalname || '');
  cb(ok ? null : new Error('Only video files are allowed'), ok);
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(SMART_ROOT, '_incoming');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.mp4';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  fileFilter: videoFilter,
  limits: { fileSize: 2 * 1024 * 1024 * 1024, files: 1 },
});

const presetPath = path.resolve(__dirname, '..', '..', 'smart-editor', 'presets', 'default.json');

function publicUrl(req, relFromUploads) {
  const publicPath = `/uploads/${relFromUploads.split(path.sep).map(encodeURIComponent).join('/')}`;
  const base = (process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  return `${base}${publicPath}`;
}

router.post('/analyze', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No video file uploaded (field "video").' });
  }

  const jobId = path.basename(req.file.path, path.extname(req.file.path));
  const jobDir = path.join(SMART_ROOT, jobId);
  const workDir = path.join(jobDir, '_work');

  try {
    const { probe, detectSilence, detectScenes } = require('../../smart-editor/src/ffmpeg');
    const { transcribe } = require('../../smart-editor/src/transcribe');
    const { buildEditPlan, writeExports } = require('../../smart-editor/src/plan');
    const preset = fs.existsSync(presetPath)
      ? JSON.parse(fs.readFileSync(presetPath, 'utf8'))
      : {};

    fs.mkdirSync(workDir, { recursive: true });

    const meta = await probe(req.file.path);
    const silenceGaps = meta.hasAudio
      ? await detectSilence(req.file.path, preset.silence || {})
      : [];
    const scenes = await detectScenes(req.file.path, preset.scenes?.threshold);
    const { provider, segments, error: txError } = await transcribe(req.file.path, workDir);

    const plan = buildEditPlan({
      source: req.file.originalname || req.file.path,
      meta,
      silenceGaps,
      scenes,
      captions: segments,
      preset: 'default',
    });
    plan.transcription = { provider, segmentCount: segments.length, error: txError || null };
    plan.jobId = jobId;
    plan.sourceFile = req.file.path;

    const outputPath = path.join(jobDir, 'smart-cut.mp4');
    writeExports(plan, jobDir, { inputPath: req.file.path, outputPath });

    const rel = path.relative(UPLOAD_ROOT, jobDir);
    const files = {};
    for (const name of fs.readdirSync(jobDir)) {
      if (fs.statSync(path.join(jobDir, name)).isFile()) {
        files[name] = publicUrl(req, path.join(rel, name));
      }
    }

    res.json({
      success: true,
      jobId,
      plan: {
        duration: plan.duration,
        stats: plan.stats,
        transcription: plan.transcription,
        keeps: plan.keeps,
        highlights: plan.highlights,
        captions: plan.captions,
        cuts: plan.cuts,
      },
      files,
      planUrl: publicUrl(req, path.join(rel, 'edit-plan.json')),
    });
  } catch (err) {
    console.error('[smart-edit] analyze failed:', err);
    res.status(500).json({
      success: false,
      error: `Smart analysis failed: ${err.message}`,
    });
  }
});
router.get('/:id', (req, res) => {
  const id = path.basename(req.params.id);
  const planPath = path.join(SMART_ROOT, id, 'edit-plan.json');
  if (!fs.existsSync(planPath)) {
    return res.status(404).json({ success: false, error: 'Edit plan not found.' });
  }
  res.type('application/json').send(fs.readFileSync(planPath));
});
router.post('/:id/export/cupcut', (req, res) => {
  try {
    const id = path.basename(req.params.id);
    const jobDir = path.join(SMART_ROOT, id);
    const planPath = path.join(jobDir, 'edit-plan.json');
    if (!fs.existsSync(planPath)) {
      return res.status(404).json({ success: false, error: 'Edit plan not found.' });
    }
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

    const videoPath = plan.sourceFile;
    if (!videoPath || !fs.existsSync(videoPath)) {
      return res.status(400).json({
        success: false,
        error: 'Source video file is no longer on the server. Re-run analysis.',
      });
    }

    const { buildCapCutDraft, defaultDraftsDir } = require('../../smart-editor/src/cupcut');
    const result = buildCapCutDraft({
      name: plan.source || id,
      videoPath,
      meta: plan.meta || {},
      keeps: plan.keeps || [],
      captions: plan.captions || [],
    });

    res.json({
      success: true,
      draftDir: result.draftDir,
      draftName: result.draftName,
      draftsRoot: defaultDraftsDir(),
      message:
        'CapCut draft created. Open CapCut → Drafts — it will appear as "' +
        result.draftName + '". The source video is referenced in place; fine-tune there.',
    });
  } catch (err) {
    console.error('[smart-edit] cupcut export failed:', err);
    res.status(500).json({ success: false, error: `CapCut export failed: ${err.message}` });
  }
});

router.get('/:id/files/:name', (req, res) => {
  const id = path.basename(req.params.id);
  const name = path.basename(req.params.name);
  const allowed = /^(edit-plan\.json|captions\.(srt|vtt)|markers\.(edl|csv)|render\.sh|smart-cut\.mp4|preview\.mp4)$/;
  if (!allowed.test(name)) {
    return res.status(400).json({ success: false, error: 'File not allowed.' });
  }
  const filePath = path.join(SMART_ROOT, id, name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'File not found.' });
  }
  res.download(filePath, name);
});

module.exports = router;
