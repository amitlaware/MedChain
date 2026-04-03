// frontend/src/App.js
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage    from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HospitalDashboard from './pages/HospitalDashboard';
import DoctorDashboard   from './pages/DoctorDashboard';
import PatientDashboard  from './pages/PatientDashboard';
import Navbar from './components/Shared/Navbar';
import './App.css';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!user)   return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function DashboardRouter() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  switch (user.role) {
    case 'hospital': return <Navigate to="/hospital" replace />;
    case 'doctor':   return <Navigate to="/doctor"   replace />;
    case 'patient':  return <Navigate to="/patient"  replace />;
    default:         return <Navigate to="/login"    replace />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/"         element={<DashboardRouter />} />
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route path="/hospital" element={
              <ProtectedRoute roles={['hospital']}>
                <HospitalDashboard />
              </ProtectedRoute>
            } />
            <Route path="/doctor" element={
              <ProtectedRoute roles={['doctor']}>
                <DoctorDashboard />
              </ProtectedRoute>
            } />
            <Route path="/patient" element={
              <ProtectedRoute roles={['patient']}>
                <PatientDashboard />
              </ProtectedRoute>
            } />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}
