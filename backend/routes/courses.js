const router = require('express').Router();
const ctrl = require('../controllers/courseController');
const { auth, requireTeacher } = require('../middleware/auth');
const { courseTeacherAccess } = require('../middleware/courseAccess');

router.post('/', auth, requireTeacher, ctrl.createCourse);
router.get('/my', auth, requireTeacher, ctrl.getMyCourses);
router.get('/:courseId', auth, ctrl.getCourse);
router.put('/:courseId', auth, requireTeacher, courseTeacherAccess, ctrl.updateCourse);
router.delete('/:courseId', auth, requireTeacher, courseTeacherAccess, ctrl.deleteCourse);
router.post('/:courseId/co-teachers', auth, requireTeacher, courseTeacherAccess, ctrl.addCoTeacher);
router.delete('/:courseId/co-teachers/:teacherId', auth, requireTeacher, courseTeacherAccess, ctrl.removeCoTeacher);

module.exports = router;
