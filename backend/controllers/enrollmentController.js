const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');

// Student: request to join course by courseId
exports.requestEnrollment = async (req, res) => {
  try {
    const { courseId } = req.body;
    const course = await Course.findOne({ courseId });
    if (!course) return res.status(404).json({ message: 'Course not found. Check the Course ID.' });

    const existing = await Enrollment.findOne({ course: course._id, student: req.user._id });
    if (existing) {
      return res.status(400).json({ message: `Enrollment already ${existing.status}` });
    }

    const enrollment = await Enrollment.create({
      courseId,
      course: course._id,
      student: req.user._id
    });
    await enrollment.populate('course', 'courseName courseId');
    res.status(201).json(enrollment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Teacher: get pending enrollment requests for a course
exports.getPendingRequests = async (req, res) => {
  try {
    const { courseId } = req.params;
    const requests = await Enrollment.find({ courseId, status: 'pending' })
      .populate('student', 'name email')
      .sort('-requestedAt');
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Teacher: approve or reject enrollment
exports.reviewEnrollment = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { action } = req.body; // 'approve' | 'reject'

    const enrollment = await Enrollment.findById(enrollmentId).populate('course');
    if (!enrollment) return res.status(404).json({ message: 'Enrollment not found' });

    // Verify teacher has access to this course
    const course = enrollment.course;
    const isOwner = course.owner.toString() === req.user._id.toString();
    const isCoTeacher = course.coTeachers.some(t => t.toString() === req.user._id.toString());
    if (!isOwner && !isCoTeacher) {
      return res.status(403).json({ message: 'Not authorized for this course' });
    }

    enrollment.status = action === 'approve' ? 'approved' : 'rejected';
    enrollment.reviewedAt = new Date();
    enrollment.reviewedBy = req.user._id;
    await enrollment.save();

    res.json(enrollment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Teacher: get approved students list for a course
exports.getCourseStudents = async (req, res) => {
  try {
    const { courseId } = req.params;
    const enrollments = await Enrollment.find({ courseId, status: 'approved' })
      .populate('student', 'name email faceRegistered');
    res.json(enrollments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Student: get own enrollments
exports.getMyEnrollments = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ student: req.user._id })
      .populate('course', 'courseName courseId description');
    res.json(enrollments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
