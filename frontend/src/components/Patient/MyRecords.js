// frontend/src/components/Patient/MyRecords.js
import { useState, useEffect } from 'react';
import { ehrAPI } from '../../services/api';

export default function MyRecords({ patientId }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError  ] = useState('');

  useEffect(() => {
    if (!patientId) return;
    ehrAPI.getPatientRecords(patientId)
      .then(({ records: r }) => setRecords(r || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <div className="loading-msg">Loading your records...</div>;
  if (error)   return <div className="alert alert-error">{error}</div>;
  if (!records.length) return (
    <div className="empty-state">
      <span className="empty-icon">📭</span>
      <p>No health records yet. Your hospital or doctor will upload records after your visit.</p>
    </div>
  );

  return (
    <div className="records-list">
      {records.map(rec => (
        <div key={rec.ehrId} className="record-row">
          <div className="record-row-left">
            <span className="record-icon">{iconFor(rec.recordType)}</span>
            <div>
              <p className="record-row-title">{rec.recordType?.replace(/_/g, ' ')}</p>
              <p className="record-row-meta">
                {new Date(rec.createdAt).toLocaleDateString()} · {rec.uploaderOrg}
                {rec.metadata?.doctorName && ` · Dr. ${rec.metadata.doctorName}`}
              </p>
            </div>
          </div>
          <div className="record-row-right">
            <span className="ipfs-badge">🔗 IPFS</span>
            <a href={ehrAPI.download(rec.ehrId)} target="_blank" rel="noreferrer"
               className="btn btn-sm">⬇️ Download</a>
          </div>
        </div>
      ))}
    </div>
  );
}

function iconFor(type) {
  const map = {
    lab_result: '🧪', prescription: '💊', imaging_report: '🩻',
    discharge_summary: '📋', clinical_note: '📝', vaccination_record: '💉',
    surgical_report: '🔪', pathology_report: '🔬',
  };
  return map[type] || '📄';
}
