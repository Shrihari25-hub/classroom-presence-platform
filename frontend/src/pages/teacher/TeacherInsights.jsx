import React, { useEffect, useState } from 'react';
import Sidebar from '../../components/shared/Sidebar';
import { getTeacherReport } from '../../services/api';

const riskBadgeClass = {
  High: 'badge-danger',
  Medium: 'badge-warning',
  Low: 'badge-success'
};

const trendStyle = {
  Improving: { color: '#16a34a', fontWeight: 700 },
  Declining:  { color: '#dc2626', fontWeight: 700 },
  Stable:     { color: '#6b7280', fontWeight: 600 }
};

export default function TeacherInsights() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');

    getTeacherReport()
      .then(res => {
        if (!alive) return;
        setReport(res.data);
      })
      .catch(err => {
        if (!alive) return;
        setError(err.response?.data?.message || 'Failed to load teacher insights');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => { alive = false; };
  }, []);

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <h1>📊 Teacher Insights</h1>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="card">
            <div className="spinner" />
            <div style={{ marginTop: -20, textAlign: 'center', color: '#888', fontSize: 13 }}>
              Running on-demand analytics…
            </div>
          </div>
        ) : (
          <>
            {/* ── At-Risk Student Tracker ─────────────────────────────── */}
            <div className="card" style={{ maxHeight: 480, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div className="card-title">⚠️ At-Risk Student Tracker</div>

              <div className="insights-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                {!report?.atRiskStudents || report.atRiskStudents.length === 0 ? (
                  <div style={{ padding: 16, color: '#888', fontSize: 14 }}>
                    All students are above the 75% attendance threshold.
                  </div>
                ) : (
                  <div className="table-wrap" style={{ borderRadius: 0 }}>
                    <table style={{ minWidth: 820 }}>
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Subject</th>
                          <th>Semester %</th>
                          <th>Present / Total</th>
                          <th>This Week</th>
                          <th>Trend (7d)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.atRiskStudents.map(s => (
                          <tr key={`${s.email || s.name}-${s.subject}`}>

                            {/* Name + Risk Badge */}
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                <span style={{
                                  fontWeight: 600,
                                  color: s.riskLevel === 'High' ? '#dc2626' : undefined
                                }}>
                                  {s.name}
                                </span>
                                <span className={`badge ${riskBadgeClass[s.riskLevel] || 'badge-neutral'}`}>
                                  ⚠️ {s.riskLevel}
                                </span>
                              </div>
                              {typeof s.failProbability === 'number' && (
                                <div style={{
                                  marginTop: 4,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: '2px 8px',
                                  borderRadius: 20,
                                  background: s.failProbability >= 70
                                    ? '#fee2e2'
                                    : s.failProbability >= 40
                                    ? '#fef3c7'
                                    : '#dcfce7',
                                  color: s.failProbability >= 70
                                    ? '#dc2626'
                                    : s.failProbability >= 40
                                    ? '#b45309'
                                    : '#16a34a',
                                }}>
                                  {s.failProbability >= 70 ? '🔴' : s.failProbability >= 40 ? '🟡' : '🟢'}
                                  {' '}{s.failProbability}% fail risk
                                </div>
                              )}
                            </td>

                            <td>{s.subject || '—'}</td>

                            {/* Semester attendance % */}
                            <td style={{
                              fontWeight: 700,
                              color: s.attendancePercentage < 50
                                ? '#dc2626'
                                : s.attendancePercentage < 70
                                ? '#b45309'
                                : '#374151'
                            }}>
                              {typeof s.attendancePercentage === 'number' ? `${s.attendancePercentage}%` : '—'}
                            </td>

                            <td>{s.presentCount ?? '—'} / {s.totalSessions ?? '—'}</td>

                            {/* Recent (last 7 days) */}
                            <td style={{ fontSize: 12, color: '#6b7280' }}>
                              {typeof s.recentAttendancePercentage === 'number'
                                ? `${s.recentAttendancePercentage}% (${s.recentPresent}/${s.recentTotal})`
                                : '—'}
                            </td>

                            {/* Trend (7d) — direction only */}
                            <td style={{ fontSize: 12 }}>
                              {s.trend ? (
                                <span style={trendStyle[s.trend]}>
                                  {s.trendSymbol} {s.trend}
                                </span>
                              ) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* ── Timetable Optimization ──────────────────────────────── */}
            <div className="card">
              <div className="card-title">🧠 Timetable Optimization</div>
              {!report?.slotSuggestions || report.slotSuggestions.length === 0 ? (
                <p style={{ color: '#888', fontSize: 14 }}>
                  Collecting baseline data. Timetable insights will be available after 7 days of logs.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {report.slotSuggestions.map((s, idx) => (
                    <div
                      key={`${s.subject}-${s.fromStartTime}-${idx}`}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 10,
                        padding: 12,
                        fontSize: 13,
                        color: '#334155',
                        lineHeight: 1.55
                      }}
                    >
                      <strong>{s.subject}</strong>
                      {' — '}
                      {s.suggestion || s.impact || '—'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}