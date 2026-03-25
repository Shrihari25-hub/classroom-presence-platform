const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, required: true },
  courseId: { type: String, required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  scheduledEnd: { type: Date },   // Auto-end after 30 mins
  status: { type: String, enum: ['active', 'ended'], default: 'active' },
  mode: { type: String, enum: ['face', 'qr', 'manual'], default: 'face' },
  qrCode: { type: String },      // QR token for fallback
  duplicateIgnoredCount: { type: Number, default: 0 },
  unknownFaceCount: { type: Number, default: 0 },
  lockedAt: { type: Date },      // Set when session ends
  editableUntil: { type: Date }  // lockedAt + 7 days
}, { timestamps: true });

sessionSchema.index({ subject: 1, status: 1 });
sessionSchema.index({ subjectId: 1 });
sessionSchema.index({ courseId: 1 });
sessionSchema.index({ teacher: 1 });

module.exports = mongoose.model('Session', sessionSchema);
