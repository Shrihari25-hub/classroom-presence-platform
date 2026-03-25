const router = require('express').Router();
const ctrl = require('../controllers/exportController');
const { auth, requireTeacher } = require('../middleware/auth');

router.get('/students/:courseId', auth, requireTeacher, ctrl.exportStudentList);
router.get('/attendance/:subjectId', auth, requireTeacher, ctrl.exportAttendance);

module.exports = router;
