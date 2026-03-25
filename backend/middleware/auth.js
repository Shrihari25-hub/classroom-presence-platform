const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // Accept token from Authorization header OR ?token= query param (needed for file downloads)
    const headerToken = req.headers.authorization?.split(' ')[1];
    const queryToken = req.query.token;
    const token = headerToken || queryToken;
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password -faceEmbeddings');
    if (!user) return res.status(401).json({ message: 'Invalid token' });

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token invalid or expired' });
  }
};

const requireTeacher = (req, res, next) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Access denied: Teachers only' });
  }
  next();
};

const requireStudent = (req, res, next) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Access denied: Students only' });
  }
  next();
};

module.exports = { auth, requireTeacher, requireStudent };
