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
    // Display / reporting only — no gate logic reads this field
    source: {
      type: String,
      enum: ['local', 'china', null],
      default: null,
    },
    // Optional delegate — any active user can be assigned regardless of source
    assignedAssociateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Unified two-step pipeline: needed → attached → ready
    // Downstream fulfillment statuses (packaged/sent_to_client/delivered)
    // are written by order-level routes (/package, /dispatch, /deliver).
    status: {
      type: String,
      enum: [
        'needed',
        'attached',
        'ready',
        'packaged',
        'sent_to_client',
        'delivered',
      ],
      default: 'needed',
    },
    // Optional tracking code — nullable for all lines regardless of source
    trackingCode: {
      type: String,
      default: null,
    },
    // Set on lock(approve=false); cleared on the next successful attach
    lastRejectionNote: {
      type: String,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    // Populated only on lines that belong to a Correction order
    correctionReason: {
      type: String,
      default: null,
    },
    // Files uploaded by associate or Admin as proof
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
