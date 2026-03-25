const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  courseId: { type: String, required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dayOfWeek: { type: Number, min: 0, max: 6, required: true },  // 0=Sun, 1=Mon...6=Sat
  startTime: { type: String, required: true },  // "HH:MM" format
  endTime: { type: String, required: true },
  room: { type: String },
  isCancelled: { type: Boolean, default: false },
  cancelledDate: { type: Date },   // Specific date cancellation (null = recurring cancel)
  cancelNote: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

timetableSchema.index({ courseId: 1 });
timetableSchema.index({ subject: 1 });
timetableSchema.index({ teacher: 1 });

module.exports = mongoose.model('Timetable', timetableSchema);
