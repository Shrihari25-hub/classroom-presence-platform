import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../../components/shared/Sidebar';
import { getPendingRequests, getCourseStudents, reviewEnrollment } from '../../services/api';

export default function EnrollmentsPage() {
  const { courseId } = useParams();
  const [pending, setPending] = useState([]);
  const [students, setStudents] = useState([]);
  const [tab, setTab] = useState('pending');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [p, s] = await Promise.all([getPendingRequests(courseId), getCourseStudents(courseId)]);
      setPending(p.data);
      setStudents(s.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [courseId]);

  const handleReview = async (id, action) => {
    try {
      await reviewEnrollment(id, action);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error');
    }
  };

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <h1>👥 Course: {courseId}</h1>
        </div>
        <div className="actions-row" style={{ marginBottom: 20 }}>
          <button className={`btn ${tab === 'pending' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('pending')}>
            Pending Requests {pending.length > 0 && <span className="badge badge-danger" style={{ marginLeft: 6 }}>{pending.length}</span>}
          </button>
          <button className={`btn ${tab === 'students' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('students')}>
            Approved Students ({students.length})
          </button>
        </div>

        {loading ? <div className="spinner" /> : (
          <div className="card">
            {tab === 'pending' && (
              <>
                <div className="card-title">Pending Enrollment Requests</div>
                {pending.length === 0 ? (
                  <p style={{ color: '#888', fontSize: 14 }}>No pending requests.</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Student</th><th>Email</th><th>Requested At</th><th>Actions</th></tr></thead>
                      <tbody>
                        {pending.map(r => (
                          <tr key={r._id}>
                            <td>{r.student?.name}</td>
                            <td>{r.student?.email}</td>
                            <td>{new Date(r.requestedAt).toLocaleDateString()}</td>
                            <td>
                              <div className="actions-row">
                                <button className="btn btn-success btn-sm" onClick={() => handleReview(r._id, 'approve')}>✓ Approve</button>
                                <button className="btn btn-danger btn-sm" onClick={() => handleReview(r._id, 'reject')}>✗ Reject</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
            {tab === 'students' && (
              <>
                <div className="card-title">Enrolled Students</div>
                {students.length === 0 ? (
                  <p style={{ color: '#888', fontSize: 14 }}>No approved students yet.</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Face Registered</th></tr></thead>
                      <tbody>
                        {students.map((e, i) => (
                          <tr key={e._id}>
                            <td>{i + 1}</td>
                            <td>{e.student?.name}</td>
                            <td>{e.student?.email}</td>
                            <td>
                              <span className={`badge ${e.student?.faceRegistered ? 'badge-success' : 'badge-warning'}`}>
                                {e.student?.faceRegistered ? '✓ Yes' : '✗ No'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
