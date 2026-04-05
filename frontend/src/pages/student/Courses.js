import React, { useEffect, useState } from 'react';
import Sidebar from '../../components/shared/Sidebar';
import { getMyEnrollments, requestEnrollment } from '../../services/api';

const statusBadge = { pending: 'badge-warning', approved: 'badge-success', rejected: 'badge-danger' };

export default function StudentCourses() {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [courseId, setCourseId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchEnrollments = async () => {
    try {
      const res = await getMyEnrollments();
      setEnrollments(res.data);
    } catch (err) {
      setError('Failed to load enrollments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEnrollments(); }, []);

  const handleJoin = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await requestEnrollment({ courseId: courseId.trim().toUpperCase() });
      setSuccess('Enrollment request sent! Wait for teacher approval.');
      setCourseId('');
      fetchEnrollments();
    } catch (err) {
      setError(err.response?.data?.message || 'Error joining course');
    }
  };

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <h1>📚 My Courses</h1>
        </div>

        <div className="card">
          <div className="card-title">Join a Course</div>
          <form onSubmit={handleJoin} className="inline-form">
            <input
              value={courseId}
              onChange={e => setCourseId(e.target.value)}
              placeholder="Enter Course ID"
              style={{ flex: 1, padding: '9px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }}
              required
            />
            <button type="submit" className="btn btn-primary">Join Course</button>
          </form>
          {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
          {success && <div className="alert alert-success" style={{ marginTop: 12 }}>{success}</div>}
        </div>

        <div className="card">
          <div className="card-title">My Enrollments</div>
          {loading ? <div className="spinner" /> : enrollments.length === 0 ? (
            <p style={{ color: '#888', fontSize: 14 }}>No enrollments yet. Join a course above!</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Course Name</th><th>Course ID</th><th>Status</th><th>Requested</th></tr></thead>
                <tbody>
                  {enrollments.map(e => (
                    <tr key={e._id}>
                      <td>{e.course?.courseName}</td>
                      <td style={{ fontFamily: 'monospace' }}>{e.courseId}</td>
                      <td><span className={`badge ${statusBadge[e.status]}`}>{e.status}</span></td>
                      <td>{new Date(e.requestedAt).toLocaleDateString()}</td>
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
