const mongoose = require('mongoose');

const subjectEnrollmentSchema = new mongoose.Schema({
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: String, required: true },
  joinedAt: { type: Date, default: Date.now }
}, { timestamps: true });

subjectEnrollmentSchema.index({ subject: 1, student: 1 }, { unique: true });
subjectEnrollmentSchema.index({ subject: 1 });
subjectEnrollmentSchema.index({ student: 1 });
subjectEnrollmentSchema.index({ courseId: 1 });

module.exports = mongoose.model('SubjectEnrollment', subjectEnrollmentSchema);
