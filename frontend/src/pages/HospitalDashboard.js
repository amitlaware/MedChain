// frontend/src/pages/HospitalDashboard.js
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import UploadEHR      from '../components/Hospital/UploadEHR';
import PatientRecords from '../components/Hospital/PatientRecords';
import AccessManager  from '../components/Shared/AccessManager';
import AuditTrail     from '../components/Shared/AuditTrail';
import StatsCard      from '../components/Shared/StatsCard';
import OrgRegistry    from '../components/Network/OrgRegistry';
import CrossOrgShare  from '../components/Network/CrossOrgShare';
import '../NetworkStyles.css';

const TABS = ['Overview', 'Upload EHR', 'Patient Records', 'Access Manager', 'Network Registry', 'Cross-Org Share', 'Audit Trail'];

export default function HospitalDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('Overview');
  const [stats] = useState({ records: 142, patients: 38, doctors: 12, pending: 5 });

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Hospital Portal</h1>
          <p className="dashboard-subtitle">Welcome, {user?.name || user?.email} · {user?.orgMsp}</p>
        </div>
        <span className="role-badge role-hospital">Hospital Admin</span>
      </div>

      {/* Tab navigation */}
      <nav className="tab-nav">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="tab-content">
        {activeTab === 'Overview' && (
          <div>
            <div className="stats-grid">
              <StatsCard label="Total EHR Records" value={stats.records} icon="📋" color="blue" />
              <StatsCard label="Registered Patients" value={stats.patients} icon="👥" color="green" />
              <StatsCard label="Active Doctors" value={stats.doctors} icon="🩺" color="purple" />
              <StatsCard label="Pending Requests" value={stats.pending} icon="⏳" color="amber" />
            </div>
            <div className="info-card">
              <h3>Quick Actions</h3>
              <div className="quick-actions">
                <button className="action-btn" onClick={() => setActiveTab('Upload EHR')}>
                  ➕ Upload New Record
                </button>
                <button className="action-btn" onClick={() => setActiveTab('Patient Records')}>
                  🔍 Search Patient Records
                </button>
                <button className="action-btn" onClick={() => setActiveTab('Access Manager')}>
                  🔐 Manage Permissions
                </button>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'Upload EHR'        && <UploadEHR />}
        {activeTab === 'Patient Records'   && <PatientRecords />}
        {activeTab === 'Access Manager'    && <AccessManager role="hospital" />}
        {activeTab === 'Network Registry'  && <OrgRegistry userRole="hospital" />}
        {activeTab === 'Cross-Org Share'   && <CrossOrgShare orgMsp={user?.orgMsp} />}
        {activeTab === 'Audit Trail'       && <AuditTrail />}
      </div>
    </div>
  );
}
