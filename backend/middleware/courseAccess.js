const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');

// Check if teacher owns or co-teaches a course
const courseTeacherAccess = async (req, res, next) => {
  try {
    const courseId = req.params.courseId || req.body.courseId || req.query.courseId;
    const course = await Course.findOne({ courseId });
    if (!course) return res.status(404).json({ message: 'Course not found' });

    const isOwner = course.owner.toString() === req.user._id.toString();
    const isCoTeacher = course.coTeachers.some(t => t.toString() === req.user._id.toString());

    if (!isOwner && !isCoTeacher) {
      return res.status(403).json({ message: 'Access denied: Not a teacher of this course' });
    }

    req.course = course;
    req.isOwner = isOwner;
    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Check if student is approved in course
const courseStudentAccess = async (req, res, next) => {
  try {
    const courseId = req.params.courseId || req.query.courseId;
    const enrollment = await Enrollment.findOne({
      courseId,
      student: req.user._id,
      status: 'approved'
    });
    if (!enrollment) {
      return res.status(403).json({ message: 'Access denied: Not enrolled in this course' });
    }
    req.enrollment = enrollment;
    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { courseTeacherAccess, courseStudentAccess };
