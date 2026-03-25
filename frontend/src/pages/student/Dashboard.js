import React, { useEffect, useState } from 'react';
import Sidebar from '../../components/shared/Sidebar';
import { getStudentDashboard } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStudentDashboard()
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <h1>Welcome, {user?.name} 👋</h1>
        </div>

        {!user?.faceRegistered && (
          <div className="alert alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <span>⚠️ Your face is not registered yet. Register to enable face recognition attendance.</span>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/student/face-registration')}>
              Register Now
            </button>
          </div>
        )}

        {loading ? <div className="spinner" /> : (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-num">{data?.totalCourses}</div>
                <div className="stat-label">Enrolled Courses</div>
              </div>
              <div className="stat-card">
                <div className="stat-num">{data?.totalSubjects}</div>
                <div className="stat-label">Subjects</div>
              </div>
              <div className="stat-card">
                <div className="stat-num">{data?.todaysClasses?.length}</div>
                <div className="stat-label">Today's Classes</div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">📈 Attendance by Subject</div>
              {!data?.attendanceSummary || data.attendanceSummary.length === 0 ? (
                <p style={{ color: '#888', fontSize: 14 }}>
                  No attendance summary yet. Your percentages will appear after sessions are recorded.
                </p>
              ) : (
                <div className="cards-grid">
                  {data.attendanceSummary.map(s => (
                    <div className="item-card" key={s.subjectId}>
                      <div className="item-card-title">
                        {s.subjectName || 'Subject'}
                        {s.subjectCode ? <span style={{ color: 'var(--text-3)', fontWeight: 600, marginLeft: 8, fontSize: 12 }}>({s.subjectCode})</span> : null}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--accent)' }}>
                          {typeof s.percentage === 'number' ? `${s.percentage}%` : '—'}
                        </div>
                        <div style={{ color: 'var(--text-3)', fontSize: 12 }}>
                          {s.attended}/{s.total} attended
                        </div>
                      </div>
                      <div className="item-card-meta">
                        Present: {s.present} • Late: {s.late} • Absent: {s.absent}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-title">📅 Today's Schedule</div>
              {data?.todaysClasses?.length === 0 ? (
                <p style={{ color: '#888', fontSize: 14 }}>No classes scheduled today. Enjoy your day! 🎉</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th></tr></thead>
                    <tbody>
                      {data.todaysClasses.map(c => (
                        <tr key={c._id}>
                          <td>{c.startTime} - {c.endTime}</td>
                          <td>{c.subject?.subjectName}</td>
                          <td>{c.teacher?.name}</td>
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
