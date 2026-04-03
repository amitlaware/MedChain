// frontend/src/components/Shared/AccessManager.js
import { useState } from 'react';
import { accessAPI } from '../../services/api';

export default function AccessManager({ role }) {
  const [tab, setTab] = useState('grant');
  const [grantForm, setGrantForm] = useState({ ehrId: '', requesterId: '', requesterOrg: '', expiresAt: '' });
  const [revokeForm, setRevokeForm] = useState({ ehrId: '', requesterId: '' });
  const [checkForm, setCheckForm]   = useState({ ehrId: '', requesterId: '' });
  const [result, setResult] = useState(null);
  const [error,  setError ] = useState('');
  const [loading, setLoading] = useState(false);

  const clear = () => { setResult(null); setError(''); };

  const handleGrant = async (e) => {
    e.preventDefault(); clear(); setLoading(true);
    try {
      const res = await accessAPI.grant({
        ehrId:        grantForm.ehrId,
        requesterId:  grantForm.requesterId,
        requesterOrg: grantForm.requesterOrg,
        expiresAt:    grantForm.expiresAt || null,
      });
      setResult({ type: 'success', message: `✅ Access granted to ${grantForm.requesterId}`, data: res });
      setGrantForm({ ehrId: '', requesterId: '', requesterOrg: '', expiresAt: '' });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleRevoke = async (e) => {
    e.preventDefault(); clear(); setLoading(true);
    try {
      const res = await accessAPI.revoke(revokeForm);
      setResult({ type: 'success', message: `✅ Access revoked from ${revokeForm.requesterId}`, data: res });
      setRevokeForm({ ehrId: '', requesterId: '' });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleCheck = async (e) => {
    e.preventDefault(); clear(); setLoading(true);
    try {
      const res = await accessAPI.check(checkForm.ehrId, checkForm.requesterId);
      setResult({ type: res.hasAccess ? 'success' : 'warning',
        message: res.hasAccess ? '✅ Access is ACTIVE' : '❌ No active access found', data: res });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="component-container">
      <h2 className="section-title">Access Manager</h2>
      <p className="section-desc">
        {role === 'patient' ? 'Control who can view your health records.' :
         'Manage access permissions for records you uploaded.'}
      </p>

      <div className="sub-tabs">
        {['grant', 'revoke', 'check'].map(t => (
          <button key={t} className={`sub-tab ${tab === t ? 'active' : ''}`}
                  onClick={() => { setTab(t); clear(); }}>
            {t === 'grant' ? '🔓 Grant' : t === 'revoke' ? '🔒 Revoke' : '🔍 Check'}
          </button>
        ))}
      </div>

      {result && <div className={`alert alert-${result.type}`}>{result.message}</div>}
      {error  && <div className="alert alert-error">{error}</div>}

      {tab === 'grant' && (
        <form onSubmit={handleGrant} className="access-form">
          <div className="form-group">
            <label>EHR ID *</label>
            <input type="text" required placeholder="EHR UUID"
              value={grantForm.ehrId} onChange={e => setGrantForm({...grantForm, ehrId: e.target.value})} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Requester ID *</label>
              <input type="text" required placeholder="doctor@hospital.com_doctor"
                value={grantForm.requesterId} onChange={e => setGrantForm({...grantForm, requesterId: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Requester Org</label>
              <input type="text" placeholder="DoctorMSP"
                value={grantForm.requesterOrg} onChange={e => setGrantForm({...grantForm, requesterOrg: e.target.value})} />
            </div>
          </div>
          <div className="form-group">
            <label>Expires At (optional)</label>
            <input type="datetime-local"
              value={grantForm.expiresAt} onChange={e => setGrantForm({...grantForm, expiresAt: e.target.value})} />
            <span className="field-hint">Leave blank for indefinite access</span>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Processing...' : '🔓 Grant Access'}
          </button>
        </form>
      )}

      {tab === 'revoke' && (
        <form onSubmit={handleRevoke} className="access-form">
          <div className="form-group">
            <label>EHR ID *</label>
            <input type="text" required placeholder="EHR UUID"
              value={revokeForm.ehrId} onChange={e => setRevokeForm({...revokeForm, ehrId: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Requester ID to Revoke *</label>
            <input type="text" required placeholder="doctor@hospital.com_doctor"
              value={revokeForm.requesterId} onChange={e => setRevokeForm({...revokeForm, requesterId: e.target.value})} />
          </div>
          <button type="submit" className="btn btn-danger" disabled={loading}>
            {loading ? 'Processing...' : '🔒 Revoke Access'}
          </button>
        </form>
      )}

      {tab === 'check' && (
        <form onSubmit={handleCheck} className="access-form">
          <div className="form-row">
            <div className="form-group">
              <label>EHR ID *</label>
              <input type="text" required placeholder="EHR UUID"
                value={checkForm.ehrId} onChange={e => setCheckForm({...checkForm, ehrId: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Requester ID *</label>
              <input type="text" required placeholder="Identity to check"
                value={checkForm.requesterId} onChange={e => setCheckForm({...checkForm, requesterId: e.target.value})} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Checking...' : '🔍 Check Access'}
          </button>
          {result?.data && (
            <pre className="result-pre">{JSON.stringify(result.data, null, 2)}</pre>
          )}
        </form>
      )}
    </div>
  );
}
