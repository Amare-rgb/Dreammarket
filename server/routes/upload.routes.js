// routes/upload.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

/* ────────────────────────────────────────────────────────────────
   AUTH
   ──────────────────────────────────────────────────────────────── */
const { requireAuth, requireAdmin } = require('../middleware/auth');

const UPLOAD_ROOT = path.resolve(__dirname, '..', 'uploads');

/* ────────────────────────────────────────────────────────────────
   FILE-TYPE GUARDS
   ──────────────────────────────────────────────────────────────── */
const IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
];

const VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov
  'video/x-msvideo', // .avi
  'video/x-matroska', // .mkv
];

const PDF_TYPES = ['application/pdf'];

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
  'application/pdf': '.pdf',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
  'video/x-matroska': '.mkv',
};

function makeFileFilter({
  images = false,
  videos = false,
  pdfs = false,
} = {}) {
  return (req, file, cb) => {
    const mime = file.mimetype || '';
    const isImage = images && IMAGE_TYPES.includes(mime);
    const isVideo = videos && VIDEO_TYPES.includes(mime);
    const isPdf = pdfs && PDF_TYPES.includes(mime);

    if (isImage || isVideo || isPdf) return cb(null, true);

    const allowed = [
      images && 'images (jpeg/png/gif/webp/avif/svg)',
      videos && 'videos (mp4/webm/mov/avi/mkv)',
      pdfs && 'pdf',
    ]
      .filter(Boolean)
      .join(', ');

    cb(new Error(`Invalid file type: ${mime}. Allowed: ${allowed || 'none'}`), false);
  };
}

/* ────────────────────────────────────────────────────────────────
   LOCAL DISK STORAGE
   ──────────────────────────────────────────────────────────────── */
function buildStorage(subfolder) {
  const destination = path.resolve(UPLOAD_ROOT, subfolder);
  const relativeDestination = path.relative(UPLOAD_ROOT, destination);
  if (
    relativeDestination.startsWith('..') ||
    path.isAbsolute(relativeDestination)
  ) {
    throw new Error('Invalid upload destination');
  }

  return multer.diskStorage({
    destination: (req, file, callback) => {
      fs.mkdir(destination, { recursive: true }, (error) =>
        callback(error, destination)
      );
    },
    filename: (req, file, callback) => {
      const ext =
        EXT_BY_MIME[file.mimetype] ||
        path.extname(file.originalname || '').toLowerCase() ||
        '';
      callback(null, `${randomUUID()}${ext}`);
    },
  });
}

function buildUploader({
  subfolder = 'uploads',
  maxSizeMB = 10,
  maxFiles = 10,
  images = false,
  videos = false,
  pdfs = false,
} = {}) {
  return multer({
    storage: buildStorage(subfolder),
    fileFilter: makeFileFilter({ images, videos, pdfs }),
    limits: { fileSize: maxSizeMB * 1024 * 1024, files: maxFiles },
  });
}

/* ────────────────────────────────────────────────────────────────
   PRE-BUILT UPLOADERS
   ──────────────────────────────────────────────────────────────── */
const imageUploader = buildUploader({
  subfolder: 'uploads',
  maxSizeMB: 10,
  maxFiles: 10,
  images: true,
});

const pdfUploader = buildUploader({
  subfolder: 'pdfs',
  maxSizeMB: 20,
  maxFiles: 1,
  images: true,
  pdfs: true,
});

const singleImage = imageUploader.fields([
  { name: 'file', maxCount: 1 },
  { name: 'image', maxCount: 1 },
  { name: 'avatar', maxCount: 1 },
]);

const singlePdf = pdfUploader.single('file');

/* ────────────────────────────────────────────────────────────────
   HELPERS
   ──────────────────────────────────────────────────────────────── */
function pickSingleFile(req) {
  if (req.file) return req.file;
  if (!req.files || typeof req.files !== 'object') return null;
  for (const f of Object.keys(req.files)) {
    if (Array.isArray(req.files[f]) && req.files[f].length > 0) {
      return req.files[f][0];
    }
  }
  return null;
}

