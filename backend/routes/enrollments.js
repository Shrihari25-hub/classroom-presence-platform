const router = require('express').Router();
const ctrl = require('../controllers/enrollmentController');
const { auth, requireTeacher, requireStudent } = require('../middleware/auth');

router.post('/request', auth, requireStudent, ctrl.requestEnrollment);
router.get('/my', auth, requireStudent, ctrl.getMyEnrollments);
router.get('/course/:courseId/pending', auth, requireTeacher, ctrl.getPendingRequests);
router.get('/course/:courseId/students', auth, requireTeacher, ctrl.getCourseStudents);
router.put('/:enrollmentId/review', auth, requireTeacher, ctrl.reviewEnrollment);

module.exports = router;
