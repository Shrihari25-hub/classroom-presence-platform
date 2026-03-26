/**
 * Shared attendance calculation utility.
 * "late" is treated as present everywhere analytics and exports are concerned.
 * Do NOT use this for session history display — that has its own logic.
 *
 * @param {Array} attendanceRecords - Array of attendance documents (or plain objects)
 * @returns {{ present, late, absent, total, percentage }}
 */
function calculateAttendanceStats(attendanceRecords) {
  const late    = attendanceRecords.filter(r => r.status === 'late').length;
  const present = attendanceRecords.filter(r => r.status === 'present').length + late;
  const absent  = attendanceRecords.filter(r => r.status === 'absent').length;
  const total   = attendanceRecords.length;
  const percentage = total === 0 ? 0 : Math.round((present / total) * 100);

  return { present, late, absent, total, percentage };
}

module.exports = { calculateAttendanceStats };
