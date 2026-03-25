const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  courseId: { type: String, required: true },
  status: { type: String, enum: ['present', 'absent', 'late'], default: 'present' },
  method: { type: String, enum: ['face', 'qr', 'manual'], required: true },
  confidenceScore: { type: Number, min: 0, max: 1 },   // Face recognition confidence
  overrideFlag: { type: Boolean, default: false },        // Teacher manually overrode
  overrideNote: { type: String },
  timestamp: { type: Date, default: Date.now },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }   // Teacher if manual
}, { timestamps: true });

attendanceSchema.index({ session: 1, student: 1 }, { unique: true });  // Prevent duplicates
attendanceSchema.index({ subject: 1, student: 1 });
attendanceSchema.index({ sessionId: 1 });
attendanceSchema.index({ courseId: 1 });
attendanceSchema.index({ student: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