function fileToUrl(req, file) {
  if (!file) return null;
  const relativePath = path.relative(UPLOAD_ROOT, file.path);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return null;
  const publicPath = `/uploads/${relativePath
    .split(path.sep)
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;
  return `${req.protocol}://${req.get('host')}${publicPath}`;
}

function fileToPublicId(file) {
  if (!file) return null;
  const relativePath = path.relative(UPLOAD_ROOT, file.path);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return null;
  return relativePath.split(path.sep).join('/');
}

function handleMulterErrors(err, res) {
  if (!err) return null;

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'File too large.',
        code: 'FILE_TOO_LARGE',
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error:
          'Unexpected field name. Accepted fields depend on the endpoint (e.g. "file", "image", "avatar", "files", "video").',
        code: 'UNEXPECTED_FIELD',
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files.',
        code: 'TOO_MANY_FILES',
      });
    }
    return res.status(400).json({
      success: false,
      error: err.message || 'Upload failed',
      code: err.code || 'UPLOAD_FAILED',
    });
  }

  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      error: err.message,
      code: 'INVALID_FILE_TYPE',
    });
  }

  console.error('Local file upload failed:', {
    name: err.name,
    code: err.code,
    message: err.message,
  });
  return res.status(500).json({
    success: false,
    error: 'The file could not be saved to local storage.',
    code: 'LOCAL_UPLOAD_FAILED',
  });
}

/* ════════════════════════════════════════════════════════════════
   ROUTES
   ════════════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────────────
   PRODUCT IMAGE — single   (ADMIN ONLY)
   POST /api/upload/product-image
   field: "image" | "file"
   ──────────────────────────────────────────────────────────────── */
router.post('/product-image', requireAuth, requireAdmin, (req, res) => {
  const uploader = buildUploader({
    subfolder: 'products',
    maxSizeMB: 10,
    maxFiles: 1,
    images: true,
  });
  const mw = uploader.fields([
    { name: 'image', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]);

  mw(req, res, (err) => {
    const mErr = handleMulterErrors(err, res);
    if (mErr) return;

    const file = pickSingleFile(req);
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No image uploaded (field "image" or "file").',
        code: 'NO_FILE',
      });
    }

    const url = fileToUrl(req, file);
    const publicId = fileToPublicId(file);
    return res.json({
      success: true,
      url,
      secure_url: url,
      publicId,
      public_id: publicId,
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.mimetype,
    });
  });
});

/* ────────────────────────────────────────────────────────────────
   PRODUCT IMAGE — multiple   (ADMIN ONLY)
   POST /api/upload/product-image/multiple
   field: "images"
   ──────────────────────────────────────────────────────────────── */
router.post('/product-image/multiple', requireAuth, requireAdmin, (req, res) => {
  const uploader = buildUploader({
    subfolder: 'products',
    maxSizeMB: 10,
    maxFiles: 10,
    images: true,
  });
  const mw = uploader.array('images', 10);

  mw(req, res, (err) => {
    const mErr = handleMulterErrors(err, res);
    if (mErr) return;

    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      return res.status(400).json({
        success: false,
        error: 'No images uploaded (field "images").',
        code: 'NO_FILES',
      });
    }

    const results = files.map((f) => {
      const url = fileToUrl(req, f);
      const publicId = fileToPublicId(f);
      return {
        url,
        secure_url: url,
        publicId,
        public_id: publicId,
        fileName: f.originalname,
        fileSize: f.size,
        fileType: f.mimetype,
      };
    });

    return res.json({ success: true, files: results });
  });
});

/* ────────────────────────────────────────────────────────────────
   PRODUCT VIDEO — single   (ADMIN ONLY)
   POST /api/upload/product-video
   field: "video" | "file"
   ──────────────────────────────────────────────────────────────── */
router.post('/product-video', requireAuth, requireAdmin, (req, res) => {
  const uploader = buildUploader({
    subfolder: 'products/videos',
    maxSizeMB: 100,
    maxFiles: 1,
    videos: true,
  });
  const mw = uploader.fields([
    { name: 'video', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]);

  mw(req, res, (err) => {
    const mErr = handleMulterErrors(err, res);
    if (mErr) return;

    const file = pickSingleFile(req);
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No video uploaded (field "video" or "file").',
        code: 'NO_FILE',
      });
    }

    const url = fileToUrl(req, file);
    const publicId = fileToPublicId(file);
    return res.json({
      success: true,
      url,
      secure_url: url,
      publicId,
      public_id: publicId,
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.mimetype,
    });
  });
});

