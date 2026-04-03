// frontend/src/components/Hospital/UploadEHR.js
import { useState } from 'react';
import { ehrAPI } from '../../services/api';

const RECORD_TYPES = [
  'lab_result', 'prescription', 'imaging_report', 'discharge_summary',
  'clinical_note', 'vaccination_record', 'surgical_report', 'pathology_report'
];

export default function UploadEHR() {
  const [file, setFile]       = useState(null);
  const [form, setForm]       = useState({
    patientId: '', recordType: 'lab_result', doctorName: '', notes: '', date: new Date().toISOString().split('T')[0]
  });
  const [status, setStatus]   = useState('idle'); // idle | uploading | success | error
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState('');
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) setFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file)             { setError('Please select a file');        return; }
    if (!form.patientId)   { setError('Patient ID is required');      return; }
    if (!form.recordType)  { setError('Record type is required');     return; }

    setError('');
    setStatus('uploading');
    setProgress(20);

    const formData = new FormData();
    formData.append('file',       file);
    formData.append('patientId',  form.patientId);
    formData.append('recordType', form.recordType);
    formData.append('metadata',   JSON.stringify({
      doctorName: form.doctorName,
      notes:      form.notes,
      date:       form.date,
      fileName:   file.name,
      fileSize:   file.size,
      mimeType:   file.type,
    }));

    try {
      setProgress(50);
      const res = await ehrAPI.upload(formData);
      setProgress(100);
      setResult(res);
      setStatus('success');
      setFile(null);
      setForm({ patientId: '', recordType: 'lab_result', doctorName: '', notes: '', date: new Date().toISOString().split('T')[0] });
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  return (
    <div className="component-container">
      <h2 className="section-title">Upload EHR</h2>
      <p className="section-desc">Files are encrypted before upload. Only the IPFS hash is stored on the blockchain.</p>

      {status === 'success' && result && (
        <div className="alert alert-success">
          <strong>✅ Upload successful!</strong>
          <div className="hash-display">
            <span>EHR ID:</span> <code>{result.ehrId}</code>
          </div>
          <div className="hash-display">
            <span>IPFS Hash:</span> <code>{result.ipfsHash}</code>
          </div>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit} className="upload-form">
        {/* Drag-and-drop zone */}
        <div
          className={`drop-zone ${file ? 'has-file' : ''}`}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => document.getElementById('file-input').click()}
        >
          <input
            id="file-input" type="file" hidden
            accept=".pdf,.jpg,.jpeg,.png,.txt,.dcm"
            onChange={handleFileChange}
          />
          {file ? (
            <div className="file-info">
              <span className="file-icon">📄</span>
              <div>
                <p className="file-name">{file.name}</p>
                <p className="file-size">{(file.size / 1024).toFixed(1)} KB · {file.type || 'unknown type'}</p>
              </div>
              <button type="button" className="remove-file" onClick={e => { e.stopPropagation(); setFile(null); }}>✕</button>
            </div>
          ) : (
            <div className="drop-prompt">
              <span className="drop-icon">⬆️</span>
              <p>Drag & drop or click to select</p>
              <p className="muted">PDF, JPG, PNG, DICOM (max 50 MB)</p>
            </div>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Patient ID *</label>
            <input
              type="text" required
              value={form.patientId}
              onChange={e => setForm({...form, patientId: e.target.value})}
              placeholder="patient-uuid or patient ID"
            />
          </div>
          <div className="form-group">
            <label>Record Type *</label>
            <select value={form.recordType} onChange={e => setForm({...form, recordType: e.target.value})}>
              {RECORD_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Attending Doctor</label>
            <input
              type="text" value={form.doctorName}
              onChange={e => setForm({...form, doctorName: e.target.value})}
              placeholder="Dr. Name (optional)"
            />
          </div>
          <div className="form-group">
            <label>Record Date</label>
            <input
              type="date" value={form.date}
              onChange={e => setForm({...form, date: e.target.value})}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Clinical Notes</label>
          <textarea
            value={form.notes} rows={3}
            onChange={e => setForm({...form, notes: e.target.value})}
            placeholder="Optional notes about this record..."
          />
        </div>

        {status === 'uploading' && (
          <div className="progress-bar-wrap">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
            <span>Encrypting and uploading to IPFS...</span>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={status === 'uploading'}>
            {status === 'uploading' ? '⏳ Uploading...' : '⬆️ Upload to Blockchain'}
          </button>
        </div>
      </form>

      <div className="security-note">
        🔒 <strong>Security:</strong> Your file is AES-256-GCM encrypted before leaving your browser.
        The encryption key is stored separately from the file hash on the blockchain.
      </div>
    </div>
  );
}
