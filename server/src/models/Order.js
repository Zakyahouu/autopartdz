const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    trackingCode: {
      type: String,
      required: [true, 'Tracking code is required'],
      unique: true,
      index: true,
    },
    orderType: {
      type: String,
      enum: ['new', 'correction'],
      required: [true, 'Order type is required'],
    },
    // Populated only for correction orders — points to the original order
    linkedOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    isCorrection: {
      type: Boolean,
      default: false,
    },
    parentOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    status: {
      type: String,
      enum: [
        'pending',
        'confirmed',
        'in_progress',
        'ready_for_dispatch',
        'packaged',
        'sent_to_client',
        'delivered',
        'completed',
        'rejected',
      ],
      default: 'pending',
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    // Client details
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^\S+@\S+\.\S+$/.test(v);
        },
        message: 'Invalid email address format',
      },
    },
    passportNumber: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
    wilaya: {
      type: String,
      required: [true, 'Wilaya is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    importAgency: {
      type: String,
      default: '',
      trim: true,
    },
    note: {
      type: String,
      default: '',
    },
    vin: {
      type: String,
      required: [true, 'VIN is required'],
      trim: true,
    },
    carModel: {
      type: String,
      default: '',
      trim: true,
    },
    carCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CarCategory',
      default: null,
    },
    // Passport scan stored in the File collection
    passportFileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
      default: null,
    },
    // null if submitted via the public form (no authenticated user)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
