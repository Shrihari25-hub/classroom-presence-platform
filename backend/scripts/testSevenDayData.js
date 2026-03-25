/**
 * testSevenDayData.js
 * Creates fake sessions + attendance spread across 8 days for Ayush's subject
 * so the 7-day threshold in Teacher Insights can be tested immediately.
 *
 * Usage:
 *   node backend/scripts/testSevenDayData.js           — insert test data
 *   node backend/scripts/testSevenDayData.js --cleanup — remove inserted data
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose  = require('mongoose');
const fs        = require('fs');
const path      = require('path');

const connectDB  = require('../config/db');
const User       = require('../models/User');
const Subject    = require('../models/Subject');
const Session    = require('../models/Session');
const Attendance = require('../models/Attendance');

const MANIFEST = path.join(__dirname, '.test_manifest.json');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function loadManifest() {
  if (fs.existsSync(MANIFEST)) return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  return { sessionIds: [], attendanceIds: [] };
}

function saveManifest(m) {
  fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2));
}

/** Start-of-day UTC for a given Date */
function dayStart(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/** End-of-day UTC for a given Date */
function dayEnd(d) {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

function addMinutes(date, mins) {
  return new Date(date.getTime() + mins * 60000);
}

// ─── Attendance pattern ───────────────────────────────────────────────────────
// students[0..2] → consistently present  (present on 7 of 8 sessions)
// students[3..5] → consistently absent   (present on 1 of 8 sessions)
// students[6..7] → mixed                 (present on 4 of 8 sessions)
// sessionIndex is 0-based (0 = oldest day, 7 = most recent day)
function shouldBePresent(studentIndex, sessionIndex) {
  if (studentIndex <= 2) {
    // Present every session except the 4th (index 3)
    return sessionIndex !== 3;
  }
  if (studentIndex <= 5) {
    // Absent every session except the last (index 7)
    return sessionIndex === 7;
  }
  // Mixed: present on even-indexed sessions (0,2,4,6)
  return sessionIndex % 2 === 0;
}

// ─── CLEANUP ──────────────────────────────────────────────────────────────────
async function cleanup() {
  await connectDB();
  const manifest = loadManifest();

  if (manifest.sessionIds.length === 0 && manifest.attendanceIds.length === 0) {
    console.log('No test manifest found — nothing to clean up.');
    await mongoose.disconnect();
    return;
  }

  const [delAtt, delSess] = await Promise.all([
    Attendance.deleteMany({ _id: { $in: manifest.attendanceIds } }),
    Session.deleteMany({ _id: { $in: manifest.sessionIds } }),
  ]);

  console.log(`Deleted ${delAtt.deletedCount} attendance records`);
  console.log(`Deleted ${delSess.deletedCount} sessions`);

  fs.unlinkSync(MANIFEST);
  console.log('Test manifest removed.');
  await mongoose.disconnect();
}

// ─── SEED ─────────────────────────────────────────────────────────────────────
async function seed() {
  await connectDB();

  // ── Step 1: Find Ayush and his subject ──────────────────────────────────────
  const ayush = await User.findOne({ role: 'teacher', name: 'Ayush' }).lean();
  if (!ayush) {
    console.error('ERROR: Teacher "Ayush" not found. Check the name in the database.');
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`Teacher found: ${ayush.name} (ID: ${ayush._id})`);

  const subject = await Subject.findOne({
    teacher: ayush._id,
    subjectName: 'Introduction to C programming',
    isActive: true
  }).lean();
  if (!subject) {
    console.error('ERROR: Subject "Introduction to C programming" not found for Ayush.');
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`Subject found: ${subject.subjectName} (ID: ${subject._id})`);

  // ── Step 2: Find all 8 real students (not seeded) ───────────────────────────
  const realStudents = await User.find({
    role: 'student',
    $or: [{ isSeeded: { $exists: false } }, { isSeeded: false }]
  }).lean();

  if (realStudents.length === 0) {
    console.error('ERROR: No real students found.');
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`Real students found: ${realStudents.length}`);
  realStudents.forEach((s, i) => console.log(`  [${i}] ${s.name} (${s.email})`));

  // ── Step 3: Build 8 target dates going back from today ──────────────────────
  // Dates to skip — real sessions already exist for these
  const SKIP_DATES = new Set(['2026-03-16', '2026-03-17']);

  const today = new Date();
  const targetDates = [];
  let daysBack = 1;

  while (targetDates.length < 8) {
    const d = new Date(today);
    d.setDate(today.getDate() - daysBack);
    daysBack++;

    const iso = d.toISOString().slice(0, 10); // YYYY-MM-DD
    if (SKIP_DATES.has(iso)) {
      console.log(`  Skipping ${iso} — real session already exists for this date`);
      continue;
    }
    targetDates.push(d);
  }

  // Sort oldest → newest so sessionIndex 0 = oldest
  targetDates.sort((a, b) => a - b);

  // ── Step 4: Create sessions, skipping dates that already have one ────────────
  const manifest = { sessionIds: [], attendanceIds: [] };
  const createdSessions = [];
  let skippedCount = 0;

  for (let i = 0; i < targetDates.length; i++) {
    const date = targetDates[i];

    // Check if a session already exists for this subject on this date
    const existing = await Session.findOne({
      subject: subject._id,
      startTime: { $gte: dayStart(date), $lte: dayEnd(date) }
    }).lean();

    if (existing) {
      console.log(`  Skipping ${date.toISOString().slice(0, 10)} — session already exists`);
      skippedCount++;
      continue;
    }

    // Session at 10:00 UTC on that day
    const startTime = new Date(date);
    startTime.setUTCHours(10, 0, 0, 0);
    const scheduledEnd  = addMinutes(startTime, 90);
    const endTime       = scheduledEnd;
    const lockedAt      = endTime;
    const editableUntil = addMinutes(startTime, 7 * 24 * 60);

    const session = await Session.create({
      subject:               subject._id,
      subjectId:             subject._id,
      courseId:              subject.courseId,
      teacher:               ayush._id,
      startTime,
      scheduledEnd,
      endTime,
      status:                'ended',
      mode:                  'manual',
      qrCode:                null,
      duplicateIgnoredCount: 0,
      unknownFaceCount:      0,
      lockedAt,
      editableUntil
    });

    manifest.sessionIds.push(session._id);
    createdSessions.push({ session, sessionIndex: i });
  }

  console.log(`\nSessions created: ${createdSessions.length} (skipped ${skippedCount} already-existing dates)`);

  // ── Step 5: Create attendance records ────────────────────────────────────────
  const attendanceDocs = [];

  // Track group stats for summary
  const stats = {
    present: [0, 0, 0, 0, 0, 0, 0, 0],
    total:   [0, 0, 0, 0, 0, 0, 0, 0]
  };

  for (const { session, sessionIndex } of createdSessions) {
    for (let si = 0; si < realStudents.length; si++) {
      const student = realStudents[si];
      const present = shouldBePresent(si, sessionIndex);

      stats.total[si]++;
      if (present) stats.present[si]++;

      attendanceDocs.push({
        student:       student._id,
        subject:       subject._id,
        session:       session._id,
        sessionId:     session._id,
        courseId:      subject.courseId,
        status:        present ? 'present' : 'absent',
        method:        'manual',
        overrideFlag:  false,
        timestamp:     session.startTime
      });
    }
  }

  const inserted = await Attendance.insertMany(attendanceDocs);
  manifest.attendanceIds.push(...inserted.map(a => a._id));

  saveManifest(manifest);

  // ── Summary ──────────────────────────────────────────────────────────────────
  const dateRange = createdSessions.length > 0 ? [
    createdSessions[0].session.startTime.toISOString().slice(0, 10),
    createdSessions[createdSessions.length - 1].session.startTime.toISOString().slice(0, 10)
  ] : ['—', '—'];

  // Count by group
  let presentCount = 0, absentCount = 0, mixedCount = 0;
  for (const { session } of createdSessions) {
    for (let si = 0; si < realStudents.length; si++) {
      const sessionIndex = createdSessions.findIndex(s => s.session._id.equals(session._id));
      if (shouldBePresent(si, sessionIndex)) {
        if (si <= 2) presentCount++;
        else if (si <= 5) absentCount++;
        else mixedCount++;
      }
    }
  }

  console.log('\n─────────────────────────────────────────────────────────');
  console.log(`Teacher found:    ${ayush.name} (ID: ${ayush._id})`);
  console.log(`Subject found:    ${subject.subjectName} (ID: ${subject._id})`);
  console.log(`Real students:    ${realStudents.length}`);
  console.log(`Sessions created: ${createdSessions.length} (skipped ${skippedCount} already-existing dates)`);
  console.log(`Attendance records created: ${inserted.length}`);
  console.log(`Date range covered: ${dateRange[0]} to ${dateRange[1]}`);
  console.log('\nBreakdown:');
  console.log(`  Consistently present (students 0-2): ${realStudents.slice(0, 3).map(s => s.name).join(', ')}`);
  console.log(`  Consistently absent  (students 3-5): ${realStudents.slice(3, 6).map(s => s.name).join(', ')}`);
  console.log(`  Mixed                (students 6-7): ${realStudents.slice(6, 8).map(s => s.name).join(', ')}`);
  console.log('\nAttendance % per student:');
  for (let si = 0; si < realStudents.length; si++) {
    const pct = stats.total[si] > 0
      ? ((stats.present[si] / stats.total[si]) * 100).toFixed(0)
      : '0';
    const group = si <= 2 ? 'consistently present' : si <= 5 ? 'consistently absent' : 'mixed';
    console.log(`  ${realStudents[si].name}: ${stats.present[si]}/${stats.total[si]} = ${pct}% (${group})`);
  }
  console.log('\nCleanup: node backend/scripts/testSevenDayData.js --cleanup');
  console.log('─────────────────────────────────────────────────────────\n');

  await mongoose.disconnect();
}

// ─── Entry point ──────────────────────────────────────────────────────────────
const isCleanup = process.argv.includes('--cleanup');
(isCleanup ? cleanup() : seed()).catch(err => {
  console.error(err);
  process.exit(1);
});
