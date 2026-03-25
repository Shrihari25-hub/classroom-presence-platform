require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// Connect Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/enrollments', require('./routes/enrollments'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/subject-enrollments', require('./routes/subjectEnrollments'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/timetable', require('./routes/timetable'));
app.use('/api/export', require('./routes/export'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/analytics', require('./routes/analytics'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
