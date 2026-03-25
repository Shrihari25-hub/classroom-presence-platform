const Timetable = require('../models/Timetable');
const Subject = require('../models/Subject');
const SubjectEnrollment = require('../models/SubjectEnrollment');

exports.createSchedule = async (req, res) => {
  try {
    const { subjectId, dayOfWeek, startTime, endTime, room } = req.body;
    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });
    if (subject.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const schedule = await Timetable.create({
      subject: subjectId,
      courseId: subject.courseId,
      teacher: req.user._id,
      dayOfWeek, startTime, endTime, room
    });

    await schedule.populate('subject', 'subjectName subjectCode');
    res.status(201).json(schedule);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const schedule = await Timetable.findById(scheduleId);
    if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
    if (schedule.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { dayOfWeek, startTime, endTime, room } = req.body;
    if (dayOfWeek !== undefined) schedule.dayOfWeek = dayOfWeek;
    if (startTime) schedule.startTime = startTime;
    if (endTime) schedule.endTime = endTime;
    if (room !== undefined) schedule.room = room;
    await schedule.save();
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.cancelClass = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { cancelNote, cancelDate } = req.body;
    const schedule = await Timetable.findById(scheduleId);
    if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
    if (schedule.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    schedule.isCancelled = true;
    schedule.cancelledDate = cancelDate ? new Date(cancelDate) : null;
    schedule.cancelNote = cancelNote;
    await schedule.save();
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteSchedule = async (req, res) => {
  try {
    const schedule = await Timetable.findById(req.params.scheduleId);
    if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
    if (schedule.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    schedule.isActive = false;
    await schedule.save();
    res.json({ message: 'Schedule removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getTimetableByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const schedules = await Timetable.find({ courseId, isActive: true })
      .populate('subject', 'subjectName subjectCode')
      .populate('teacher', 'name')
      .sort({ dayOfWeek: 1, startTime: 1 });
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Student: get timetable for all enrolled subjects
exports.getMyTimetable = async (req, res) => {
  try {
    const enrollments = await SubjectEnrollment.find({ student: req.user._id });
    const subjectIds = enrollments.map(e => e.subject);
    const schedules = await Timetable.find({
      subject: { $in: subjectIds },
      isActive: true
    })
      .populate('subject', 'subjectName subjectCode courseId')
      .populate('teacher', 'name')
      .sort({ dayOfWeek: 1, startTime: 1 });
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
