const router = require('express').Router();
const { register, login, getMe, saveFaceEmbeddings } = require('../controllers/authController');
const { auth } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', auth, getMe);
router.post('/face-embeddings', auth, saveFaceEmbeddings);

module.exports = router;
