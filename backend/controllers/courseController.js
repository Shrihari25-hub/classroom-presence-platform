const Course = require('../models/Course');
const User = require('../models/User');

exports.createCourse = async (req, res) => {
  try {
    const { courseName, courseId, description } = req.body;
    if (!courseName || !courseId) return res.status(400).json({ message: 'courseName and courseId required' });

    const existing = await Course.findOne({ courseId });
    if (existing) return res.status(400).json({ message: 'Course ID already taken' });

    const course = await Course.create({
      courseName,
      courseId,
      description,
      owner: req.user._id
    });

    await course.populate('owner', 'name email');
    res.status(201).json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMyCourses = async (req, res) => {
  try {
    const courses = await Course.find({
      $or: [{ owner: req.user._id }, { coTeachers: req.user._id }]
    }).populate('owner', 'name email').populate('coTeachers', 'name email');
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findOne({ courseId })
      .populate('owner', 'name email')
      .populate('coTeachers', 'name email');
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateCourse = async (req, res) => {
  try {
    const { courseName, description } = req.body;
    const course = req.course; // set by middleware

    // Only update allowed fields (not courseId)
    if (courseName) course.courseName = courseName;
    if (description !== undefined) course.description = description;
    await course.save();
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    if (!req.isOwner) return res.status(403).json({ message: 'Only course owner can delete' });
    await Course.findByIdAndDelete(req.course._id);
    res.json({ message: 'Course deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.addCoTeacher = async (req, res) => {
  try {
    if (!req.isOwner) return res.status(403).json({ message: 'Only owner can add co-teachers' });
    const { email } = req.body;
    const teacher = await User.findOne({ email, role: 'teacher' });
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

    const course = req.course;
    if (course.owner.toString() === teacher._id.toString()) {
      return res.status(400).json({ message: 'Cannot add owner as co-teacher' });
    }
    if (course.coTeachers.includes(teacher._id)) {
      return res.status(400).json({ message: 'Already a co-teacher' });
    }

    course.coTeachers.push(teacher._id);
    await course.save();
    await course.populate('coTeachers', 'name email');
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.removeCoTeacher = async (req, res) => {
  try {
    if (!req.isOwner) return res.status(403).json({ message: 'Only owner can remove co-teachers' });
    const { teacherId } = req.params;
    req.course.coTeachers = req.course.coTeachers.filter(t => t.toString() !== teacherId);
    await req.course.save();
    res.json({ message: 'Co-teacher removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
