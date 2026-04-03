// frontend/src/components/Hospital/PatientRecords.js
import { useState } from 'react';
import { ehrAPI, accessAPI } from '../../services/api';
import AuditTrail from '../Shared/AuditTrail';

const TYPE_COLORS = {
  lab_result: 'blue', prescription: 'green', imaging_report: 'purple',
  discharge_summary: 'amber', clinical_note: 'teal', vaccination_record: 'coral',
};

export default function PatientRecords() {
  const [patientId, setPatientId] = useState('');
  const [records, setRecords]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [selected, setSelected]   = useState(null);
  const [showAudit, setShowAudit] = useState(false);

  const search = async () => {
    if (!patientId.trim()) return;
    setLoading(true); setError(''); setRecords([]);
    try {
      const { records: recs } = await ehrAPI.getPatientRecords(patientId.trim());
      setRecords(recs || []);
      if (!recs?.length) setError('No records found for this patient ID.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const requestAccess = async (ehrId) => {
    try {
      await accessAPI.grant({ ehrId, requesterId: 'self', requesterOrg: '' });
      alert('Access request sent!');
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="component-container">
      <h2 className="section-title">Patient Records</h2>

      <div className="search-bar">
        <input
          type="text" placeholder="Enter Patient ID..."
          value={patientId}
          onChange={e => setPatientId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
        />
        <button className="btn btn-primary" onClick={search} disabled={loading}>
          {loading ? '🔍 Searching...' : '🔍 Search'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {records.length > 0 && (
        <div className="records-count">{records.length} record(s) found for patient <strong>{patientId}</strong></div>
      )}

      <div className="records-grid">
        {records.map(rec => (
          <div key={rec.ehrId} className={`record-card ${selected?.ehrId === rec.ehrId ? 'selected' : ''}`}
               onClick={() => setSelected(rec === selected ? null : rec)}>
            <div className="record-header">
              <span className={`record-type badge-${TYPE_COLORS[rec.recordType] || 'gray'}`}>
                {rec.recordType?.replace(/_/g, ' ')}
              </span>
              <span className="record-date">{new Date(rec.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="record-body">
              <p className="record-id">ID: <code>{rec.ehrId.slice(0, 12)}...</code></p>
              <p className="record-uploader">Uploaded by: {rec.uploaderOrg}</p>
              {rec.metadata?.doctorName && <p>Doctor: {rec.metadata.doctorName}</p>}
              {rec.metadata?.notes && <p className="record-notes">{rec.metadata.notes.slice(0, 80)}...</p>}
            </div>
            <div className="record-footer">
              <a href={ehrAPI.download(rec.ehrId)} target="_blank" rel="noreferrer"
                 className="btn btn-sm" onClick={e => e.stopPropagation()}>
                ⬇️ Download
              </a>
              <button className="btn btn-sm btn-outline"
                      onClick={e => { e.stopPropagation(); setShowAudit(rec.ehrId); }}>
                📜 Audit
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAudit && (
        <div className="modal-overlay" onClick={() => setShowAudit(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Audit Trail — {showAudit.slice(0, 12)}...</h3>
              <button onClick={() => setShowAudit(false)}>✕</button>
            </div>
            <AuditTrail ehrId={showAudit} />
          </div>
        </div>
      )}
    </div>
  );
}
