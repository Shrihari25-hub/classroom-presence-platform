const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  courseName: { type: String, required: true, trim: true },
  courseId: { type: String, required: true, unique: true, trim: true },  // Manual unique ID
  description: { type: String, trim: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  coTeachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

courseSchema.index({ courseId: 1 }, { unique: true });
courseSchema.index({ owner: 1 });

module.exports = mongoose.model('Course', courseSchema);
