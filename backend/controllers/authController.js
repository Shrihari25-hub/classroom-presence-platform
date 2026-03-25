const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'All fields required' });
    }
    if (!['teacher', 'student'].includes(role)) {
      return res.status(400).json({ message: 'Role must be teacher or student' });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({ name, email, password, role });
    const token = generateToken(user._id);
    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.saveFaceEmbeddings = async (req, res) => {
  try {
    const { embeddings } = req.body; // Array of 3 embedding vectors from face-api.js
    if (!embeddings || embeddings.length < 1) {
      return res.status(400).json({ message: 'At least 1 embedding required' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      faceEmbeddings: embeddings,
      faceRegistered: true
    });

    res.json({ message: 'Face embeddings saved successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
