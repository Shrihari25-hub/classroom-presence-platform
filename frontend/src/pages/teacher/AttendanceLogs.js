import React, { useEffect, useState } from 'react';
import Sidebar from '../../components/shared/Sidebar';
import { getAttendanceLogs, getMyCourses, getMySubjects } from '../../services/api';

const methodBadgeClass = {
  face: 'badge-success',
  qr: 'badge-info',
  manual: 'badge-warning'
};

export default function AttendanceLogs() {
  const [logs, setLogs] = useState([]);
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [filters, setFilters] = useState({ courseId: '', subjectId: '', date: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([getMyCourses(), getMySubjects()]).then(([c, s]) => {
      setCourses(c.data);
      setSubjects(s.data);
    });
  }, []);

  const fetchLogs = async (currentFilters) => {
    setLoading(true);
    try {
      const params = {};
      if (currentFilters.subjectId) params.subjectId = currentFilters.subjectId;
      if (currentFilters.date) params.date = currentFilters.date;
      const res = await getAttendanceLogs(params);
      setLogs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount with empty filters to show all
  useEffect(() => { fetchLogs(filters); }, []); // eslint-disable-line

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    // Reset subjectId when course changes
    if (key === 'courseId') newFilters.subjectId = '';
    setFilters(newFilters);
    fetchLogs(newFilters);
  };

  const filteredSubjects = subjects.filter(
    s => !filters.courseId || s.courseId === filters.courseId
  );

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <h1>✅ Attendance Logs</h1>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="form-row">
            <div className="form-group">
              <label>Course</label>
              <select
                value={filters.courseId}
                onChange={e => handleFilterChange('courseId', e.target.value)}
              >
                <option value="">All Courses</option>
                {courses.map(c => (
                  <option key={c.courseId} value={c.courseId}>{c.courseName}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Subject</label>
              <select
                value={filters.subjectId}
                onChange={e => handleFilterChange('subjectId', e.target.value)}
              >
                <option value="">All Subjects</option>
                {filteredSubjects.map(s => (
                  <option key={s._id} value={s._id}>{s.subjectName}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={filters.date}
                onChange={e => handleFilterChange('date', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Records table */}
        <div className="card">
          <div className="card-title">Records ({logs.length})</div>
          {loading ? (
            <div className="spinner" />
          ) : logs.length === 0 ? (
            <p style={{ color: '#888', fontSize: 14 }}>No records found for these filters.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Subject</th>
                    <th>Date &amp; Time</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Override</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l._id}>
                      <td>{l.student?.name}</td>
                      <td>{l.subject?.subjectName}</td>
                      <td style={{ fontSize: 12 }}>{new Date(l.timestamp).toLocaleString()}</td>
                      <td>
                        <span className={`badge ${methodBadgeClass[l.method] || 'badge-info'}`}>
                          {l.method}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-success">{l.status}</span>
                      </td>
                      <td>
                        {l.overrideFlag
                          ? <span className="badge badge-warning" title={l.overrideNote || ''}>Yes</span>
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
