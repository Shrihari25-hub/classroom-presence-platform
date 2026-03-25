const router = require('express').Router();
const ctrl = require('../controllers/dashboardController');
const { auth, requireTeacher, requireStudent } = require('../middleware/auth');

router.get('/teacher', auth, requireTeacher, ctrl.getTeacherDashboard);
router.get('/student', auth, requireStudent, ctrl.getStudentDashboard);

module.exports = router;
