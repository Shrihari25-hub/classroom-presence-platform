const Attendance = require('../models/Attendance');
const Session = require('../models/Session');
const Subject = require('../models/Subject');
const User = require('../models/User');
const SubjectEnrollment = require('../models/SubjectEnrollment');

// ─── Student: mark via face recognition ──────────────────────────────────────
exports.markAttendanceFace = async (req, res) => {
  try {
    const { sessionId, embedding, confidenceScore } = req.body;

    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (session.status !== 'active') return res.status(400).json({ message: 'Session is not active' });

    if (new Date() > session.scheduledEnd) {
      session.status = 'ended';
      session.endTime = new Date();
      await session.save();
      return res.status(400).json({ message: 'Session has expired' });
    }

    const enrolled = await SubjectEnrollment.findOne({
      subject: session.subject,
      student: req.user._id
    });
    if (!enrolled) return res.status(403).json({ message: 'Not enrolled in this subject' });

    const existing = await Attendance.findOne({ session: sessionId, student: req.user._id });
    if (existing) {
      session.duplicateIgnoredCount++;
      await session.save();
      return res.status(400).json({ message: 'Attendance already marked', duplicate: true });
    }

    // FIX 1: Save the actual confidence score from face recognition
    const attendance = await Attendance.create({
      student: req.user._id,
      subject: session.subject,
      session: sessionId,
      sessionId: sessionId,
      courseId: session.courseId,
      method: 'face',
      confidenceScore: typeof confidenceScore === 'number' ? confidenceScore : null,
      status: 'present',
      timestamp: new Date()
    });

    res.status(201).json(attendance);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Student: mark via QR code ───────────────────────────────────────────────
exports.markAttendanceQR = async (req, res) => {
  try {
    const { sessionId, qrToken } = req.body;
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (session.status !== 'active') return res.status(400).json({ message: 'Session is not active' });
    if (session.qrCode !== qrToken) return res.status(400).json({ message: 'Invalid QR token' });

    const enrolled = await SubjectEnrollment.findOne({
      subject: session.subject,
      student: req.user._id
    });
    if (!enrolled) return res.status(403).json({ message: 'Not enrolled in this subject' });

    const existing = await Attendance.findOne({ session: sessionId, student: req.user._id });
    if (existing) {
      session.duplicateIgnoredCount++;
      await session.save();
      return res.status(400).json({ message: 'Attendance already marked', duplicate: true });
    }

    const attendance = await Attendance.create({
      student: req.user._id,
      subject: session.subject,
      session: sessionId,
      sessionId: sessionId,
      courseId: session.courseId,
      method: 'qr',
      confidenceScore: null,   // QR has no confidence score
      status: 'present',
      timestamp: new Date()
    });

    res.status(201).json(attendance);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Teacher: manual mark (also used by face recognition on teacher side) ────
exports.markAttendanceManual = async (req, res) => {
  try {
    const { sessionId, studentId, status, overrideNote } = req.body;
    const session = await Session.findById(sessionId).populate('subject');
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (session.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const isEditable = session.status === 'active' ||
      (session.editableUntil && new Date() < session.editableUntil);
    if (!isEditable) return res.status(400).json({ message: 'Session is permanently locked' });

    // FIX 1: Parse confidence from overrideNote when coming from face recognition
    // overrideNote format: "Face recognition — 87.3% confidence"
    let confidenceScore = null;
    let method = 'manual';
    if (overrideNote && overrideNote.includes('Face recognition')) {
      method = 'face';
      const match = overrideNote.match(/([\d.]+)%/);
      if (match) {
        confidenceScore = parseFloat(match[1]) / 100; // store as 0-1
      }
    }

    let attendance = await Attendance.findOne({ session: sessionId, student: studentId });
    if (attendance) {
      attendance.status = status || 'present';
      attendance.overrideFlag = false;
      attendance.overrideNote = overrideNote;
      attendance.markedBy = req.user._id;
      // Only update method/confidence if this is a face scan override
      if (method === 'face' && confidenceScore !== null) {
        attendance.method = 'face';
        attendance.confidenceScore = confidenceScore;
      } else if (attendance.method !== 'face') {
        // Keep existing method if already face; otherwise set manual
        attendance.method = 'manual';
      }
      await attendance.save();
    } else {
      attendance = await Attendance.create({
        student: studentId,
        subject: session.subject._id,
        session: sessionId,
        sessionId: sessionId,
        courseId: session.courseId,
        method,
        confidenceScore,
        status: status || 'present',
        overrideFlag: true,
        overrideNote,
        markedBy: req.user._id,
        timestamp: new Date()
      });
    }

    await attendance.populate('student', 'name email');
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Teacher: get embeddings for subject students (for client-side face match) ─
exports.getSubjectEmbeddings = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const enrollments = await SubjectEnrollment.find({ subject: subjectId });

    const embeddings = await Promise.all(
      enrollments.map(async (e) => {
        const user = await User.findById(e.student).select('name faceEmbeddings faceRegistered');
        return {
          studentId: user._id,
          name: user.name,
          faceRegistered: user.faceRegistered,
          embeddings: user.faceEmbeddings
        };
      })
    );

    res.json(embeddings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Teacher: get attendance for a session ───────────────────────────────────
exports.getSessionAttendance = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (session.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const records = await Attendance.find({ session: sessionId })
      .populate('student', 'name email')
      .sort('timestamp');
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Student: get own attendance logs ────────────────────────────────────────
exports.getMyAttendanceLogs = async (req, res) => {
  try {
    const { courseId, subjectId, date } = req.query;
    const filter = { student: req.user._id };
    if (courseId) filter.courseId = courseId;
    if (subjectId) filter.subject = subjectId;
    if (date) {
      const d = new Date(date);
      const nextDay = new Date(d);
      nextDay.setDate(d.getDate() + 1);
      filter.timestamp = { $gte: d, $lt: nextDay };
    }
    const logs = await Attendance.find(filter)
      .populate('subject', 'subjectName subjectCode')
      .populate('session', 'startTime endTime')
      .sort('-timestamp');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Teacher: get attendance logs with filters ────────────────────────────────
exports.getAttendanceLogs = async (req, res) => {
  try {
    const { subjectId, date } = req.query;

    // Always scope to subjects owned by this teacher
    const teacherSubjects = await Subject.find({ teacher: req.user._id, isActive: true }).select('_id');
    const teacherSubjectIds = teacherSubjects.map(s => s._id);

    const filter = { subject: { $in: teacherSubjectIds } };

    // Optionally narrow to a specific subject (must still belong to this teacher)
    if (subjectId) {
      const owns = teacherSubjectIds.some(id => id.toString() === subjectId);
      if (!owns) return res.status(403).json({ message: 'Not authorized for this subject' });
      filter.subject = subjectId;
    }

    if (date) {
      const d = new Date(date);
      const nextDay = new Date(d);
      nextDay.setDate(d.getDate() + 1);
      filter.timestamp = { $gte: d, $lt: nextDay };
    }

    const logs = await Attendance.find(filter)
      .populate('student', 'name email')
      .populate('subject', 'subjectName')
      .populate('session', 'startTime endTime')
      .sort('-timestamp');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
