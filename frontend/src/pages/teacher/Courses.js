import React, { useEffect, useState } from 'react';
import Sidebar from '../../components/shared/Sidebar';
import { getMyCourses, createCourse, deleteCourse, addCoTeacher, exportStudentList } from '../../services/api';
import { useNavigate } from 'react-router-dom';

export default function CoursesPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCoTeacherModal, setShowCoTeacherModal] = useState(null);
  const [form, setForm] = useState({ courseName: '', courseId: '', description: '' });
  const [coTeacherEmail, setCoTeacherEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchCourses = async () => {
    try {
      const res = await getMyCourses();
      setCourses(res.data);
    } catch (err) {
      setError('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCourses(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createCourse(form);
      setShowModal(false);
      setForm({ courseName: '', courseId: '', description: '' });
      setSuccess('Course created!');
      fetchCourses();
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating course');
    }
  };

  const handleDelete = async (courseId) => {
    if (!window.confirm('Delete this course? This action cannot be undone.')) return;
    try {
      await deleteCourse(courseId);
      fetchCourses();
    } catch (err) {
      setError(err.response?.data?.message || 'Error deleting course');
    }
  };

  const handleAddCoTeacher = async (e) => {
    e.preventDefault();
    try {
      await addCoTeacher(showCoTeacherModal, { email: coTeacherEmail });
      setShowCoTeacherModal(null);
      setCoTeacherEmail('');
      setSuccess('Co-teacher added!');
      fetchCourses();
    } catch (err) {
      setError(err.response?.data?.message || 'Error adding co-teacher');
    }
  };

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <h1>📚 My Courses</h1>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Course</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {loading ? <div className="spinner" /> : (
          <div className="cards-grid">
            {courses.map(course => (
              <div className="item-card" key={course._id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div>
                    <div className="item-card-title">{course.courseName}</div>
                    <div className="item-card-sub">
                      ID: {course.courseId}
                    </div>
                    {course.description && <div className="item-card-desc">{course.description}</div>}
                  </div>
                  <span className="badge badge-success">Active</span>
                </div>
                <div className="item-card-meta">
                  Owner: {course.owner?.name}
                  {course.coTeachers?.length > 0 && <> • Co-teachers: {course.coTeachers.map(t => t.name).join(', ')}</>}
                </div>
                <div className="item-card-actions">
                  <button className="btn btn-outline btn-sm" onClick={() => navigate(`/teacher/enrollments/${course.courseId}`)}>
                    👥 Students
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => setShowCoTeacherModal(course.courseId)}>
                    ➕ Co-teacher
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => exportStudentList(course.courseId)}>
                    📥 Export
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(course.courseId)}>
                    🗑 Delete
                  </button>
                </div>
              </div>
            ))}
            {courses.length === 0 && (
              <div style={{ color: '#888', padding: 20 }}>No courses yet. Create your first course!</div>
            )}
          </div>
        )}

        {/* Create Course Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h3>Create New Course</h3>
              <form onSubmit={handleCreate}>
                <div className="form-group">
                  <label>Course Name</label>
                  <input value={form.courseName} onChange={e => setForm({ ...form, courseName: e.target.value })} required placeholder="e.g. Computer Science 101" />
                </div>
                <div className="form-group">
                  <label>Course ID (unique, students will use this to enroll)</label>
                  <input value={form.courseId} onChange={e => setForm({ ...form, courseId: e.target.value.toUpperCase() })} required placeholder="e.g. CS101-2024" />
                </div>
                <div className="form-group">
                  <label>Description (optional)</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Course description..." rows={3} style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }} />
                </div>
                {error && <div className="alert alert-error">{error}</div>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Create Course</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Co-teacher Modal */}
        {showCoTeacherModal && (
          <div className="modal-overlay" onClick={() => setShowCoTeacherModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h3>Add Co-Teacher</h3>
              <form onSubmit={handleAddCoTeacher}>
                <div className="form-group">
                  <label>Teacher Email</label>
                  <input type="email" value={coTeacherEmail} onChange={e => setCoTeacherEmail(e.target.value)} required placeholder="teacher@email.com" />
                </div>
                {error && <div className="alert alert-error">{error}</div>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowCoTeacherModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Add Co-Teacher</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
