const XLSX = require('xlsx');
const Enrollment = require('../models/Enrollment');
const Attendance = require('../models/Attendance');
const Session = require('../models/Session');
const Subject = require('../models/Subject');
const SubjectEnrollment = require('../models/SubjectEnrollment');
const User = require('../models/User');

// ─── Export student list per course ──────────────────────────────────────────
exports.exportStudentList = async (req, res) => {
  try {
    const { courseId } = req.params;

    const enrollments = await Enrollment.find({ courseId, status: 'approved' })
      .populate('student', 'name email faceRegistered');

    const data = enrollments.map((e, i) => ({
      '#': i + 1,
      Name: e.student.name,
      Email: e.student.email,
      'Face Registered': e.student.faceRegistered ? 'Yes' : 'No',
      'Enrolled At': new Date(e.requestedAt).toLocaleDateString()
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="students-${courseId}.xlsx"`);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── FIX 3: Full attendance report — one column per session date ──────────────
// Output: Name | Email | DD-MM-YYYY | DD-MM-YYYY | ... | Total Present | Total Sessions | Attendance %
exports.exportAttendance = async (req, res) => {
  try {
    const { subjectId } = req.params;

    const subject = await Subject.findById(subjectId).populate('course', 'courseName');
    if (!subject) return res.status(404).json({ message: 'Subject not found' });
    if (subject.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized for this subject' });
    }

    // 1. All ended sessions for this subject, sorted by date ascending
    const sessions = await Session.find({ subject: subjectId, status: 'ended' })
      .sort('startTime')
      .lean();

    if (sessions.length === 0) {
      // Return empty sheet with a message if no sessions yet
      const ws = XLSX.utils.json_to_sheet([{ Message: 'No ended sessions found for this subject.' }]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="attendance-${subject.subjectName}.xlsx"`);
      return res.send(buf);
    }

    // 2. All students enrolled in this subject
    const enrollments = await SubjectEnrollment.find({ subject: subjectId })
      .populate('student', 'name email');

    if (enrollments.length === 0) {
      const ws = XLSX.utils.json_to_sheet([{ Message: 'No students enrolled in this subject.' }]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="attendance-${subject.subjectName}.xlsx"`);
      return res.send(buf);
    }

    // 3. All attendance records for this subject
    const allAttendance = await Attendance.find({ subject: subjectId }).lean();

    // Build a lookup: attendanceByStudentBySession[studentId][sessionId] = 'Present' | 'Absent'
    const attendanceMap = {};
    for (const record of allAttendance) {
      const sid = record.student.toString();
      const sessId = record.session.toString();
      if (!attendanceMap[sid]) attendanceMap[sid] = {};
      // Use the status field — normalise to title case for display
      const statusDisplay = record.status
        ? record.status.charAt(0).toUpperCase() + record.status.slice(1)
        : 'Present';
      attendanceMap[sid][sessId] = statusDisplay;
    }

    // 4. Build column headers — one per session, labelled DD-MM-YYYY (HH:MM)
    //    Use a unique label per session even if same day (include time)
    const sessionLabels = sessions.map(s => {
      const d = new Date(s.startTime);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
    });

    // 5. Build one row per student
    const rows = enrollments.map(e => {
      const studentId = e.student._id.toString();
      const row = {
        Name: e.student.name,
        Email: e.student.email
      };

      let totalPresent = 0;

      sessions.forEach((session, idx) => {
        const sessId = session._id.toString();
        const status = attendanceMap[studentId]?.[sessId] || 'Absent';
        row[sessionLabels[idx]] = status;
        if (status.toLowerCase() === 'present') totalPresent++;
      });

      const totalSessions = sessions.length;
      const attendancePct = totalSessions > 0
        ? parseFloat(((totalPresent / totalSessions) * 100).toFixed(1))
        : 0;

      row['Total Present'] = totalPresent;
      row['Total Sessions'] = totalSessions;
      row['Attendance %'] = `${attendancePct}%`;

      return row;
    });

    // 6. Build worksheet
    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto-width columns
    const colWidths = Object.keys(rows[0] || {}).map(key => ({
      wch: Math.max(key.length, 12)
    }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

    // Add a summary sheet
    const summaryData = [
      { Field: 'Subject', Value: subject.subjectName },
      { Field: 'Subject Code', Value: subject.subjectCode || '—' },
      { Field: 'Course', Value: subject.course?.courseName || '—' },
      { Field: 'Total Sessions', Value: sessions.length },
      { Field: 'Total Students', Value: enrollments.length },
      { Field: 'Export Date', Value: new Date().toLocaleDateString() }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="attendance-${subject.subjectName.replace(/\s+/g, '_')}.xlsx"`
    );
    res.send(buf);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
