const path = require('path');
const { spawn } = require('child_process');

const Attendance = require('../models/Attendance');
const Subject = require('../models/Subject');
const Session = require('../models/Session');
const Timetable = require('../models/Timetable');

function toIsoOrNull(value) {
  try {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch (_) {
    return null;
  }
}

exports.getTeacherReport = async (req, res) => {
  const mongoose = require('mongoose');
  const teacherId = new mongoose.Types.ObjectId(req.user._id);

  try {
    // Teacher's subjects
    const subjects = await Subject.find({ teacher: teacherId, isActive: true })
      .select('_id subjectName subjectCode')
      .lean();

    const subjectIds = subjects.map(s => s._id);

    if (subjectIds.length === 0) {
      return res.json({ atRiskStudents: [], slotSuggestions: [] });
    }

    // Fetch ALL attendance logs for the entire semester (no date filter)
    const logs = await Attendance.find({
      subject: { $in: subjectIds }
    })
      .populate('student', 'name email')
      .populate('subject', 'subjectName subjectCode')
      .sort('timestamp');

    // Fetch all ended sessions per subject to get the true denominator.
    // Absent students may have no Attendance record at all, so len(logs) per
    // student is NOT the total session count — sessions are the source of truth.
    const sessions = await Session.find({
      subject: { $in: subjectIds },
      status: 'ended'
    }).select('_id subject').lean();

    const sessionCountBySubject = {};
    sessions.forEach(s => {
      const key = s.subject.toString();
      sessionCountBySubject[key] = (sessionCountBySubject[key] || 0) + 1;
    });

    // Current timetable schedule for lateness calculations
    const scheduleDocs = await Timetable.find({
      teacher: teacherId,
      subject: { $in: subjectIds },
      isActive: true,
      isCancelled: false
    })
      .populate('subject', 'subjectName subjectCode')
      .select('dayOfWeek startTime subject')
      .lean();

    const payload = {
      logs: logs.map(l => ({
        studentId: { name: l.student?.name, email: l.student?.email },
        subject: {
          subjectName: l.subject?.subjectName,
          subjectCode: l.subject?.subjectCode,
          subjectId: l.subject?._id?.toString()
        },
        timestamp: toIsoOrNull(l.timestamp),
        method: l.method,
        status: l.status,
        isOverride: Boolean(l.overrideFlag)
      })),
      schedule: scheduleDocs.map(s => ({
        subject: { subjectName: s.subject?.subjectName, subjectCode: s.subject?.subjectCode },
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime
      })),
      sessionCounts: sessionCountBySubject
    };


    const scriptPath = path.join(__dirname, '..', '..', 'ml', 'analytics_engine.py');
    const pythonExec = process.env.PYTHON_EXECUTABLE || 'python';

    let stdout = '';
    let stderr = '';
    let responded = false;

    // Single safe-send helper — guarantees only one response is ever sent
    const safeSend = (statusCode, body) => {
      if (responded) return;
      responded = true;
      clearTimeout(timeout);
      try { py.kill(); } catch (_) {}
      return res.status(statusCode).json(body);
    };

    // On-demand ML engine trigger
    const py = spawn(pythonExec, [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });

    const timeoutMs = 30000;
    const timeout = setTimeout(() => {
      safeSend(500, {
        message: 'ML engine timed out',
        detail: `Python executable used: "${pythonExec}". Check PYTHON_EXECUTABLE in .env (try "py" or "python3" on Windows).`
      });
    }, timeoutMs);

    py.stdin.write(JSON.stringify(payload));
    py.stdin.end();

    py.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    py.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    py.on('error', (err) => {
      safeSend(500, {
        message: `Failed to start Python. Tried executable: "${pythonExec}". Set PYTHON_EXECUTABLE in .env.`,
        detail: err.message
      });
    });

    py.on('exit', (code) => {
      if (responded) return;          // timeout already fired — do not send again
      clearTimeout(timeout);
      responded = true;

      if (code !== 0) {
        return res.status(500).json({
          message: 'ML engine exited with non-zero code',
          detail: stderr || `Exit code: ${code}`
        });
      }

      try {
        const parsed = JSON.parse(stdout || '{}');
        return res.json(parsed);
      } catch (e) {
        return res.status(500).json({
          message: 'Failed to parse ML engine output',
          detail: { stdoutPreview: stdout.slice(0, 500), error: e.message, stderr }
        });
      }
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Teacher analytics failed',
      detail: err.message
    });
  }
};