// frontend/src/components/Shared/Navbar.js
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <span className="brand-icon">⛓️</span>
        <span className="brand-name">MedChain</span>
        <span className="brand-tag">EHR</span>
      </Link>

      <div className="navbar-center">
        {user && (
          <span className="blockchain-indicator">
            <span className="chain-dot" />
            Hyperledger Fabric · ehr-channel
          </span>
        )}
      </div>

      <div className="navbar-right">
        {user ? (
          <>
            <span className={`nav-role role-${user.role}`}>{user.role}</span>
            <span className="nav-user">{user.email}</span>
            <button className="btn btn-sm btn-outline" onClick={handleLogout}>Sign out</button>
          </>
        ) : (
          <>
            <Link to="/login"    className="btn btn-sm btn-outline">Sign in</Link>
            <Link to="/register" className="btn btn-sm btn-primary">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
