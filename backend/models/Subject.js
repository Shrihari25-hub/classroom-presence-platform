const mongoose = require('mongoose');
const crypto = require('crypto');

const subjectSchema = new mongoose.Schema({
  subjectName: { type: String, required: true, trim: true },
  subjectCode: { type: String, trim: true },
  courseId: { type: String, required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  inviteToken: { type: String, default: () => crypto.randomBytes(16).toString('hex') },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

subjectSchema.index({ course: 1, teacher: 1 });
subjectSchema.index({ courseId: 1 });
subjectSchema.index({ inviteToken: 1 });

module.exports = mongoose.model('Subject', subjectSchema);
