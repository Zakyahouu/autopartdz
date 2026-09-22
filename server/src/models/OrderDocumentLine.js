const mongoose = require('mongoose');

const activityLogEntrySchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    actorRole: {
      type: String,
    },
    action: {
      type: String,
      required: true,
    },
    note: {
      type: String,
      default: '',
    },
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
      default: null,
    },
  },
  { _id: true }
);

const orderDocumentLineSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order ID is required'],
    },
    documentTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DocumentType',
      required: [true, 'Document type is required'],
    },
    translationMode: {
      type: String,
      enum: ['original_only', 'original_plus_translation', 'translation_only'],
      required: [true, 'Translation mode is required'],
    },
    // Snapshot of prices at time of order confirmation — preserved even
    // if the DocumentType catalog prices change later
    clientPrice: {
      type: Number,
      required: [true, 'Client price is required'],
    },
    costPrice: {
      type: Number,
      required: [true, 'Cost price is required'],
    },
    source: {
      type: String,
      enum: ['local', 'china'],
      required: [true, 'Source is required'],
    },
    // Only set for China-sourced lines
    assignedChinaAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: [
        'needed',
        'sent_to_china',
        'shipped',
        'pending_admin_review',
        'needs_correction',
        'printed',
        'arrived_at_office',
        'packaged',
        'sent_to_client',
        'delivered',
      ],
      default: 'needed',
    },
    // Visibility flag for overdue SHIPPED lines — not a full status change
    isDelayed: {
      type: Boolean,
      default: false,
    },
    // Required to advance past SHIPPED status for China-sourced lines
    shippingTrackingCode: {
      type: String,
      default: null,
    },
    // Populated only on lines that belong to a Correction order
    correctionReason: {
      type: String,
      default: null,
    },
    // Files uploaded by China associate or Admin as proof
    uploadedFiles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'File',
      },
    ],
    activityLog: [activityLogEntrySchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('OrderDocumentLine', orderDocumentLineSchema);
