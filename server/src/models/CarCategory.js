const mongoose = require('mongoose');

const carCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    // Document types flagged as required by default for this category.
    // Pre-populates order lines when a client selects this category —
    // client can still add or remove any document.
    requiredDocumentTypes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DocumentType',
      },
    ],
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CarCategory', carCategorySchema);
