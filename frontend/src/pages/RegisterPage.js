// frontend/src/pages/RegisterPage.js
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate     = useNavigate();
  const [form, setForm]     = useState({ name: '', email: '', password: '', role: 'patient' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">🏥</div>
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">Join MedChain Healthcare Network</p>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label>Full Name</label>
            <input type="text" required value={form.name}
              onChange={e => setForm({...form, name: e.target.value})}
              placeholder="Dr. Jane Smith" />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input type="email" required value={form.email}
              onChange={e => setForm({...form, email: e.target.value})}
              placeholder="you@hospital.com" />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input type="password" required value={form.password}
              onChange={e => setForm({...form, password: e.target.value})}
              placeholder="Min 8 characters" />
          </div>

          <div className="form-group">
            <label>Role</label>
            <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
              <option value="hospital">Hospital Admin</option>
            </select>
          </div>

          <div className="role-info">
            {form.role === 'patient'  && <p>🔵 Patients can view their own records and manage who can access them.</p>}
            {form.role === 'doctor'   && <p>🟢 Doctors can view patient records they've been granted access to and upload clinical notes.</p>}
            {form.role === 'hospital' && <p>🟣 Hospital admins can upload EHRs, manage access, and view audit trails.</p>}
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
