import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register as registerAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await registerAPI(form);
      login(res.data);
      navigate(res.data.user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Create Account 🎓</h2>
        <p>Join the Classroom Platform</p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="" />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required placeholder="" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} placeholder="" />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} disabled={loading}>
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#888' }}>
          Have an account? <Link to="/login" style={{ color: '#4facfe' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
