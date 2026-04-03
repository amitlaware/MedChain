// frontend/src/components/Network/OrgRegistry.js
import { useState, useEffect, useCallback } from 'react';
import { networkAPI } from '../../services/networkApi';

const TYPE_META = {
  hospital:  { label: 'Hospital',  color: 'purple', icon: '🏥' },
  doctor:    { label: 'Doctor',    color: 'green',  icon: '🩺' },
  patient:   { label: 'Patient',   color: 'blue',   icon: '👤' },
  lab:       { label: 'Lab',       color: 'amber',  icon: '🔬' },
  insurance: { label: 'Insurance', color: 'teal',   icon: '🛡️' },
  pharmacy:  { label: 'Pharmacy',  color: 'coral',  icon: '💊' },
};

const STATUS_COLOR = { active: 'green', suspended: 'amber', removed: 'red' };

export default function OrgRegistry({ userRole }) {
  const [orgs, setOrgs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch]       = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [selected, setSelected]   = useState(null);
  const [actionMsg, setActionMsg] = useState('');

  const loadOrgs = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await networkAPI.getAllOrgs();
      setOrgs(data.orgs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrgs(); }, [loadOrgs]);

  const handleApprove = async (orgId) => {
    try {
      await networkAPI.approveOrg(orgId, 2);
      setActionMsg(`✅ Approval submitted for ${orgId}`);
      await loadOrgs();
    } catch (err) {
      setActionMsg(`❌ ${err.message}`);
    }
  };

  const handleStatusChange = async (orgId, status) => {
    try {
      await networkAPI.updateOrgStatus(orgId, status);
      setActionMsg(`✅ Status updated to "${status}"`);
      await loadOrgs();
    } catch (err) {
      setActionMsg(`❌ ${err.message}`);
    }
  };

  const filtered = orgs.filter(o => {
    const matchType   = filterType === 'all' || o.orgType === filterType;
    const matchSearch = !search || o.orgName.toLowerCase().includes(search.toLowerCase()) ||
                        o.orgId.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="component-container">
      <div className="section-header">
        <div>
          <h2 className="section-title">Network Registry</h2>
          <p className="section-desc">
            All organisations currently on the Hyperledger Fabric ehr-channel.
            Add a new hospital or other entity to enable cross-org EHR sharing.
          </p>
        </div>
        {userRole === 'hospital' && (
          <button className="btn btn-primary" onClick={() => setShowRegister(true)}>
            ➕ Register New Org
          </button>
        )}
      </div>

      {actionMsg && (
        <div className={`alert ${actionMsg.startsWith('✅') ? 'alert-success' : 'alert-error'}`}
             style={{ marginBottom: '1rem' }}>
          {actionMsg}
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Filters */}
      <div className="filter-bar">
        <input
          type="text" placeholder="Search org name or ID..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="search-input"
        />
        <div className="type-filters">
          {['all', ...Object.keys(TYPE_META)].map(t => (
            <button
              key={t}
              className={`type-filter-btn ${filterType === t ? 'active' : ''}`}
              onClick={() => setFilterType(t)}
            >
              {t === 'all' ? 'All' : `${TYPE_META[t].icon} ${TYPE_META[t].label}`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-msg">Loading network registry from blockchain...</div>
      ) : (
        <>
          <div className="orgs-count">{filtered.length} organisation(s) on network</div>
          <div className="orgs-grid">
            {filtered.map(org => (
              <OrgCard
                key={org.orgId}
                org={org}
                isSelected={selected?.orgId === org.orgId}
                onClick={() => setSelected(selected?.orgId === org.orgId ? null : org)}
                onApprove={handleApprove}
                onStatusChange={handleStatusChange}
                userRole={userRole}
              />
            ))}
            {filtered.length === 0 && (
              <div className="empty-state">
                <span className="empty-icon">🌐</span>
                <p>No organisations found. Register the first one to get started.</p>
              </div>
            )}
          </div>
        </>
      )}

      {showRegister && (
        <RegisterOrgModal
          onClose={() => setShowRegister(false)}
          onSuccess={() => { setShowRegister(false); loadOrgs(); setActionMsg('✅ Organisation registered on blockchain!'); }}
        />
      )}
    </div>
  );
}

// ── Org Card ──────────────────────────────────────────────────────────────────
function OrgCard({ org, isSelected, onClick, onApprove, onStatusChange, userRole }) {
  const meta = TYPE_META[org.orgType] || { label: org.orgType, color: 'gray', icon: '🏢' };

  return (
    <div className={`org-card ${isSelected ? 'selected' : ''}`} onClick={onClick}>
      <div className="org-card-top">
        <span className="org-icon" style={{ fontSize: 16 }}>{meta.icon}</span>
        <div className="org-card-title-area">
          <h3 className="org-name">{org.orgName}</h3>
          <code className="org-id">{org.orgId}</code>
        </div>
        <span className={`status-dot status-${STATUS_COLOR[org.status] || 'gray'}`} />
      </div>

      <div className="org-badges">
        <span className={`typebadge tb-${meta.color}`}>{meta.label}</span>
        <span className={`statusbadge sb-${STATUS_COLOR[org.status] || 'gray'}`}>{org.status}</span>
        {org.channelJoined && <span className="channelbadge">⛓️ on-chain</span>}
      </div>

      {isSelected && (
        <div className="org-detail" onClick={e => e.stopPropagation()}>
          <div className="detail-row"><span>Peer endpoint</span><code>{org.peerEndpoint || '—'}</code></div>
          <div className="detail-row"><span>Registered by</span><code>{org.registeredBy?.slice(0, 36)}…</code></div>
          <div className="detail-row"><span>Registered at</span><span>{new Date(org.registeredAt).toLocaleString()}</span></div>
          {org.contact?.email && <div className="detail-row"><span>Contact</span><span>{org.contact.email}</span></div>}
          {org.contact?.address && <div className="detail-row"><span>Address</span><span>{org.contact.address}</span></div>}
          <div className="detail-row">
            <span>Approvals</span>
            <span>{org.approvedBy?.length || 0} of 2 required — {org.channelJoined ? '✅ approved' : '⏳ pending'}</span>
          </div>

          {userRole === 'hospital' && (
            <div className="org-actions">
              {!org.channelJoined && (
                <button className="btn btn-primary btn-sm" onClick={() => onApprove(org.orgId)}>
                  ✅ Approve Org
                </button>
              )}
              {org.status === 'active' && (
                <button className="btn btn-sm" style={{ background: 'var(--amber-bg)', color: 'var(--amber-dk)', border: '1px solid var(--amber-dk)' }}
                        onClick={() => onStatusChange(org.orgId, 'suspended')}>
                  ⏸ Suspend
                </button>
              )}
              {org.status === 'suspended' && (
                <button className="btn btn-primary btn-sm" onClick={() => onStatusChange(org.orgId, 'active')}>
                  ▶ Re-activate
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Register Org Modal ────────────────────────────────────────────────────────
function RegisterOrgModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    orgId: '', orgName: '', orgType: 'hospital',
    email: '', phone: '', address: '', peerEndpoint: '', tlsCert: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [step, setStep]       = useState(1); // 1=details 2=technical 3=confirm

  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      await networkAPI.registerOrg({
        orgId:    form.orgId,
        orgName:  form.orgName,
        orgType:  form.orgType,
        contact:  { email: form.email, phone: form.phone, address: form.address },
        peerEndpoint: form.peerEndpoint,
        tlsCert:      form.tlsCert,
      });
      onSuccess();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Register New Organisation</h3>
          <button onClick={onClose}>✕</button>
        </div>

        {/* Step indicator */}
        <div className="steps-indicator">
          {['Organisation details', 'Technical config', 'Confirm & submit'].map((s, i) => (
            <div key={i} className={`step-item ${step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}`}>
              <span className="step-num">{step > i + 1 ? '✓' : i + 1}</span>
              <span className="step-label">{s}</span>
            </div>
          ))}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {step === 1 && (
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label>MSP / Org ID *</label>
                <input type="text" value={form.orgId} onChange={set('orgId')}
                       placeholder="e.g. Hospital2MSP" />
                <span className="field-hint">Must match the MSP ID in crypto material</span>
              </div>
              <div className="form-group">
                <label>Organisation Type *</label>
                <select value={form.orgType} onChange={set('orgType')}>
                  {Object.entries(TYPE_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Organisation Name *</label>
              <input type="text" value={form.orgName} onChange={set('orgName')}
                     placeholder="e.g. City General Hospital" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Contact Email *</label>
                <input type="email" value={form.email} onChange={set('email')}
                       placeholder="admin@hospital2.com" />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input type="tel" value={form.phone} onChange={set('phone')}
                       placeholder="+91 98765 43210" />
              </div>
            </div>
            <div className="form-group">
              <label>Address</label>
              <input type="text" value={form.address} onChange={set('address')}
                     placeholder="123 Healthcare Ave, Mumbai" />
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary"
                      disabled={!form.orgId || !form.orgName || !form.email}
                      onClick={() => setStep(2)}>
                Next →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="modal-body">
            <div className="info-banner">
              ℹ️ Run <code>./blockchain/scripts/add-org.sh {form.orgId.replace('MSP','')} {form.orgId.replace('MSP','').toLowerCase()} 10051</code> first
              to generate crypto material and join the peer to the channel, then fill in these details.
            </div>
            <div className="form-group">
              <label>Peer Endpoint</label>
              <input type="text" value={form.peerEndpoint} onChange={set('peerEndpoint')}
                     placeholder="peer0.hospital2.ehr.com:10051" />
            </div>
            <div className="form-group">
              <label>TLS CA Certificate (PEM)</label>
              <textarea rows={5} value={form.tlsCert} onChange={set('tlsCert')}
                        placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----" />
              <span className="field-hint">
                Found at: crypto-config/peerOrganizations/{form.orgId.toLowerCase()}.ehr.com/ca/ca.cert.pem
              </span>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" onClick={() => setStep(3)}>Next →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="modal-body">
            <div className="confirm-summary">
              <h4>Review before submitting to blockchain</h4>
              <table className="confirm-table">
                <tbody>
                  <tr><td>Org ID</td><td><code>{form.orgId}</code></td></tr>
                  <tr><td>Name</td><td>{form.orgName}</td></tr>
                  <tr><td>Type</td><td>{TYPE_META[form.orgType]?.icon} {TYPE_META[form.orgType]?.label}</td></tr>
                  <tr><td>Contact</td><td>{form.email}</td></tr>
                  <tr><td>Peer</td><td><code>{form.peerEndpoint || 'not set'}</code></td></tr>
                </tbody>
              </table>
              <div className="confirm-note">
                This will call <code>registerOrg</code> on the org-registry chaincode. The transaction
                will be endorsed by 2 of 3 existing orgs and permanently recorded on the ledger.
                2 hospital admins must then call <strong>Approve Org</strong> before this org can receive shares.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setStep(2)}>← Back</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                {loading ? '⏳ Submitting to blockchain...' : '✅ Register Organisation'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
