import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../../components/shared/Sidebar';
import { getSession, getSessionAttendance, markAttendanceManual, getSubjectStudents } from '../../services/api';

// ─── helpers ─────────────────────────────────────────────────────────────────

const methodBadge  = { face: 'badge-success', qr: 'badge-info', manual: 'badge-warning' };
const statusBadge  = { present: 'badge-success', absent: 'badge-danger', late: 'badge-warning' };

// ─── inline-edit row ─────────────────────────────────────────────────────────
function AttendanceRow({ record, index, sessionId, canEdit, onSaved }) {
  const [editing, setEditing]   = useState(false);
  const [newStatus, setNew]     = useState(record.status);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');

  const handleSave = async () => {
    if (newStatus === record.status) { setEditing(false); return; }
    setSaving(true); setErr('');
    try {
      await markAttendanceManual({
        sessionId,
        studentId: record.student._id,
        status: newStatus,
        overrideNote: `Status changed to ${newStatus} by teacher`
      });
      setEditing(false);
      onSaved();
    } catch (e) {
      setErr(e.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <tr>
      <td>{index + 1}</td>
      <td style={{ fontWeight: 500 }}>{record.student?.name}</td>
      <td className="hide-xs" style={{ fontSize: 12 }}>{record.student?.email}</td>
      <td>
        <span className={`badge ${methodBadge[record.method] || 'badge-info'}`}>{record.method}</span>
      </td>
      <td>
        {editing ? (
          <div className="inline-edit-wrap" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={newStatus}
              onChange={e => setNew(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: 13, background: '#fff' }}
            >
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
            </select>
            <button className="btn btn-success btn-sm" onClick={handleSave} disabled={saving} style={{ minWidth: 52 }}>
              {saving ? '…' : 'Save'}
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => { setEditing(false); setNew(record.status); setErr(''); }}>
              ✕
            </button>
            {err && <span style={{ fontSize: 11, color: '#b91c1c' }}>{err}</span>}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className={`badge ${statusBadge[record.status] || 'badge-info'}`}>{record.status}</span>
            {canEdit && (
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => setEditing(true)}
                title="Edit status"
              >✏️</button>
            )}
          </div>
        )}
      </td>
      <td className="hide-sm" style={{ fontSize: 12 }}>{new Date(record.timestamp).toLocaleTimeString()}</td>
      <td className="hide-sm">
        {record.overrideFlag
          ? <span className="badge badge-warning" title={record.overrideNote || ''}>Yes</span>
          : '—'}
      </td>
    </tr>
  );
}

