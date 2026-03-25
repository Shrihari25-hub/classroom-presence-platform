const router = require('express').Router();
const ctrl = require('../controllers/timetableController');
const { auth, requireTeacher, requireStudent } = require('../middleware/auth');

router.post('/', auth, requireTeacher, ctrl.createSchedule);
router.get('/my', auth, requireStudent, ctrl.getMyTimetable);
router.get('/course/:courseId', auth, ctrl.getTimetableByCourse);
router.put('/:scheduleId', auth, requireTeacher, ctrl.updateSchedule);
router.put('/:scheduleId/cancel', auth, requireTeacher, ctrl.cancelClass);
router.delete('/:scheduleId', auth, requireTeacher, ctrl.deleteSchedule);

module.exports = router;
