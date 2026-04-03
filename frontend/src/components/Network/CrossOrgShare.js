// frontend/src/components/Network/CrossOrgShare.js
import { useState, useEffect, useCallback } from 'react';
import { networkAPI } from '../../services/networkApi';

const STATUS_META = {
  pending:  { color: 'amber',  label: 'Pending',  icon: '⏳' },
  approved: { color: 'green',  label: 'Approved', icon: '✅' },
  rejected: { color: 'red',    label: 'Rejected', icon: '❌' },
  revoked:  { color: 'gray',   label: 'Revoked',  icon: '🚫' },
};

export default function CrossOrgShare({ orgMsp }) {
  const [tab, setTab]               = useState('send');
  const [orgs, setOrgs]             = useState([]);
  const [pending, setPending]       = useState([]);
  const [ehrRequests, setEhrRequests] = useState([]);
  const [msg, setMsg]               = useState('');
  const [loading, setLoading]       = useState(false);

  // Send form state
  const [sendForm, setSendForm] = useState({
    ehrId: '', toOrgId: '', toUserId: '', reason: '', expiresAt: ''
  });

  // Check EHR form
  const [checkEhrId, setCheckEhrId] = useState('');

  const loadPending = useCallback(async () => {
    try {
      const data = await networkAPI.getPendingRequests();
      setPending(data.requests || []);
    } catch { setPending([]); }
  }, []);

  const loadOrgs = useCallback(async () => {
    try {
      const data = await networkAPI.getAllOrgs();
      setOrgs((data.orgs || []).filter(o => o.orgId !== orgMsp && o.status === 'active' && o.channelJoined));
    } catch { setOrgs([]); }
  }, [orgMsp]);

  useEffect(() => {
    loadOrgs();
    loadPending();
  }, [loadOrgs, loadPending]);

  const handleSend = async (e) => {
    e.preventDefault();
    setMsg(''); setLoading(true);
    try {
      const res = await networkAPI.createShareRequest({
        ehrId:     sendForm.ehrId,
        toOrgId:   sendForm.toOrgId,
        toUserId:  sendForm.toUserId || 'any',
        reason:    sendForm.reason,
        expiresAt: sendForm.expiresAt || null,
      });
      setMsg(`✅ Share request sent! Request ID: ${res.requestId}`);
      setSendForm({ ehrId: '', toOrgId: '', toUserId: '', reason: '', expiresAt: '' });
      loadPending();
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    } finally { setLoading(false); }
  };

  const handleAction = async (requestId, action, reason) => {
    setMsg(''); setLoading(true);
    try {
      if (action === 'approve') await networkAPI.approveShareRequest(requestId);
      if (action === 'reject')  await networkAPI.rejectShareRequest(requestId, reason);
      if (action === 'revoke')  await networkAPI.revokeShareRequest(requestId);
      setMsg(`✅ Request ${action}d successfully.`);
      loadPending();
      if (checkEhrId) loadEhrRequests(checkEhrId);
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    } finally { setLoading(false); }
  };

  const loadEhrRequests = async (ehrId) => {
    try {
      const data = await networkAPI.getEHRShareRequests(ehrId);
      setEhrRequests(data.requests || []);
    } catch { setEhrRequests([]); }
  };

  return (
    <div className="component-container">
      <h2 className="section-title">Cross-Org EHR Sharing</h2>
      <p className="section-desc">
        Share a patient's EHR with another hospital or entity on the network.
        The receiving org must approve the request before access is granted on-chain.
      </p>

      <div className="sub-tabs">
        <button className={`sub-tab ${tab==='send'?'active':''}`}    onClick={()=>setTab('send')}>📤 Send Request</button>
        <button className={`sub-tab ${tab==='inbox'?'active':''}`}   onClick={()=>setTab('inbox')}>
          📥 Inbox {pending.filter(r=>r.toOrgId===orgMsp).length > 0 &&
            <span className="inbox-badge">{pending.filter(r=>r.toOrgId===orgMsp).length}</span>}
        </button>
        <button className={`sub-tab ${tab==='outbox'?'active':''}`}  onClick={()=>setTab('outbox')}>📨 Sent</button>
        <button className={`sub-tab ${tab==='lookup'?'active':''}`}  onClick={()=>setTab('lookup')}>🔍 EHR lookup</button>
      </div>

      {msg && (
        <div className={`alert ${msg.startsWith('✅') ? 'alert-success' : 'alert-error'}`}>
          {msg}
        </div>
      )}

      {/* Send tab */}
      {tab === 'send' && (
        <form onSubmit={handleSend} className="share-form">
          <div className="form-group">
            <label>EHR ID to share *</label>
            <input type="text" required value={sendForm.ehrId}
                   onChange={e => setSendForm({...sendForm, ehrId: e.target.value})}
                   placeholder="EHR UUID" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Target Organisation *</label>
              <select required value={sendForm.toOrgId}
                      onChange={e => setSendForm({...sendForm, toOrgId: e.target.value})}>
                <option value="">— Select organisation —</option>
                {orgs.map(o => (
                  <option key={o.orgId} value={o.orgId}>
                    {o.orgName} ({o.orgId})
                  </option>
                ))}
              </select>
              {orgs.length === 0 && (
                <span className="field-hint">No active orgs found. Register one first via Network Registry.</span>
              )}
            </div>
            <div className="form-group">
              <label>Specific recipient (optional)</label>
              <input type="text" value={sendForm.toUserId}
                     onChange={e => setSendForm({...sendForm, toUserId: e.target.value})}
                     placeholder="doctor_fabricId or leave blank for any" />
            </div>
          </div>
          <div className="form-group">
            <label>Clinical reason *</label>
            <textarea rows={2} required value={sendForm.reason}
                      onChange={e => setSendForm({...sendForm, reason: e.target.value})}
                      placeholder="e.g. Patient referred to specialist at City General Hospital for cardiology review" />
          </div>
          <div className="form-group">
            <label>Access expires at (optional)</label>
            <input type="datetime-local" value={sendForm.expiresAt}
                   onChange={e => setSendForm({...sendForm, expiresAt: e.target.value})} />
            <span className="field-hint">Leave blank for indefinite access</span>
          </div>

          {sendForm.toOrgId && (
            <div className="target-org-preview">
              <OrgPreview orgId={sendForm.toOrgId} orgs={orgs} />
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '⏳ Submitting to blockchain...' : '📤 Send Share Request'}
          </button>

          <div className="security-note">
            🔒 This creates an on-chain record. The receiving org admin will see it in their inbox
            and must explicitly approve before any data transfer occurs.
          </div>
        </form>
      )}

      {/* Inbox tab */}
      {tab === 'inbox' && (
        <div>
          <p className="section-desc">Incoming share requests from other organisations.</p>
          {pending.filter(r => r.toOrgId === orgMsp).length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📭</span>
              <p>No pending incoming requests</p>
            </div>
          ) : (
            <div className="requests-list">
              {pending.filter(r => r.toOrgId === orgMsp).map(req => (
                <RequestCard key={req.requestId} req={req} side="receiver"
                             onAction={handleAction} loading={loading} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Outbox tab */}
      {tab === 'outbox' && (
        <div>
          <p className="section-desc">Share requests you have sent to other organisations.</p>
          {pending.filter(r => r.fromOrgId === orgMsp).length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📫</span>
              <p>No outgoing requests</p>
            </div>
          ) : (
            <div className="requests-list">
              {pending.filter(r => r.fromOrgId === orgMsp).map(req => (
                <RequestCard key={req.requestId} req={req} side="sender"
                             onAction={handleAction} loading={loading} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* EHR lookup tab */}
      {tab === 'lookup' && (
        <div>
          <div className="search-bar" style={{ marginBottom: '1.5rem' }}>
            <input type="text" placeholder="Enter EHR ID to see all share requests..."
                   value={checkEhrId} onChange={e => setCheckEhrId(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && loadEhrRequests(checkEhrId)} />
            <button className="btn btn-primary" onClick={() => loadEhrRequests(checkEhrId)}>
              🔍 Load
            </button>
          </div>
          {ehrRequests.length > 0 && (
            <div className="requests-list">
              {ehrRequests.map(req => (
                <RequestCard key={req.requestId} req={req} side="view"
                             onAction={handleAction} loading={loading} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── OrgPreview ─────────────────────────────────────────────────────────────
function OrgPreview({ orgId, orgs }) {
  const org = orgs.find(o => o.orgId === orgId);
  if (!org) return null;
  return (
    <div className="org-preview-card">
      <strong>🏥 {org.orgName}</strong>
      <span>{org.orgId}</span>
      {org.contact?.email && <span>{org.contact.email}</span>}
      {org.peerEndpoint && <code>{org.peerEndpoint}</code>}
    </div>
  );
}

// ── RequestCard ───────────────────────────────────────────────────────────
function RequestCard({ req, side, onAction, loading }) {
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const meta = STATUS_META[req.status] || STATUS_META.pending;

  return (
    <div className="request-card">
      <div className="request-card-header">
        <div>
          <div className="request-card-title">
            <span className={`statusbadge sb-${meta.color}`}>{meta.icon} {meta.label}</span>
            <code className="req-id">{req.requestId.slice(0, 12)}…</code>
          </div>
          <p className="request-route">
            <strong>{req.fromOrgId}</strong> → <strong>{req.toOrgId}</strong>
          </p>
        </div>
        <span className="request-date">{new Date(req.requestedAt).toLocaleString()}</span>
      </div>

      <div className="request-card-body">
        <div className="req-detail"><span>EHR ID</span><code>{req.ehrId}</code></div>
        <div className="req-detail"><span>Reason</span><span>{req.reason}</span></div>
        {req.toUserId && req.toUserId !== 'any' && (
          <div className="req-detail"><span>Recipient</span><code>{req.toUserId}</code></div>
        )}
        {req.expiresAt && (
          <div className="req-detail"><span>Expires</span><span>{new Date(req.expiresAt).toLocaleString()}</span></div>
        )}
        {req.rejectReason && (
          <div className="req-detail"><span>Reject reason</span><span>{req.rejectReason}</span></div>
        )}
      </div>

      {req.status === 'pending' && (
        <div className="request-card-actions">
          {side === 'receiver' && (
            <>
              <button className="btn btn-primary btn-sm" disabled={loading}
                      onClick={() => onAction(req.requestId, 'approve')}>
                ✅ Approve
              </button>
              {!showReject ? (
                <button className="btn btn-sm" style={{ background: 'var(--red-bg)', color: 'var(--red-dk)', border: '1px solid var(--red-dk)' }}
                        onClick={() => setShowReject(true)}>
                  ❌ Reject
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                  <input type="text" placeholder="Rejection reason..."
                         value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                         style={{ flex:1, padding:'4px 8px', border:'1.5px solid var(--border)', borderRadius:'6px', fontSize:'.82rem' }} />
                  <button className="btn btn-sm" style={{ background:'var(--red)', color:'#fff', border:'none' }}
                          onClick={() => { onAction(req.requestId, 'reject', rejectReason); setShowReject(false); }}>
                    Confirm
                  </button>
                  <button className="btn btn-sm btn-outline" onClick={() => setShowReject(false)}>Cancel</button>
                </div>
              )}
            </>
          )}
          {side === 'sender' && (
            <button className="btn btn-sm btn-outline" disabled={loading}
                    onClick={() => onAction(req.requestId, 'revoke')}>
              🚫 Revoke
            </button>
          )}
        </div>
      )}
      {req.status === 'approved' && side !== 'view' && (
        <div className="request-card-actions">
          <button className="btn btn-sm btn-outline" disabled={loading}
                  onClick={() => onAction(req.requestId, 'revoke')}>
            🚫 Revoke access
          </button>
        </div>
      )}
    </div>
  );
}
