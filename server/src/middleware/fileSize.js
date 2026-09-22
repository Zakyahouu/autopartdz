/**
 * fileSize.js — Multer-based middleware enforcing a 12 MB per-file hard limit.
 *
 * Deliberate design: files are stored as binary in MongoDB. MongoDB's BSON
 * document limit is 16 MB; 12 MB gives comfortable headroom for encoding
 * overhead and other document fields.
 *
 * Usage (attach to any route that accepts file uploads in later phases):
 *
 *   const { uploadSingle, uploadMultiple } = require('../middleware/fileSize');
 *   router.post('/upload', uploadSingle('file'), handler);
 *   router.post('/upload-many', uploadMultiple('files', 5), handler);
 *
 * If a file exceeds the limit, multer emits a LIMIT_FILE_SIZE error which
 * this module's error handler converts to a clear 413 response.
 */

const multer = require('multer');

const MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024; // 12 MB

// Store files in memory as Buffer — persisted to MongoDB by the route handler
const storage = multer.memoryStorage();

const multerInstance = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
});

/**
 * Single-file upload middleware factory.
 * @param {string} fieldName - The form field name for the file input.
 */
const uploadSingle = (fieldName) => [
  multerInstance.single(fieldName),
  fileSizeErrorHandler,
];

/**
 * Multi-file upload middleware factory.
 * @param {string} fieldName - The form field name for the file input.
 * @param {number} maxCount  - Maximum number of files allowed.
 */
const uploadMultiple = (fieldName, maxCount = 10) => [
  multerInstance.array(fieldName, maxCount),
  fileSizeErrorHandler,
];

/**
 * Error handler specifically for multer size-limit violations.
 * Must be placed immediately after the multer middleware in the stack.
 */
function fileSizeErrorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: `File too large. Maximum allowed size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
    });
  }
  // Pass other errors (wrong field name, non-multer errors, etc.) downstream
  next(err);
}

module.exports = { uploadSingle, uploadMultiple, MAX_FILE_SIZE_BYTES };
