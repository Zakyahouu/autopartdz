const mongoose = require('mongoose');

/**
 * File — stores binary file data directly in MongoDB.
 *
 * Deliberate design choice: no external object storage. Files are stored
 * as Buffer (BSON Binary) on this document. A 12 MB hard limit is
 * enforced at the API layer (see middleware/fileSize.js) to stay safely
 * under MongoDB's 16 MB per-document BSON limit.
 */
const fileSchema = new mongoose.Schema({
  data: {
    type: Buffer,
    required: [true, 'File data is required'],
  },
  contentType: {
    type: String,
    required: [true, 'Content type is required'],
  },
  filename: {
    type: String,
    required: [true, 'Filename is required'],
  },
  size: {
    type: Number,
    required: [true, 'File size is required'],
  },
  // null when the file is uploaded via the public (unauthenticated) form
  uploadedByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('File', fileSchema);
