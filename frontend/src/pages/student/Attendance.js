import React, { useEffect, useState } from 'react';
import Sidebar from '../../components/shared/Sidebar';
import { getMyAttendanceLogs, getMyEnrollments, getMySubjectEnrollments } from '../../services/api';

export default function StudentAttendance() {
  const [logs, setLogs] = useState([]);
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [filters, setFilters] = useState({ courseId: '', subjectId: '', date: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([getMyEnrollments(), getMySubjectEnrollments()]).then(([c, s]) => {
      setCourses(c.data.filter(e => e.status === 'approved'));
      setSubjects(s.data);
    });
    fetchLogs({});
  }, []);

  const fetchLogs = async (params) => {
    setLoading(true);
    try {
      const res = await getMyAttendanceLogs(params);
      setLogs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    const params = {};
    if (newFilters.courseId) params.courseId = newFilters.courseId;
    if (newFilters.subjectId) params.subjectId = newFilters.subjectId;
    if (newFilters.date) params.date = newFilters.date;
    fetchLogs(params);
  };

  const methodColor = { face: 'badge-success', qr: 'badge-info', manual: 'badge-warning' };

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <h1>✅ My Attendance</h1>
        </div>

        <div className="card">
          <div className="form-row">
            <div className="form-group">
              <label>Course</label>
              <select value={filters.courseId} onChange={e => handleFilterChange('courseId', e.target.value)}>
                <option value="">All Courses</option>
                {courses.map(e => <option key={e.courseId} value={e.courseId}>{e.course?.courseName}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Subject</label>
              <select value={filters.subjectId} onChange={e => handleFilterChange('subjectId', e.target.value)}>
                <option value="">All Subjects</option>
                {subjects.map(e => <option key={e._id} value={e.subject?._id}>{e.subject?.subjectName}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={filters.date} onChange={e => handleFilterChange('date', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Records ({logs.length})</div>
          {loading ? <div className="spinner" /> : logs.length === 0 ? (
            <p style={{ color: '#888', fontSize: 14 }}>No attendance records found.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Subject</th><th>Date & Time</th><th>Method</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l._id}>
                      <td>{l.subject?.subjectName}</td>
                      <td>{new Date(l.timestamp).toLocaleString()}</td>
                      <td><span className={`badge ${methodColor[l.method]}`}>{l.method}</span></td>
                      <td><span className="badge badge-success">{l.status}</span></td>
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