/* ────────────────────────────────────────────────────────────────
   BACKWARD-COMPAT: PRODUCT IMAGE (old endpoint)
   POST /api/upload/product
   ──────────────────────────────────────────────────────────────── */
router.post('/product', requireAuth, requireAdmin, (req, res) => {
  const uploader = buildUploader({
    subfolder: 'products',
    maxSizeMB: 10,
    maxFiles: 1,
    images: true,
  });
  const mw = uploader.fields([
    { name: 'file', maxCount: 1 },
    { name: 'image', maxCount: 1 },
  ]);

  mw(req, res, (err) => {
    const mErr = handleMulterErrors(err, res);
    if (mErr) return;

    const file = pickSingleFile(req);
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        code: 'NO_FILE',
      });
    }

    const url = fileToUrl(req, file);
    const publicId = fileToPublicId(file);
    return res.json({
      success: true,
      url,
      secure_url: url,
      publicId,
      public_id: publicId,
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.mimetype,
    });
  });
});

/* ────────────────────────────────────────────────────────────────
   BACKWARD-COMPAT: PRODUCT IMAGES (old endpoint)
   POST /api/upload/products
   ──────────────────────────────────────────────────────────────── */
router.post('/products', requireAuth, requireAdmin, (req, res) => {
  const uploader = buildUploader({
    subfolder: 'products',
    maxSizeMB: 10,
    maxFiles: 10,
    images: true,
  });
  const mw = uploader.array('files', 10);

  mw(req, res, (err) => {
    const mErr = handleMulterErrors(err, res);
    if (mErr) return;

    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded',
        code: 'NO_FILES',
      });
    }

    const results = files.map((f) => {
      const url = fileToUrl(req, f);
      const publicId = fileToPublicId(f);
      return {
        url,
        secure_url: url,
        publicId,
        public_id: publicId,
        fileName: f.originalname,
        fileSize: f.size,
        fileType: f.mimetype,
      };
    });

    return res.json({ success: true, files: results });
  });
});

/* ────────────────────────────────────────────────────────────────
   GENERIC — POST /api/upload
   fields: "file" | "image" | "avatar"
   ──────────────────────────────────────────────────────────────── */
router.post('/', requireAuth, (req, res) => {
  singleImage(req, res, async (err) => {
    const mErr = handleMulterErrors(err, res);
    if (mErr) return;

    const file = pickSingleFile(req);
    if (!file) {
      return res.status(400).json({
        success: false,
        error:
          'No file uploaded. Send a file under "file", "image", or "avatar".',
        code: 'NO_FILE',
      });
    }

    const isAvatar = file.fieldname === 'avatar';
    const url = fileToUrl(req, file);
    const publicId = fileToPublicId(file);

    return res.json({
      success: true,
      url,
      secure_url: url,
      publicId,
      public_id: publicId,
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.mimetype,
      message: isAvatar
        ? 'Avatar uploaded successfully'
        : 'File uploaded successfully',
    });
  });
});

/* ────────────────────────────────────────────────────────────────
   AVATAR — any logged-in user
   ──────────────────────────────────────────────────────────────── */
router.post('/avatar', requireAuth, (req, res) => {
  const uploader = buildUploader({
    subfolder: 'avatars',
    maxSizeMB: 10,
    maxFiles: 1,
    images: true,
  });
  const mw = uploader.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'file', maxCount: 1 },
    { name: 'image', maxCount: 1 },
  ]);

  mw(req, res, (err) => {
    const mErr = handleMulterErrors(err, res);
    if (mErr) return;

    const file = pickSingleFile(req);
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        code: 'NO_FILE',
      });
    }

    const url = fileToUrl(req, file);
    const publicId = fileToPublicId(file);
    return res.json({
      success: true,
      url,
      secure_url: url,
      publicId,
      public_id: publicId,
    });
  });
});

