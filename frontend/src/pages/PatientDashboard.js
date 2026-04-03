// frontend/src/pages/PatientDashboard.js
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ehrAPI } from '../services/api';
import MyRecords     from '../components/Patient/MyRecords';
import AccessManager from '../components/Shared/AccessManager';
import AuditTrail    from '../components/Shared/AuditTrail';
import StatsCard     from '../components/Shared/StatsCard';

const TABS = ['My Records', 'Permissions', 'Access History'];

export default function PatientDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('My Records');
  const [recordCount, setRecordCount] = useState(0);

  useEffect(() => {
    if (user) {
      ehrAPI.getPatientRecords(user.userId)
        .then(({ records }) => setRecordCount(records?.length || 0))
        .catch(() => {});
    }
  }, [user]);

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Patient Portal</h1>
          <p className="dashboard-subtitle">{user?.name || user?.email} · Your health records, under your control</p>
        </div>
        <span className="role-badge role-patient">Patient</span>
      </div>

      <nav className="tab-nav">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >{tab}</button>
        ))}
      </nav>

      <div className="tab-content">
        {activeTab === 'My Records' && (
          <>
            <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
              <StatsCard label="Total Records"       value={recordCount} icon="📋" color="blue"   />
              <StatsCard label="Doctors with Access" value={3}           icon="🩺" color="green"  />
              <StatsCard label="Hospitals"           value={1}           icon="🏥" color="purple" />
              <StatsCard label="Pending Requests"    value={0}           icon="🔔" color="amber"  />
            </div>
            <MyRecords patientId={user?.userId} />
          </>
        )}
        {activeTab === 'Permissions'    && <AccessManager role="patient" />}
        {activeTab === 'Access History' && <AuditTrail />}
      </div>
    </div>
  );
}
