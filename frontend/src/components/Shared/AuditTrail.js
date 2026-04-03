// frontend/src/components/Shared/AuditTrail.js
import { useState, useEffect } from 'react';
import { auditAPI } from '../../services/api';

const ACTION_COLORS = {
  UPLOAD: 'blue', VIEW: 'green', GRANT_ACCESS: 'purple',
  REVOKE_ACCESS: 'red', DELETE: 'red', LIST_RECORDS: 'gray',
};

export default function AuditTrail({ ehrId: propEhrId }) {
  const [ehrId,   setEhrId  ] = useState(propEhrId || '');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState('');

  useEffect(() => {
    if (propEhrId) loadHistory(propEhrId);
  }, [propEhrId]);

  const loadHistory = async (id) => {
    setLoading(true); setError('');
    try {
      const res = await auditAPI.getHistory(id || ehrId);
      setHistory(res.history || []);
      if (!res.history?.length) setError('No history found for this EHR ID.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="component-container">
      {!propEhrId && (
        <>
          <h2 className="section-title">Audit Trail</h2>
          <div className="search-bar">
            <input type="text" placeholder="Enter EHR ID to view its history..."
              value={ehrId} onChange={e => setEhrId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadHistory()} />
            <button className="btn btn-primary" onClick={() => loadHistory()} disabled={loading}>
              {loading ? 'Loading...' : '📜 Load History'}
            </button>
          </div>
        </>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <div className="loading-msg">Loading blockchain history...</div>}

      {history.length > 0 && (
        <div className="timeline">
          {history.map((entry, i) => (
            <div key={i} className="timeline-entry">
              <div className={`timeline-dot dot-${ACTION_COLORS[entry.value?.action] || 'gray'}`} />
              <div className="timeline-content">
                <div className="timeline-header">
                  <span className={`action-badge badge-${ACTION_COLORS[entry.value?.action] || 'gray'}`}>
                    {entry.value?.action || 'UNKNOWN'}
                  </span>
                  <span className="timeline-time">
                    {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'N/A'}
                  </span>
                </div>
                <p className="timeline-actor">
                  Actor: <code>{entry.value?.actorId?.slice(0, 40)}...</code> ({entry.value?.actorRole})
                </p>
                {entry.value?.details && <p className="timeline-details">{entry.value.details}</p>}
                <p className="timeline-tx">TX: <code>{entry.txId?.slice(0, 16)}...</code></p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
