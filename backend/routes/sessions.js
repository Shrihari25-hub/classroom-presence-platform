const router = require('express').Router();
const ctrl = require('../controllers/sessionController');
const { auth, requireTeacher } = require('../middleware/auth');

router.post('/start', auth, requireTeacher, ctrl.startSession);
router.put('/:sessionId/end', auth, requireTeacher, ctrl.endSession);
router.get('/active', auth, requireTeacher, ctrl.getActiveSessions);
router.get('/subject/:subjectId', auth, ctrl.getSessionsBySubject);
router.get('/:sessionId', auth, ctrl.getSession);

module.exports = router;
