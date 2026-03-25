import React, { useEffect, useState } from 'react';
import Sidebar from '../../components/shared/Sidebar';
import { getTeacherDashboard, endSession } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      const res = await getTeacherDashboard();
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  const handleEndSession = async (sessionId) => {
    if (!window.confirm('End this session?')) return;
    try {
      await endSession(sessionId);
      fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.message || 'Error ending session');
    }
  };

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <h1>Welcome back, {user?.name} 👋</h1>
        </div>

        {loading ? (
          <div className="spinner" />
        ) : (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-num">{data?.totalCourses}</div>
                <div className="stat-label">Total Courses</div>
              </div>
              <div className="stat-card">
                <div className="stat-num">{data?.totalSubjects}</div>
                <div className="stat-label">Total Subjects</div>
              </div>
              <div className="stat-card">
                <div className="stat-num">{data?.todaysClasses?.length}</div>
                <div className="stat-label">Today's Classes</div>
              </div>
              <div className="stat-card">
                <div className="stat-num">{data?.activeSessions?.length}</div>
                <div className="stat-label">Active Sessions</div>
              </div>
              {data?.pendingEnrollments > 0 && (
                <div className="stat-card" style={{ background: '#fff9c4' }}>
                  <div className="stat-num" style={{ color: '#f59e0b' }}>{data.pendingEnrollments}</div>
                  <div className="stat-label">Pending Enrollments</div>
                </div>
              )}
            </div>

            {data?.activeSessions?.length > 0 && (
              <div className="card">
                <div className="card-title">🔴 Active Sessions</div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Subject</th><th>Course</th><th>Started</th><th>Mode</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {data.activeSessions.map(s => (
                        <tr key={s._id}>
                          <td>{s.subject?.subjectName}</td>
                          <td>{s.subject?.courseId}</td>
                          <td>{new Date(s.startTime).toLocaleTimeString()}</td>
                          <td><span className="badge badge-info">{s.mode}</span></td>
                          <td>
                            <div className="actions-row">
                              <button className="btn btn-primary btn-sm" onClick={() => navigate(`/teacher/session/${s._id}`)}>View</button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleEndSession(s._id)}>End</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-title">📅 Today's Schedule ({DAYS[new Date().getDay()]})</div>
              {data?.todaysClasses?.length === 0 ? (
                <p style={{ color: '#888', fontSize: 14 }}>No classes scheduled today.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Time</th><th>Subject</th><th>Room</th></tr></thead>
                    <tbody>
                      {data.todaysClasses.map(c => (
                        <tr key={c._id}>
                          <td>{c.startTime} - {c.endTime}</td>
                          <td>{c.subject?.subjectName}</td>
                          <td>{c.room || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
