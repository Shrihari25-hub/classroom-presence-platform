import React, { useEffect, useState } from 'react';
import Sidebar from '../../components/shared/Sidebar';
import { getMySubjects, createSchedule, getTimetableByCourse, getMyCourses, cancelClass, deleteSchedule } from '../../services/api';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TimetablePage() {
  const [schedules, setSchedules] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ subjectId: '', dayOfWeek: '1', startTime: '09:00', endTime: '10:00', room: '' });
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const [sub, c] = await Promise.all([getMySubjects(), getMyCourses()]);
      setSubjects(sub.data);
      setCourses(c.data);
      if (c.data.length > 0) {
        const courseId = selectedCourse || c.data[0].courseId;
        if (!selectedCourse) setSelectedCourse(courseId);
        const sched = await getTimetableByCourse(courseId);
        setSchedules(sched.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCourseChange = async (courseId) => {
    setSelectedCourse(courseId);
    const res = await getTimetableByCourse(courseId);
    setSchedules(res.data);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createSchedule({ ...form, dayOfWeek: parseInt(form.dayOfWeek) });
      setShowModal(false);
      if (selectedCourse) {
        const res = await getTimetableByCourse(selectedCourse);
        setSchedules(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error');
    }
  };

  const handleCancel = async (id) => {
    const note = prompt('Cancel reason (optional):') || '';
    try {
      await cancelClass(id, { cancelNote: note });
      handleCourseChange(selectedCourse);
    } catch (err) {
      alert('Error cancelling class');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this schedule?')) return;
    try {
      await deleteSchedule(id);
      handleCourseChange(selectedCourse);
    } catch (err) {
      alert('Error deleting schedule');
    }
  };

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <h1>📅 Timetable</h1>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Schedule</button>
        </div>

        <div className="form-group" style={{ maxWidth: 300, marginBottom: 20 }}>
          <label>Select Course</label>
          <select value={selectedCourse} onChange={e => handleCourseChange(e.target.value)}>
            {courses.map(c => <option key={c.courseId} value={c.courseId}>{c.courseName}</option>)}
          </select>
        </div>

        {/* Weekly Grid */}
        <div className="card">
          <div className="card-title">Weekly Schedule</div>
          {DAYS.map(day => {
            const dayIdx = DAYS.indexOf(day);
            const daySched = schedules
              .filter(s => s.dayOfWeek === dayIdx)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));
            return (
              <div key={day} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#555', marginBottom: 8 }}>{day}</div>
                {daySched.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#bbb', paddingLeft: 12 }}>No classes</div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {daySched.map(s => (
                      <div key={s._id} style={{
                        background: s.isCancelled ? '#fee2e2' : '#dbeafe',
                        borderRadius: 8, padding: '8px 12px', fontSize: 13
                      }}>
                        <div style={{ fontWeight: 600 }}>{s.subject?.subjectName}</div>
                        <div style={{ color: '#555' }}>{s.startTime} - {s.endTime}{s.room && ` • ${s.room}`}</div>
                        {s.isCancelled && <div style={{ color: '#b91c1c', fontSize: 11 }}>CANCELLED{s.cancelNote && `: ${s.cancelNote}`}</div>}
                        {!s.isCancelled && (
                          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                            <button className="btn btn-sm btn-danger" onClick={() => handleCancel(s._id)}>Cancel</button>
                            <button className="btn btn-sm btn-outline" onClick={() => handleDelete(s._id)}>Remove</button>
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

        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h3>Add Schedule</h3>
              <form onSubmit={handleCreate}>
                <div className="form-group">
                  <label>Subject</label>
                  <select value={form.subjectId} onChange={e => setForm({ ...form, subjectId: e.target.value })} required>
                    <option value="">Select subject</option>
                    {subjects.map(s => <option key={s._id} value={s._id}>{s.subjectName} ({s.courseId})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Day</label>
                  <select value={form.dayOfWeek} onChange={e => setForm({ ...form, dayOfWeek: e.target.value })}>
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Start Time</label>
                    <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>End Time</label>
                    <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Room (optional)</label>
                  <input value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} placeholder="e.g. Room 101" />
                </div>
                {error && <div className="alert alert-error">{error}</div>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Add Schedule</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