// ─── unmarked student row — lets teacher add a missing record ─────────────────
function UnmarkedRow({ student, sessionId, canEdit, onSaved }) {
  const [adding, setAdding]     = useState(false);
  const [status, setStatus]     = useState('present');
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');

  if (!canEdit) return null; // hide row if session is locked

  const handleAdd = async () => {
    setSaving(true); setErr('');
    try {
      await markAttendanceManual({
        sessionId,
        studentId: student._id,
        status,
        overrideNote: `Manually added by teacher`
      });
      setAdding(false);
      onSaved();
    } catch (e) {
      setErr(e.response?.data?.message || 'Error');
    } finally { setSaving(false); }
  };

  return (
    <tr className="row-unmarked">
      <td>—</td>
      <td style={{ fontWeight: 500 }}>{student.name}</td>
      <td className="hide-xs" style={{ fontSize: 12 }}>{student.email}</td>
      <td><span className="badge badge-neutral">—</span></td>
      <td>
        {adding ? (
          <div className="inline-edit-wrap" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: 13, background: '#fff' }}
            >
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
            </select>
            <button className="btn btn-success btn-sm" onClick={handleAdd} disabled={saving} style={{ minWidth: 52 }}>
              {saving ? '…' : 'Add'}
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => { setAdding(false); setErr(''); }}>✕</button>
            {err && <span style={{ fontSize: 11, color: '#b91c1c' }}>{err}</span>}
          </div>
        ) : (
          <span style={{ color: 'var(--text-3)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge badge-neutral">Not marked</span>
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => setAdding(true)}
              title="Add attendance"
            >+ Add</button>
          </span>
        )}
      </td>
      <td className="hide-sm" />
      <td className="hide-sm" />
    </tr>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function SessionPage() {
  const { sessionId }  = useParams();
  const [session, setSession]       = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [allStudents, setAllStudents] = useState([]);  // everyone enrolled in the subject
  const [loading, setLoading]       = useState(true);
  const [saveMsg, setSaveMsg]       = useState('');
  const [showUnmarked, setShowUnmarked] = useState(true);
  const intervalRef = useRef();

  const fetchData = async () => {
    try {
      const [s, a] = await Promise.all([
        getSession(sessionId),
        getSessionAttendance(sessionId)
      ]);
      setSession(s.data);
      setAttendance(a.data);
      // Load all enrolled students once we know the subject ID
      if (s.data?.subject?._id) {
        const studs = await getSubjectStudents(s.data.subject._id);
        setAllStudents(studs.data.map(e => e.student).filter(Boolean));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 6000);
    return () => clearInterval(intervalRef.current);
  }, [sessionId]); // eslint-disable-line

  const handleSaved = () => {
    setSaveMsg('✅ Attendance updated');
    setTimeout(() => setSaveMsg(''), 3000);
    fetchData();
  };

  if (loading) return <div className="app"><Sidebar /><div className="main-content"><div className="spinner" /></div></div>;

  const canEdit = session?.status === 'active' ||
    (session?.editableUntil && new Date() < new Date(session.editableUntil));

  // Separate marked vs unmarked students
  const markedStudentIds = new Set(attendance.map(r => r.student?._id));
  const unmarkedStudents = allStudents.filter(s => !markedStudentIds.has(s._id));

  // Late counts as present; not-marked only relevant during active sessions
  const presentCount = attendance.filter(r => r.status === 'present' || r.status === 'late').length;
  const absentCount  = attendance.filter(r => r.status === 'absent').length;
  const lateCount    = attendance.filter(r => r.status === 'late').length;
  const faceCount    = attendance.filter(r => r.method === 'face').length;
  const qrCount      = attendance.filter(r => r.method === 'qr').length;
  const manualCount  = attendance.filter(r => r.method === 'manual').length;

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1>📋 {session?.subject?.subjectName}</h1>
            <p>
              {new Date(session?.startTime).toLocaleString()}
              {session?.endTime && ` → ${new Date(session.endTime).toLocaleTimeString()}`}
            </p>
          </div>
          <span
            className={`badge ${session?.status === 'active' ? 'badge-success' : 'badge-warning'}`}
            style={{ fontSize: 13, padding: '6px 14px' }}
          >
            {session?.status === 'active' ? '● LIVE' : 'Ended'}
          </span>
        </div>

        {/* Edit window notices */}
        {canEdit && session?.status !== 'active' && (
          <div className="alert alert-success">
            ✏️ Editing open until <strong>{new Date(session.editableUntil).toLocaleDateString()}</strong>.
            {' '}  
          </div>
        )}
        {!canEdit && session?.status === 'ended' && (
          <div className="alert alert-error">
            🔒 This session is permanently locked and can no longer be edited.
          </div>
        )}
        {saveMsg && <div className="alert alert-success">{saveMsg}</div>}

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-num" style={{ color: '#16a34a' }}>{presentCount}</div>
            <div className="stat-label">Present{lateCount > 0 ? ` (incl. ${lateCount} late)` : ''}</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color: '#ef4444' }}>{absentCount}</div>
            <div className="stat-label">Absent</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color: '#f59e0b' }}>{lateCount}</div>
            <div className="stat-label">Late</div>
          </div>
          {session?.status === 'active' && (
            <div className="stat-card">
              <div className="stat-num" style={{ color: '#94a3b8' }}>{unmarkedStudents.length}</div>
              <div className="stat-label">Not marked</div>
            </div>
          )}
          <div className="stat-card">
            <div className="stat-num">{faceCount}</div>
            <div className="stat-label">Via Face</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">{qrCount}</div>
            <div className="stat-label">Via QR</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">{manualCount}</div>
            <div className="stat-label">Manual</div>
          </div>
        </div>

        {/* Main attendance table */}
        <div className="card">
          <div className="card-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <span>
              Attendance Records
              {canEdit && (
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-3)', marginLeft: 8 }}>
                  — click ✏️ to edit
                </span>
              )}
            </span>
            {unmarkedStudents.length > 0 && canEdit && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowUnmarked(v => !v)}
              >
                {showUnmarked ? '▲ Hide' : '▼ Show'} not-marked ({unmarkedStudents.length})
              </button>
            )}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student</th>
                  <th className="hide-xs">Email</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th className="hide-sm">Time</th>
                  <th className="hide-sm">Override</th>
                </tr>
              </thead>
              <tbody>
                {attendance.length === 0 && unmarkedStudents.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 28 }}>No attendance records yet.</td></tr>
                )}

                {/* Marked rows */}
                {attendance.map((r, i) => (
                  <AttendanceRow
                    key={r._id}
                    record={r}
                    index={i}
                    sessionId={sessionId}
                    canEdit={canEdit}
                    onSaved={handleSaved}
                  />
                ))}

                {/* Separator row */}
                {showUnmarked && unmarkedStudents.length > 0 && canEdit && (
                  <tr>
                    <td colSpan={7} style={{
                      background: '#fffbeb',
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                      color: '#a16207',
                      padding: '7px 14px'
                    }}>
                      ⚠ Not yet marked — {unmarkedStudents.length} student{unmarkedStudents.length !== 1 ? 's' : ''}
                    </td>
                  </tr>
                )}

                {/* Unmarked rows */}
                {showUnmarked && canEdit && unmarkedStudents.map(student => (
                  <UnmarkedRow
                    key={student._id}
                    student={student}
                    sessionId={sessionId}
                    canEdit={canEdit}
                    onSaved={handleSaved}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
