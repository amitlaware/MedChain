// frontend/src/pages/DoctorDashboard.js
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PatientRecords from '../components/Hospital/PatientRecords';
import AccessManager  from '../components/Shared/AccessManager';
import AuditTrail     from '../components/Shared/AuditTrail';
import StatsCard      from '../components/Shared/StatsCard';
import UploadEHR      from '../components/Hospital/UploadEHR';
import OrgRegistry    from '../components/Network/OrgRegistry';
import CrossOrgShare  from '../components/Network/CrossOrgShare';
import '../NetworkStyles.css';

const TABS = ['Overview', 'Patient Records', 'Upload Note', 'Access Manager', 'Network Registry', 'Cross-Org Share', 'Audit Trail'];

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('Overview');

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Doctor Portal</h1>
          <p className="dashboard-subtitle">Dr. {user?.name || user?.email} · {user?.orgMsp}</p>
        </div>
        <span className="role-badge role-doctor">Doctor</span>
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
        {activeTab === 'Overview' && (
          <div>
            <div className="stats-grid">
              <StatsCard label="My Patients"     value={24}  icon="👥" color="blue"   onClick={() => setActiveTab('Patient Records')} />
              <StatsCard label="Records Accessed" value={87} icon="📂" color="green"  onClick={() => setActiveTab('Patient Records')} />
              <StatsCard label="Notes Uploaded"  value={31}  icon="📝" color="purple" onClick={() => setActiveTab('Upload Note')} />
              <StatsCard label="Access Requests" value={3}   icon="🔑" color="amber"  onClick={() => setActiveTab('Access Manager')} />
            </div>
            <div className="info-card">
              <h3>My Patients Today</h3>
              <p className="muted">No appointments scheduled. Access patient records via the Records tab.</p>
            </div>
          </div>
        )}
        {activeTab === 'Patient Records' && <PatientRecords />}
        {activeTab === 'Upload Note'     && <UploadEHR />}
        {activeTab === 'Access Manager'  && <AccessManager role="doctor" />}
        {activeTab === 'Network Registry'&& <OrgRegistry userRole="doctor" />}
        {activeTab === 'Cross-Org Share' && <CrossOrgShare orgMsp={user?.orgMsp} />}
        {activeTab === 'Audit Trail'     && <AuditTrail />}
      </div>
    </div>
  );
}
