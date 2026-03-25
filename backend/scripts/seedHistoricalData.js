/**
 * seedHistoricalData.js
 * Generates realistic historical attendance data (Jan–Feb 2026) for ML training.
 *
 * Usage:
 *   node backend/scripts/seedHistoricalData.js           — seed data
 *   node backend/scripts/seedHistoricalData.js --cleanup — remove all seeded data
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const fs       = require('fs');
const path     = require('path');

const connectDB    = require('../config/db');
const User         = require('../models/User');
const Course       = require('../models/Course');
const Subject      = require('../models/Subject');
const Session      = require('../models/Session');
const Attendance   = require('../models/Attendance');

// ─── Sidecar file that tracks seeded IDs for safe cleanup ────────────────────
const SEED_MANIFEST = path.join(__dirname, '.seed_manifest.json');

function loadManifest() {
  if (fs.existsSync(SEED_MANIFEST)) {
    return JSON.parse(fs.readFileSync(SEED_MANIFEST, 'utf8'));
  }
  return { userIds: [], courseIds: [], subjectIds: [], sessionIds: [], attendanceIds: [] };
}

function saveManifest(manifest) {
  fs.writeFileSync(SEED_MANIFEST, JSON.stringify(manifest, null, 2));
}

// ─── Behavioral group helper ──────────────────────────────────────────────────
function shouldBePresent(group, weekIndex, totalWeeks) {
  if (group === 'A') {
    // Consistently low but with occasional good weeks
    // 20% of time performs better than expected
    const isOccasionallyGood = Math.random() < 0.2;
    return Math.random() < (isOccasionallyGood ? 0.72 : 0.50);
  }
  if (group === 'B') {
    // Consistently high but with occasional bad weeks
    // 20% of time struggles unexpectedly
    const isOccasionallyBad = Math.random() < 0.2;
    return Math.random() < (isOccasionallyBad ? 0.65 : 0.87);
  }
  if (group === 'C') {
    // Declining: starts well, drops after halfway
    const baseRate = weekIndex < totalWeeks / 2 ? 0.82 : 0.46;
    const noise = (Math.random() - 0.5) * 0.15;
    return Math.random() < Math.min(0.95, Math.max(0.05, baseRate + noise));
  }
  if (group === 'D') {
    // Improving: starts poorly, recovers after halfway
    const baseRate = weekIndex < totalWeeks / 2 ? 0.44 : 0.82;
    const noise = (Math.random() - 0.5) * 0.15;
    return Math.random() < Math.min(0.95, Math.max(0.05, baseRate + noise));
  }
  return Math.random() < 0.7;
}


function randomMethod() {
  const r = Math.random();
  if (r < 0.60) return 'face';
  if (r < 0.90) return 'qr';
  return 'manual';
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
// Returns an array of Mondays from startDate up to (but not past) endDate
function getMondaysInRange(startDate, endDate) {
  const dates = [];
  const d = new Date(startDate);
  // Advance to first Monday
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  while (d <= endDate) {
    dates.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return dates;
}

function addMinutes(date, mins) {
  return new Date(date.getTime() + mins * 60000);
}

// ─── CLEANUP ──────────────────────────────────────────────────────────────────
async function cleanup() {
  await connectDB();
  const manifest = loadManifest();

  if (
    manifest.userIds.length === 0 &&
    manifest.sessionIds.length === 0 &&
    manifest.attendanceIds.length === 0
  ) {
    console.log('No seed manifest found — nothing to clean up.');
    await mongoose.disconnect();
    return;
  }

  const [delAttendance, delSessions, delSubjects, delCourses, delUsers] = await Promise.all([
    Attendance.deleteMany({ _id: { $in: manifest.attendanceIds } }),
    Session.deleteMany({ _id: { $in: manifest.sessionIds } }),
    Subject.deleteMany({ _id: { $in: manifest.subjectIds } }),
    Course.deleteMany({ _id: { $in: manifest.courseIds } }),
    User.deleteMany({ _id: { $in: manifest.userIds } }),
  ]);

  console.log(`Deleted ${delAttendance.deletedCount} attendance records`);
  console.log(`Deleted ${delSessions.deletedCount} sessions`);
  console.log(`Deleted ${delSubjects.deletedCount} subjects`);
  console.log(`Deleted ${delCourses.deletedCount} courses`);
  console.log(`Deleted ${delUsers.deletedCount} users`);

  fs.unlinkSync(SEED_MANIFEST);
  console.log('Seed manifest removed.');
  await mongoose.disconnect();
}

// ─── SEED ─────────────────────────────────────────────────────────────────────
async function seed() {
  await connectDB();

  const manifest = {
    userIds: [], courseIds: [], subjectIds: [], sessionIds: [], attendanceIds: []
  };

  // ── Step 1: Create 5 fake teachers ─────────────────────────────────────────
  const hashedPw = await bcrypt.hash('Seed@1234', 12);

  const teacherDefs = [
    { name: 'Seed Teacher Alpha',   email: 'seed.teacher.alpha@seed.dev' },
    { name: 'Seed Teacher Beta',    email: 'seed.teacher.beta@seed.dev' },
    { name: 'Seed Teacher Gamma',   email: 'seed.teacher.gamma@seed.dev' },
    { name: 'Seed Teacher Delta',   email: 'seed.teacher.delta@seed.dev' },
    { name: 'Seed Teacher Epsilon', email: 'seed.teacher.epsilon@seed.dev' },
  ];

  const teachers = await User.insertMany(
    teacherDefs.map(t => ({ ...t, password: hashedPw, role: 'teacher', faceRegistered: false }))
  );
  manifest.userIds.push(...teachers.map(t => t._id));
  console.log(`Created ${teachers.length} seed teachers`);

  // ── Step 2: Create 30 fake students across 4 behavioral groups ─────────────
  const groups = ['A', 'B', 'C', 'D'];
  // 30 students: 8 in A, 8 in B, 7 in C, 7 in D
  const groupSizes = { A: 8, B: 8, C: 7, D: 7 };

  const studentDefs = [];
  for (const group of groups) {
    for (let i = 1; i <= groupSizes[group]; i++) {
      studentDefs.push({
        name:  `Seed Student ${group}${i}`,
        email: `seed.student.${group.toLowerCase()}${i}@seed.dev`,
        password: hashedPw,
        role: 'student',
        faceRegistered: false,
        _group: group   // temp field — stripped before insert
      });
    }
  }

  // insertMany with raw docs (strip _group)
  const studentInserts = studentDefs.map(({ _group, ...rest }) => rest);
  const students = await User.insertMany(studentInserts);
  manifest.userIds.push(...students.map(s => s._id));

  // Re-attach group labels by index
  const studentsWithGroup = students.map((s, i) => ({
    ...s.toObject(),
    group: studentDefs[i]._group
  }));
  console.log(`Created ${students.length} seed students`);

  // ── Step 3: Create 4 fake courses ──────────────────────────────────────────
  const courseDefs = [
    { courseName: 'Seed Computer Science',    courseId: 'SEED-CS-2026' },
    { courseName: 'Seed Information Tech',    courseId: 'SEED-IT-2026' },
    { courseName: 'Seed Data Engineering',    courseId: 'SEED-DE-2026' },
    { courseName: 'Seed Software Engineering',courseId: 'SEED-SE-2026' },
  ];

  const courses = await Course.insertMany(
    courseDefs.map((c, i) => ({
      ...c,
      description: `Seeded course for ML training data`,
      owner: teachers[i]._id,
      isActive: true
    }))
  );
  manifest.courseIds.push(...courses.map(c => c._id));
  console.log(`Created ${courses.length} seed courses`);

  // ── Step 4: Create 4 fake subjects (one per course) ────────────────────────
  const subjectDefs = [
    { subjectName: 'Seed Intro to Programming',  subjectCode: 'SEED-ITP' },
    { subjectName: 'Seed Data Structures',        subjectCode: 'SEED-DSA' },
    { subjectName: 'Seed Database Systems',       subjectCode: 'SEED-DBS' },
    { subjectName: 'Seed Operating Systems',      subjectCode: 'SEED-OS' },
  ];

  const subjects = await Subject.insertMany(
    subjectDefs.map((s, i) => ({
      ...s,
      courseId: courses[i].courseId,
      course:   courses[i]._id,
      teacher:  teachers[i]._id,
      isActive: true
    }))
  );
  manifest.subjectIds.push(...subjects.map(s => s._id));
  console.log(`Created ${subjects.length} seed subjects`);

  // ── Step 5: Create sessions — one per week per subject, Jan 4 – Feb 24 2026 ─
  const semesterStart = new Date('2026-01-04T00:00:00.000Z');
  const semesterEnd   = new Date('2026-02-24T23:59:59.000Z');
  const weekDates     = getMondaysInRange(semesterStart, semesterEnd);
  const totalWeeks    = weekDates.length;

  console.log(`Semester weeks: ${totalWeeks} (${weekDates[0].toDateString()} → ${weekDates[totalWeeks-1].toDateString()})`);

  const allSessions = [];

  for (const subject of subjects) {
    for (const weekStart of weekDates) {
      // Random hour between 9am–5pm UTC
      const hour = 9 + Math.floor(Math.random() * 8);
      const startTime = new Date(weekStart);
      startTime.setUTCHours(hour, 0, 0, 0);

      const scheduledEnd = addMinutes(startTime, 90);
      const endTime      = scheduledEnd;
      const lockedAt     = endTime;
      const editableUntil = addMinutes(startTime, 7 * 24 * 60); // +7 days

      allSessions.push({
        subject:               subject._id,
        subjectId:             subject._id,
        courseId:              subject.courseId,
        teacher:               subject.teacher,
        startTime,
        scheduledEnd,
        endTime,
        status:                'ended',
        mode:                  'face',
        qrCode:                null,
        duplicateIgnoredCount: 0,
        unknownFaceCount:      0,
        lockedAt,
        editableUntil
      });
    }
  }

  const insertedSessions = await Session.insertMany(allSessions);
  manifest.sessionIds.push(...insertedSessions.map(s => s._id));
  console.log(`Created ${insertedSessions.length} sessions`);

  // ── Step 6: Create attendance records ──────────────────────────────────────
  // Group sessions by subject so we can compute weekIndex correctly
  const sessionsBySubject = {};
  for (const session of insertedSessions) {
    const key = session.subject.toString();
    if (!sessionsBySubject[key]) sessionsBySubject[key] = [];
    sessionsBySubject[key].push(session);
  }
  // Sort each subject's sessions chronologically
  for (const key of Object.keys(sessionsBySubject)) {
    sessionsBySubject[key].sort((a, b) => a.startTime - b.startTime);
  }

  const attendanceDocs = [];
  const groupStats = { A: { present: 0, total: 0 }, B: { present: 0, total: 0 }, C: { present: 0, total: 0 }, D: { present: 0, total: 0 } };

  for (const subject of subjects) {
    const subjectSessions = sessionsBySubject[subject._id.toString()];

    for (let wi = 0; wi < subjectSessions.length; wi++) {
      const session = subjectSessions[wi];

      for (const student of studentsWithGroup) {
        const present = shouldBePresent(student.group, wi, totalWeeks);
        const method  = randomMethod();

        groupStats[student.group].total++;
        if (present) groupStats[student.group].present++;

        attendanceDocs.push({
          student:       student._id,
          subject:       session.subject,
          session:       session._id,
          sessionId:     session._id,
          courseId:      session.courseId,
          status:        present ? 'present' : 'absent',
          method,
          confidenceScore: method === 'face' ? parseFloat((0.75 + Math.random() * 0.24).toFixed(3)) : undefined,
          overrideFlag:  false,
          timestamp:     session.startTime
        });
      }
    }
  }

  // Insert in batches of 1000 to avoid hitting document size limits
  const BATCH = 1000;
  let insertedCount = 0;
  for (let i = 0; i < attendanceDocs.length; i += BATCH) {
    const batch = await Attendance.insertMany(attendanceDocs.slice(i, i + BATCH));
    manifest.attendanceIds.push(...batch.map(a => a._id));
    insertedCount += batch.length;
  }
  console.log(`Created ${insertedCount} attendance records`);

  // ── Save manifest for cleanup ───────────────────────────────────────────────
  saveManifest(manifest);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────');
  console.log(`Seeded students created: ${students.length}`);
  console.log(`Seeded teachers created: ${teachers.length}`);
  console.log(`Seed courses created:    ${courses.length}`);
  console.log(`Seed subjects created:   ${subjects.length}`);
  console.log(`Sessions created:        ${insertedSessions.length}`);
  console.log(`Attendance records:      ${insertedCount}`);
  console.log('\nBreakdown:');
  for (const g of groups) {
    const avg = groupStats[g].total > 0
      ? ((groupStats[g].present / groupStats[g].total) * 100).toFixed(1)
      : '0.0';
    const label = { A: 'Consistently Low', B: 'Consistently High', C: 'Declining', D: 'Improving' }[g];
    console.log(`  Group ${g} (${label}): ${groupSizes[g]} students, avg attendance ~${avg}%`);
  }
  console.log('\nRun \'node backend/scripts/seedHistoricalData.js --cleanup\' to remove all seeded data');
  console.log('─────────────────────────────────────────────\n');

  await mongoose.disconnect();
}

// ─── Entry point ──────────────────────────────────────────────────────────────
const isCleanup = process.argv.includes('--cleanup');
(isCleanup ? cleanup() : seed()).catch(err => {
  console.error(err);
  process.exit(1);
});
