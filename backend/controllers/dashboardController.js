const Course = require('../models/Course');
const Subject = require('../models/Subject');
const Session = require('../models/Session');
const Enrollment = require('../models/Enrollment');
const SubjectEnrollment = require('../models/SubjectEnrollment');
const Timetable = require('../models/Timetable');
const Attendance = require('../models/Attendance');

exports.getTeacherDashboard = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const today = new Date();
    const todayDay = today.getDay();

    const [courses, subjects, activeSessions, pendingEnrollments] = await Promise.all([
      Course.countDocuments({ $or: [{ owner: teacherId }, { coTeachers: teacherId }] }),
      Subject.countDocuments({ teacher: teacherId, isActive: true }),
      Session.find({ teacher: teacherId, status: 'active' })
        .populate('subject', 'subjectName courseId'),
      Enrollment.countDocuments({ status: 'pending' })
    ]);

    const todaysClasses = await Timetable.find({
      teacher: teacherId,
      dayOfWeek: todayDay,
      isActive: true,
      isCancelled: false
    }).populate('subject', 'subjectName subjectCode');

    res.json({
      totalCourses: courses,
      totalSubjects: subjects,
      activeSessions,
      todaysClasses,
      pendingEnrollments
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getStudentDashboard = async (req, res) => {
  try {
    const studentId = req.user._id;
    const today = new Date();
    const todayDay = today.getDay();

    const [courseEnrollments, subjectEnrollments] = await Promise.all([
      Enrollment.find({ student: studentId, status: 'approved' }),
      SubjectEnrollment.find({ student: studentId })
    ]);

    const subjectIds = subjectEnrollments.map(e => e.subject);

    const [todaysClasses, attendanceSummary] = await Promise.all([
      Timetable.find({
        subject: { $in: subjectIds },
        dayOfWeek: todayDay,
        isActive: true,
        isCancelled: false
      }).populate('subject', 'subjectName subjectCode').populate('teacher', 'name'),

      // Per-subject attendance percentage for this student.
      // Percent = (present + late) / totalMarked * 100
      Attendance.aggregate([
        { $match: { student: studentId } },
        {
          $group: {
            _id: '$subject',
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
            late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
            absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } }
          }
        },
        {
          $addFields: {
            attended: { $add: ['$present', '$late'] },
            percentage: {
              $cond: [
                { $gt: ['$total', 0] },
                { $multiply: [{ $divide: [{ $add: ['$present', '$late'] }, '$total'] }, 100] },
                0
              ]
            }
          }
        },
        { $lookup: { from: 'subjects', localField: '_id', foreignField: '_id', as: 'subject' } },
        { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            subjectId: '$_id',
            subjectName: '$subject.subjectName',
            subjectCode: '$subject.subjectCode',
            total: 1,
            present: 1,
            late: 1,
            absent: 1,
            attended: 1,
            percentage: { $round: ['$percentage', 0] }
          }
        },
        { $sort: { subjectName: 1 } }
      ])
    ]);

    res.json({
      totalCourses: courseEnrollments.length,
      totalSubjects: subjectEnrollments.length,
      todaysClasses,
      attendanceSummary
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
