const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const UPLOAD_ROOT = path.resolve(__dirname, '..', 'uploads');

// ── Field → local subfolder map ─────────────────────────────────────────
const SUBFOLDERS = {
  image: 'products',
  images: 'products',
  product: 'products',
  avatar: 'avatars',
  documents: 'documents',
  document: 'documents',
  receipt: 'receipts',
  article: 'articles',
  logo: 'settings',
};

// ── Helpers ─────────────────────────────────────────────────────────────
const makeError = (code, message) =>
  Object.assign(new Error(message), { code });

// File filter — images + PDFs (same rules as before)
const fileFilter = (req, file, cb) => {
  const validTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'image/svg+xml',
    'application/pdf',
  ];

  const validExtensions = [
    '.jpeg',
    '.jpg',
    '.png',
    '.webp',
    '.gif',
    '.avif',
    '.svg',
    '.pdf',
  ];

  const ext = path.extname(file.originalname).toLowerCase();

  if (validTypes.includes(file.mimetype) || validExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file type. Allowed: JPEG, PNG, WEBP, GIF, AVIF, SVG, PDF'
      )
    );
  }
};

// ── Local disk storage ──────────────────────────────────────────────────
const localStorage = multer.diskStorage({
  destination: (req, file, callback) => {
    const subfolder = SUBFOLDERS[file.fieldname] || 'products';
    const destination = path.resolve(UPLOAD_ROOT, subfolder);
    fs.mkdir(destination, { recursive: true }, (error) =>
      callback(error, destination)
    );
  },
  filename: (req, file, callback) => {
    const extensionByMimeType = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/avif': '.avif',
      'image/svg+xml': '.svg',
      'application/pdf': '.pdf',
    };
    const safeExtension =
      extensionByMimeType[file.mimetype] ||
      path.extname(file.originalname).toLowerCase();
    callback(null, `${randomUUID()}${safeExtension}`);
  },
});

// ── Attach public URLs to locally saved files ───────────────────────────
const attachUrls = (req, res, next) => {
  const addUrl = (file) => {
    if (!file) return null;
    const relativePath = path.relative(UPLOAD_ROOT, file.path);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return new Error('Uploaded file is outside the local uploads folder');
    }
    const publicPath = `/uploads/${relativePath
      .split(path.sep)
      .map((segment) => encodeURIComponent(segment))
      .join('/')}`;
    const url = `${req.protocol}://${req.get('host')}${publicPath}`;
    const publicId = relativePath.split(path.sep).join('/');

    file.url = url;
    file.location = url;
    file.secure_url = url;
    file.public_id = publicId;
    return null;
  };

  let error = req.file ? addUrl(req.file) : null;
  if (Array.isArray(req.files)) {
    for (const file of req.files) {
      error = error || addUrl(file);
    }
  } else if (req.files && typeof req.files === 'object') {
    for (const files of Object.values(req.files)) {
      if (!Array.isArray(files)) continue;
      for (const file of files) {
        error = error || addUrl(file);
      }
    }
  }
  next(error || undefined);
};

// Compose: multer → attach URLs → next()
const withStorage = (multerMiddleware) => (req, res, next) => {
  multerMiddleware(req, res, (err) => {
    if (err) return next(err);
    return attachUrls(req, res, next);
  });
};

// ── Multer instances ────────────────────────────────────────────────────
const single = multer({
  storage: localStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 1,
  },
  fileFilter,
});

const multiple = multer({
  storage: localStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB each
    files: 10,
  },
  fileFilter,
});

// ── Exported middlewares ────────────────────────────────────────────────

// Products — field name 'image'
const uploadSingle = withStorage(single.single('image'));

// Avatars — field name 'avatar'
const uploadAvatar = withStorage(single.single('avatar'));

// Multiple documents
const uploadDocuments = withStorage(multiple.array('documents', 5));

// Multiple images
const uploadMultiple = withStorage(multiple.array('images', 5));

// Backward-compatible "upload" object
const upload = {
  single: (field) => withStorage(single.single(field)),
  array: (field, max) => withStorage(multiple.array(field, max)),
  fields: (fields) => withStorage(multiple.fields(fields)),
  any: () => withStorage(multiple.any()),
};

// ── Error-handling wrapper ──────────────────────────────────────────────
const handleUpload = (uploadMiddleware) => {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: 'File too large. Maximum size is 10MB.',
            code: 'FILE_TOO_LARGE',
          });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            error: 'Unexpected field name in the request.',
            code: 'UNEXPECTED_FIELD',
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            error: 'Too many files.',
            code: 'TOO_MANY_FILES',
          });
        }
        if (err.message && err.message.includes('Invalid file type')) {
          return res.status(400).json({
            error: err.message,
            code: 'INVALID_FILE_TYPE',
          });
        }
        return res.status(400).json({
          error: err.message || 'Upload failed',
          code: 'UPLOAD_FAILED',
        });
      }
      next();
    });
  };
};

module.exports = {
  upload,
  uploadSingle,
  uploadAvatar,
  uploadDocuments,
  uploadMultiple,
  handleUpload,
};