import React, { useEffect, useState } from 'react';
import Sidebar from '../../components/shared/Sidebar';
import { getMyTimetable } from '../../services/api';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function StudentTimetable() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().getDay();

  useEffect(() => {
    getMyTimetable()
      .then(res => setSchedules(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <h1>📅 My Timetable</h1>
        </div>

        {loading ? <div className="spinner" /> : (
          <div className="card">
            {DAYS.map((day, idx) => {
              const daySched = schedules
                .filter(s => s.dayOfWeek === idx)
                .sort((a, b) => a.startTime.localeCompare(b.startTime));
              return (
                <div key={day} style={{
                  marginBottom: 20,
                  background: idx === today ? '#f0f7ff' : 'transparent',
                  borderRadius: 8,
                  padding: idx === today ? '12px' : '0'
                }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: idx === today ? '#1d4ed8' : '#555', marginBottom: 8, display: 'flex', gap: 8 }}>
                    {day}
                    {idx === today && <span className="badge badge-info">Today</span>}
                  </div>
                  {daySched.length === 0 ? (
                    <div style={{ fontSize: 13, color: '#bbb', paddingLeft: 8 }}>No classes</div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {daySched.map(s => (
                        <div key={s._id} style={{
                          background: s.isCancelled ? '#fee2e2' : '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: 8, padding: '10px 14px', fontSize: 13,
                          minWidth: 200,
                          maxWidth: '100%'
                        }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{s.subject?.subjectName}</div>
                          {s.subject?.subjectCode && <div style={{ color: '#888', fontSize: 12 }}>{s.subject.subjectCode}</div>}
                          <div style={{ color: '#555', marginTop: 4 }}>{s.startTime} — {s.endTime}</div>
                          {s.room && <div style={{ color: '#888', fontSize: 12 }}>📍 {s.room}</div>}
                          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                            Teacher: {s.teacher?.name}
                          </div>
                          {s.isCancelled && (
                            <div style={{ color: '#b91c1c', fontWeight: 600, fontSize: 12, marginTop: 4 }}>
                              ❌ CANCELLED{s.cancelNote && `: ${s.cancelNote}`}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
