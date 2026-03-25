const router = require('express').Router();
const ctrl = require('../controllers/attendanceController');
const { auth, requireTeacher, requireStudent } = require('../middleware/auth');

router.post('/face', auth, requireStudent, ctrl.markAttendanceFace);
router.post('/qr', auth, requireStudent, ctrl.markAttendanceQR);
router.post('/manual', auth, requireTeacher, ctrl.markAttendanceManual);
router.get('/my', auth, requireStudent, ctrl.getMyAttendanceLogs);
router.get('/session/:sessionId', auth, requireTeacher, ctrl.getSessionAttendance);
router.get('/logs', auth, requireTeacher, ctrl.getAttendanceLogs);
router.get('/embeddings/:subjectId', auth, requireTeacher, ctrl.getSubjectEmbeddings);

module.exports = router;
