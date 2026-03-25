const Subject = require('../models/Subject');
const SubjectEnrollment = require('../models/SubjectEnrollment');
const Enrollment = require('../models/Enrollment');

// Student: join subject via invite token (must be course-approved)
exports.joinSubject = async (req, res) => {
  try {
    const { inviteToken } = req.body;
    const subject = await Subject.findOne({ inviteToken, isActive: true });
    if (!subject) return res.status(404).json({ message: 'Invalid invite link' });

    // Student must be approved in the course
    const courseEnrollment = await Enrollment.findOne({
      courseId: subject.courseId,
      student: req.user._id,
      status: 'approved'
    });
    if (!courseEnrollment) {
      return res.status(403).json({ message: 'You must be enrolled in the course first' });
    }

    const existing = await SubjectEnrollment.findOne({ subject: subject._id, student: req.user._id });
    if (existing) return res.status(400).json({ message: 'Already enrolled in this subject' });

    const enrollment = await SubjectEnrollment.create({
      subject: subject._id,
      student: req.user._id,
      courseId: subject.courseId
    });

    await enrollment.populate('subject', 'subjectName subjectCode');
    res.status(201).json(enrollment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Teacher: get students enrolled in subject
exports.getSubjectStudents = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });
    if (subject.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const enrollments = await SubjectEnrollment.find({ subject: subjectId })
      .populate('student', 'name email faceRegistered');
    res.json(enrollments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Student: get own subject enrollments
exports.getMySubjectEnrollments = async (req, res) => {
  try {
    const enrollments = await SubjectEnrollment.find({ student: req.user._id })
      .populate('subject', 'subjectName subjectCode courseId');
    res.json(enrollments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Teacher: remove student from subject
exports.removeStudentFromSubject = async (req, res) => {
  try {
    const { subjectId, studentId } = req.params;
    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });
    if (subject.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await SubjectEnrollment.findOneAndDelete({ subject: subjectId, student: studentId });
    res.json({ message: 'Student removed from subject' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