/* ────────────────────────────────────────────────────────────────
   FOLDER-SCOPED SINGLE IMAGE ENDPOINTS
   ──────────────────────────────────────────────────────────────── */
function makeFolderRoute(folder) {
  return (req, res) => {
    const uploader = buildUploader({
      subfolder: folder,
      maxSizeMB: 10,
      maxFiles: 1,
      images: true,
    });
    const mw = uploader.fields([
      { name: 'file', maxCount: 1 },
      { name: 'image', maxCount: 1 },
    ]);

    mw(req, res, (err) => {
      const mErr = handleMulterErrors(err, res);
      if (mErr) return;

      const file = pickSingleFile(req);
      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
          code: 'NO_FILE',
        });
      }

      const url = fileToUrl(req, file);
      const publicId = fileToPublicId(file);
      return res.json({
        success: true,
        url,
        secure_url: url,
        publicId,
        public_id: publicId,
        fileName: file.originalname,
        fileSize: file.size,
        fileType: file.mimetype,
      });
    });
  };
}

router.post('/settings', requireAuth, requireAdmin, makeFolderRoute('settings'));
router.post('/category', requireAuth, requireAdmin, makeFolderRoute('categories'));
router.post('/blog', requireAuth, requireAdmin, makeFolderRoute('blog'));
router.post('/profile', requireAuth, makeFolderRoute('profiles'));

/* ────────────────────────────────────────────────────────────────
   PAYMENT — image OR pdf
   ──────────────────────────────────────────────────────────────── */
router.post('/payment', requireAuth, (req, res) => {
  const uploader = buildUploader({
    subfolder: 'payments',
    maxSizeMB: 10,
    maxFiles: 1,
    images: true,
    pdfs: true,
  });
  const mw = uploader.fields([
    { name: 'file', maxCount: 1 },
    { name: 'image', maxCount: 1 },
  ]);

  mw(req, res, (err) => {
    const mErr = handleMulterErrors(err, res);
    if (mErr) return;

    const file = pickSingleFile(req);
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No payment information file uploaded',
        code: 'NO_FILE',
      });
    }

    const url = fileToUrl(req, file);
    const publicId = fileToPublicId(file);
    return res.json({
      success: true,
      url,
      secure_url: url,
      publicId,
      public_id: publicId,
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.mimetype,
    });
  });
});

/* ────────────────────────────────────────────────────────────────
   PDF — ADMIN ONLY
   ──────────────────────────────────────────────────────────────── */
router.post('/pdf', requireAuth, requireAdmin, (req, res) => {
  singlePdf(req, res, (err) => {
    const mErr = handleMulterErrors(err, res);
    if (mErr) return;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No PDF uploaded',
        code: 'NO_FILE',
      });
    }

    const url = fileToUrl(req, req.file);
    const publicId = fileToPublicId(req.file);
    return res.json({
      success: true,
      url,
      secure_url: url,
      publicId,
      public_id: publicId,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
    });
  });
});

/* ────────────────────────────────────────────────────────────────
   DELETE a locally stored upload — ADMIN ONLY
   ──────────────────────────────────────────────────────────────── */
router.delete('/:publicId(*)', requireAuth, requireAdmin, async (req, res) => {
  try {
    const publicId = (req.params.publicId || '').replace(/\\/g, '/');
    const segments = publicId.split('/');
    const filePath = path.resolve(UPLOAD_ROOT, ...segments);
    const relativePath = path.relative(UPLOAD_ROOT, filePath);

    if (
      !publicId ||
      segments.some((s) => !s || s === '.' || s === '..') ||
      relativePath.startsWith('..') ||
      path.isAbsolute(relativePath)
    ) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file path',
        code: 'INVALID_FILE_PATH',
      });
    }

    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({
          success: false,
          error: 'File not found',
          code: 'FILE_NOT_FOUND',
        });
      }
      throw error;
    }

    return res.json({ success: true, message: 'File deleted successfully' });
  } catch (err) {
    console.error('❌ Local file delete error:', err.message || err);
    return res
      .status(500)
      .json({ success: false, error: 'File deletion failed' });
  }
});

module.exports = router;