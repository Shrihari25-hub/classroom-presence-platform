const router = require('express').Router();
const ctrl = require('../controllers/subjectController');
const { auth, requireTeacher } = require('../middleware/auth');

router.post('/', auth, requireTeacher, ctrl.createSubject);
router.get('/my', auth, requireTeacher, ctrl.getMySubjects);
router.get('/course/:courseId', auth, ctrl.getSubjectsByCourse);
router.get('/:subjectId', auth, ctrl.getSubject);
router.put('/:subjectId', auth, requireTeacher, ctrl.updateSubject);
router.delete('/:subjectId', auth, requireTeacher, ctrl.deleteSubject);
router.post('/:subjectId/regenerate-invite', auth, requireTeacher, ctrl.regenerateInviteToken);

module.exports = router;
