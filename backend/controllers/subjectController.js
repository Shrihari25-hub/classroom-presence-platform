const Subject = require('../models/Subject');
const Course = require('../models/Course');

exports.createSubject = async (req, res) => {
  try {
    const { subjectName, subjectCode, courseId } = req.body;
    if (!subjectName || !courseId) return res.status(400).json({ message: 'subjectName and courseId required' });

    const course = await Course.findOne({ courseId });
    if (!course) return res.status(404).json({ message: 'Course not found' });

    // Teacher must be owner or co-teacher
    const isOwner = course.owner.toString() === req.user._id.toString();
    const isCoTeacher = course.coTeachers.some(t => t.toString() === req.user._id.toString());
    if (!isOwner && !isCoTeacher) {
      return res.status(403).json({ message: 'Not a teacher of this course' });
    }

    const subject = await Subject.create({
      subjectName, subjectCode, courseId,
      course: course._id,
      teacher: req.user._id
    });

    await subject.populate('teacher', 'name email');
    await subject.populate('course', 'courseName courseId');
    res.status(201).json(subject);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getSubjectsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const subjects = await Subject.find({ courseId, isActive: true })
      .populate('teacher', 'name email')
      .populate('course', 'courseName');
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMySubjects = async (req, res) => {
  try {
    const subjects = await Subject.find({ teacher: req.user._id, isActive: true })
      .populate('course', 'courseName courseId');
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.subjectId)
      .populate('teacher', 'name email')
      .populate('course', 'courseName courseId');
    if (!subject) return res.status(404).json({ message: 'Subject not found' });
    res.json(subject);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.subjectId);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });
    if (subject.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { subjectName, subjectCode } = req.body;
    if (subjectName) subject.subjectName = subjectName;
    if (subjectCode !== undefined) subject.subjectCode = subjectCode;
    await subject.save();
    res.json(subject);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.subjectId);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });
    if (subject.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    subject.isActive = false;
    await subject.save();
    res.json({ message: 'Subject deactivated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.regenerateInviteToken = async (req, res) => {
  try {
    const crypto = require('crypto');
    const subject = await Subject.findById(req.params.subjectId);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });
    if (subject.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    subject.inviteToken = crypto.randomBytes(16).toString('hex');
    await subject.save();
    res.json({ inviteToken: subject.inviteToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
