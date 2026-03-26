const crypto = require('crypto');
const Session = require('../models/Session');
const Subject = require('../models/Subject');
const Attendance = require('../models/Attendance');
const SubjectEnrollment = require('../models/SubjectEnrollment');

const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes

/**
 * For a session that is ending, find every enrolled student who has no
 * attendance record and insert one with status = 'absent'.
 */
async function autoMarkAbsent(session) {
  const enrollments = await SubjectEnrollment.find({ subject: session.subject });
  const markedStudentIds = await Attendance.distinct('student', { session: session._id });
  const markedSet = new Set(markedStudentIds.map(id => id.toString()));

  const absentDocs = enrollments
    .filter(e => !markedSet.has(e.student.toString()))
    .map(e => ({
      student: e.student,
      subject: session.subject,
      session: session._id,
      sessionId: session._id,
      courseId: session.courseId,
      method: 'manual',
      status: 'absent',
      overrideNote: 'Auto-marked absent on session end',
      timestamp: new Date()
    }));

  if (absentDocs.length > 0) {
    await Attendance.insertMany(absentDocs, { ordered: false });
  }
}

exports.startSession = async (req, res) => {
  try {
    const { subjectId, mode } = req.body;
    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });
    if (subject.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const activeSession = await Session.findOne({ subject: subjectId, status: 'active' });
    if (activeSession) return res.status(400).json({ message: 'A session is already active' });

    const now = new Date();
    const scheduledEnd = new Date(now.getTime() + SESSION_DURATION_MS);
    const qrCode = mode === 'qr' ? crypto.randomBytes(16).toString('hex') : null;

    const session = await Session.create({
      subject: subjectId,
      subjectId: subjectId,
      courseId: subject.courseId,
      teacher: req.user._id,
      startTime: now,
      scheduledEnd,
      mode: mode || 'face',
      qrCode
    });

    await session.populate('subject', 'subjectName subjectCode');
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.endSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (session.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (session.status === 'ended') return res.status(400).json({ message: 'Session already ended' });

    // Auto-mark all enrolled-but-unmarked students as absent
    await autoMarkAbsent(session);

    const now = new Date();
    const editableUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    session.status = 'ended';
    session.endTime = now;
    session.lockedAt = now;
    session.editableUntil = editableUntil;
    await session.save();

    res.json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getActiveSessions = async (req, res) => {
  try {
    const subjects = await Subject.find({ teacher: req.user._id });
    const subjectIds = subjects.map(s => s._id);

    // Auto-end expired sessions and mark unmarked students absent
    const expiredSessions = await Session.find({
      subject: { $in: subjectIds },
      status: 'active',
      scheduledEnd: { $lte: new Date() }
    });
    for (const sess of expiredSessions) {
      await autoMarkAbsent(sess);
      const now = new Date();
      sess.status = 'ended';
      sess.endTime = now;
      sess.lockedAt = now;
      sess.editableUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      await sess.save();
    }

    const sessions = await Session.find({
      subject: { $in: subjectIds },
      status: 'active'
    }).populate('subject', 'subjectName courseId');

    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// FIX 2: Return sessions enriched with present/absent/percentage stats
exports.getSessionsBySubject = async (req, res) => {
  try {
    const { subjectId } = req.params;

    // Total students enrolled in this subject
    const totalEnrolled = await SubjectEnrollment.countDocuments({ subject: subjectId });

    const sessions = await Session.find({ subject: subjectId })
      .sort('-startTime')
      .limit(50)
      .lean(); // .lean() so we can freely add extra fields

    // For each session, count present + late as "present", absent separately
    const enriched = await Promise.all(sessions.map(async (session) => {
      const [presentCount, lateCount, absentCount] = await Promise.all([
        Attendance.countDocuments({ session: session._id, status: 'present' }),
        Attendance.countDocuments({ session: session._id, status: 'late' }),
        Attendance.countDocuments({ session: session._id, status: 'absent' })
      ]);
      const presentTotal = presentCount + lateCount; // late counts as present
      const attendancePercentage = totalEnrolled > 0
        ? parseFloat(((presentTotal / totalEnrolled) * 100).toFixed(1))
        : 0;

      return {
        ...session,
        presentCount: presentTotal,
        lateCount,
        absentCount,
        attendancePercentage,
        totalEnrolled
      };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getSession = async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId)
      .populate('subject', 'subjectName subjectCode courseId')
      .populate('teacher', 'name');
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
