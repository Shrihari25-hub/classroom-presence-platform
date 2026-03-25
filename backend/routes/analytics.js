const router = require('express').Router();
const ctrl = require('../controllers/analyticsController');
const { auth, requireTeacher } = require('../middleware/auth');

// Teacher ML-driven insights (on-demand)
router.get('/teacher-report', auth, requireTeacher, ctrl.getTeacherReport);

module.exports = router;

