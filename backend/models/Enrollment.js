const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  courseId: { type: String, required: true },                          // References Course.courseId
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  requestedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

enrollmentSchema.index({ course: 1, student: 1 }, { unique: true });
enrollmentSchema.index({ courseId: 1, status: 1 });
enrollmentSchema.index({ student: 1 });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
