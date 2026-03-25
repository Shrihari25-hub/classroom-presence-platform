const router = require('express').Router();
const ctrl = require('../controllers/subjectEnrollmentController');
const { auth, requireTeacher, requireStudent } = require('../middleware/auth');

router.post('/join', auth, requireStudent, ctrl.joinSubject);
router.get('/my', auth, requireStudent, ctrl.getMySubjectEnrollments);
router.get('/subject/:subjectId/students', auth, requireTeacher, ctrl.getSubjectStudents);
router.delete('/subject/:subjectId/students/:studentId', auth, requireTeacher, ctrl.removeStudentFromSubject);

module.exports = router;
