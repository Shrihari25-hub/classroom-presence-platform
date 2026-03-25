/**
 * Seed script - run with: node seed.js
 * Creates sample teacher, student, course, and subject data
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Course = require('./models/Course');
const Enrollment = require('./models/Enrollment');
const Subject = require('./models/Subject');
const SubjectEnrollment = require('./models/SubjectEnrollment');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Clean existing data
  await Promise.all([
    User.deleteMany({}),
    Course.deleteMany({}),
    Enrollment.deleteMany({}),
    Subject.deleteMany({}),
    SubjectEnrollment.deleteMany({})
  ]);

  // Create teacher
  const teacher = await User.create({
    name: 'Prof. Alice Smith',
    email: 'teacher@example.com',
    password: 'password123',
    role: 'teacher'
  });
  console.log('Created teacher:', teacher.email);

  // Create students
  const students = await User.insertMany([
    { name: 'Bob Johnson', email: 'student1@example.com', password: 'password123', role: 'student' },
    { name: 'Carol Williams', email: 'student2@example.com', password: 'password123', role: 'student' },
    { name: 'Dave Brown', email: 'student3@example.com', password: 'password123', role: 'student' }
  ]);
  console.log('Created', students.length, 'students');

  // Create course
  const course = await Course.create({
    courseName: 'Computer Science Fundamentals',
    courseId: 'CS101-2024',
    description: 'Introduction to core CS concepts',
    owner: teacher._id
  });
  console.log('Created course:', course.courseId);

  // Approve student enrollments
  for (const student of students) {
    await Enrollment.create({
      courseId: course.courseId,
      course: course._id,
      student: student._id,
      status: 'approved',
      reviewedAt: new Date(),
      reviewedBy: teacher._id
    });
  }
  console.log('Enrolled all students in course');

  // Create subjects
  const subject1 = await Subject.create({
    subjectName: 'Data Structures',
    subjectCode: 'CS201',
    courseId: course.courseId,
    course: course._id,
    teacher: teacher._id
  });

  const subject2 = await Subject.create({
    subjectName: 'Algorithms',
    subjectCode: 'CS202',
    courseId: course.courseId,
    course: course._id,
    teacher: teacher._id
  });
  console.log('Created 2 subjects');

  // Enroll all students in subjects
  for (const student of students) {
    await SubjectEnrollment.create({ subject: subject1._id, student: student._id, courseId: course.courseId });
    await SubjectEnrollment.create({ subject: subject2._id, student: student._id, courseId: course.courseId });
  }
  console.log('Enrolled students in subjects');

  console.log('\n=== SEED COMPLETE ===');
  console.log('Teacher Login: teacher@example.com / password123');
  console.log('Student Login: student1@example.com / password123');
  console.log('Course ID (for students to join): CS101-2024');
  console.log('Subject invite tokens:');
  console.log('  Data Structures:', subject1.inviteToken);
  console.log('  Algorithms:', subject2.inviteToken);

  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
