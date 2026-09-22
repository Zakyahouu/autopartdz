const mongoose = require('mongoose');

const pricingTierSchema = new mongoose.Schema(
  {
    clientPrice: { type: Number, default: null },
    costPrice: { type: Number, default: null },
  },
  { _id: false }
);

const documentTypeSchema = new mongoose.Schema(
  {
    shortName: {
      type: String,
      required: [true, 'Short name is required'],
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    // Optional but unique when present.
    // The sparse index (defined below) means documents with no code field
    // do not conflict — only documents that truly have a code value are indexed.
    // Routes must strip this field entirely (not set null/"") when not provided.
    code: {
      type: String,
      uppercase: true,
      trim: true,
    },
    category: {
      type: String,
      default: '',
    },
    originLanguage: {
      type: String,
      default: '',
    },
    // Binary file stored in the File collection
    exampleImageFileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
      default: null,
    },
    hasTranslation: {
      type: Boolean,
      default: false,
    },
    pricing: {
      // Always required
      originalOnly: { type: pricingTierSchema, default: () => ({}) },
      // Only meaningful when hasTranslation is true — not hard-enforced at schema level
      originalPlusTranslation: { type: pricingTierSchema, default: () => ({}) },
      translationOnly: { type: pricingTierSchema, default: () => ({}) },
    },
    defaultSource: {
      type: String,
      enum: ['local', 'china'],
      required: [true, 'Default source is required'],
    },
    estimatedTurnaroundDays: {
      type: Number,
      default: null,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    slug: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Sparse unique index: only indexes documents where `code` actually exists.
// Multiple documents with no code field (null/undefined/absent) do not conflict.
documentTypeSchema.index({ code: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('DocumentType', documentTypeSchema);
