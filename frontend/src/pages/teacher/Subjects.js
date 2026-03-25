import React, { useEffect, useState } from 'react';
import Sidebar from '../../components/shared/Sidebar';
import { getMySubjects, getMyCourses, createSubject, deleteSubject, regenerateInviteToken } from '../../services/api';
import { useNavigate } from 'react-router-dom';

export default function SubjectsPage() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ subjectName: '', subjectCode: '', courseId: '' });
  const [error, setError] = useState('');
  const [inviteInfo, setInviteInfo] = useState(null);

  const fetchData = async () => {
    try {
      const [s, c] = await Promise.all([getMySubjects(), getMyCourses()]);
      setSubjects(s.data);
      setCourses(c.data);
      if (c.data.length > 0 && !form.courseId) setForm(f => ({ ...f, courseId: c.data[0].courseId }));
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createSubject(form);
      setShowModal(false);
      setForm({ subjectName: '', subjectCode: '', courseId: courses[0]?.courseId || '' });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating subject');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this subject?')) return;
    try {
      await deleteSubject(id);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error');
    }
  };

  const handleShowInvite = async (subject) => {
    setInviteInfo({ ...subject, token: subject.inviteToken });
  };

  const handleRegenerateToken = async (subjectId) => {
    try {
      const res = await regenerateInviteToken(subjectId);
      setInviteInfo(prev => ({ ...prev, token: res.data.inviteToken }));
      fetchData();
    } catch (err) {
      alert('Error regenerating token');
    }
  };

  // /join/:token works for both logged-in students and those who need to log in first
  const inviteLink = inviteInfo ? `${window.location.origin}/join/${inviteInfo.token}` : '';

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <h1>📖 My Subjects</h1>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Subject</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}

        {loading ? <div className="spinner" /> : (
          <div className="cards-grid">
            {subjects.map(s => (
              <div className="item-card" key={s._id}>
                <div className="item-card-title">{s.subjectName}</div>
                {s.subjectCode && <div className="item-card-desc">{s.subjectCode}</div>}
                <div className="item-card-meta">Course: {s.course?.courseName} ({s.courseId})</div>
                <div className="item-card-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => navigate(`/teacher/subjects/${s._id}`)}>
                    📊 Manage
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => handleShowInvite(s)}>
                    🔗 Invite Link
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s._id)}>
                    🗑 Delete
                  </button>
                </div>
              </div>
            ))}
            {subjects.length === 0 && <div style={{ color: '#888', padding: 20 }}>No subjects yet.</div>}
          </div>
        )}

        {/* Create Subject Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h3>Create New Subject</h3>
              <form onSubmit={handleCreate}>
                <div className="form-group">
                  <label>Course</label>
                  <select value={form.courseId} onChange={e => setForm({ ...form, courseId: e.target.value })} required>
                    {courses.map(c => <option key={c.courseId} value={c.courseId}>{c.courseName} ({c.courseId})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Subject Name</label>
                  <input value={form.subjectName} onChange={e => setForm({ ...form, subjectName: e.target.value })} required placeholder="e.g. Data Structures" />
                </div>
                <div className="form-group">
                  <label>Subject Code (optional)</label>
                  <input value={form.subjectCode} onChange={e => setForm({ ...form, subjectCode: e.target.value })} placeholder="e.g. CS201" />
                </div>
                {error && <div className="alert alert-error">{error}</div>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Create Subject</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Invite Link Modal */}
        {inviteInfo && (
          <div className="modal-overlay" onClick={() => setInviteInfo(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h3>🔗 Invite Link — {inviteInfo.subjectName}</h3>
              <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>Share this link with approved course students to let them join this subject.</p>
              <div style={{ background: '#f0f2f5', borderRadius: 8, padding: 12, fontSize: 12, wordBreak: 'break-all', fontFamily: 'monospace', marginBottom: 12 }}>
                {inviteLink}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={() => { navigator.clipboard.writeText(inviteLink); alert('Copied!'); }}>
                  📋 Copy
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => handleRegenerateToken(inviteInfo._id)}>
                  🔄 Regenerate Token
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => setInviteInfo(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
