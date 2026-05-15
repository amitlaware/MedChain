import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { getMyRecords, listPatientRecords, downloadRecordPdf, requestTransfer } from "../services/recordService.js";
import { listHospitals } from "../services/hospitalService.js";
import api from "../services/api.js";

export default function RecordsList({ forPatientId, onSelectRecord }) {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hospitals, setHospitals] = useState([]);
  const [transferringId, setTransferringId] = useState(null);
  const [selectedHospital, setSelectedHospital] = useState("");
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState("");

  // Get the record being transferred safely
  const transferringRecord = transferringId ? records.find(r => (r.recordId || r._id) === transferringId) : null;

  useEffect(() => {
    load();
    loadHospitals();
  }, [forPatientId]);

  useEffect(() => {
    if (selectedHospital) {
      api.get(`/users?role=doctor&hospitalId=${selectedHospital}`)
        .then(res => setDoctors(Array.isArray(res.data?.data) ? res.data.data : []))
        .catch(() => setDoctors([]));
    } else {
      setDoctors([]);
    }
    setSelectedDoctor("");
  }, [selectedHospital]);

  async function loadHospitals() {
    try {
      const resp = await listHospitals();
      setHospitals(Array.isArray(resp?.data) ? resp.data : []);
    } catch (err) {
      console.error("Failed to load hospitals");
    }
  }

  async function load() {
    setError("");
    setLoading(true);
    try {
      let res;
      if (user?.role === "doctor") {
        if (!forPatientId) {
          setError("Provide a patientId to list their records.");
          setRecords([]);
          return;
        }
        res = await listPatientRecords(forPatientId);
      } else {
        res = await getMyRecords();
      }
      setRecords(res?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to load records");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(recordId, filename) {
    try {
      const resp = await downloadRecordPdf(recordId);
      const blob = new Blob([resp.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "record.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Download failed");
    }
  }

  async function handleRequestTransfer(record) {
    const id = record?.recordId || record?._id;
    if (id) {
      setTransferringId(id);
      setSelectedHospital("");
    }
  }

  async function confirmTransfer() {
    if (!selectedHospital || !transferringRecord) return;
    setError("");

    try {
      const payload = {
        patientId: user?.id || user?._id,
        fromHospital: transferringRecord.hospitalId || transferringRecord.currentHospitalId,
        toHospital: selectedHospital,
        toDoctorId: selectedDoctor || null
      };

      const res = await requestTransfer(transferringRecord.recordId || transferringRecord._id, payload);
      alert(res.message || "Transfer requested");
      setTransferringId(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Request failed");
    }
  }

  if (loading) return <div className="rounded-xl bg-white p-4">Loading records...</div>;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
      <h2 className="text-lg font-bold text-ink">Records</h2>

      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

      {transferringId && transferringRecord && (
        <div className="mt-4 rounded-xl bg-amber-50 p-5 border-2 border-amber-200 shadow-lg ring-4 ring-amber-500/10 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">Request Record Transfer</p>
              <p className="text-xs text-amber-700">Moving: <span className="font-mono">{transferringRecord?.filename || "Selected Record"}</span></p>
              <p className="text-[10px] text-amber-600 mt-0.5">Currently at: <span className="font-bold uppercase">{hospitals.find(h => String(h._id) === String(transferringRecord?.hospitalId || transferringRecord?.currentHospitalId))?.name || "Unknown Facility"}</span></p>
            </div>
          </div>
          
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <select 
              value={selectedHospital} 
              onChange={(e) => setSelectedHospital(e.target.value)}
              className="flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            >
              <option value="">Select Destination Hospital</option>
              {(hospitals || []).filter(h => h && String(h._id) !== String(transferringRecord?.hospitalId)).map(h => (
                <option key={h._id} value={h._id}>{h.name}</option>
              ))}
            </select>

            {selectedHospital && (
              <select 
                value={selectedDoctor} 
                onChange={(e) => setSelectedDoctor(e.target.value)}
                className="flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 animate-in fade-in zoom-in-95"
              >
                <option value="">Select Doctor (Optional)</option>
                {doctors.map(d => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
                {doctors.length === 0 && <option disabled>No doctors found at this hospital</option>}
              </select>
            )}

            <div className="flex gap-2">
              <button onClick={confirmTransfer} disabled={!selectedHospital} className="rounded-lg bg-amber-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50">Confirm</button>
              <button onClick={() => setTransferringId(null)} className="rounded-lg bg-white border border-amber-200 px-4 py-2.5 text-sm font-bold text-amber-700 hover:bg-amber-100">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-4 mb-2">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Medical History</h3>
        {records.length > 4 && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-tighter">Scroll for more</span>}
      </div>

      <ul className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar transition-all">
        {(records || []).length === 0 && <li className="text-sm text-slate-500 italic py-6 text-center border-2 border-dashed border-slate-100 rounded-xl">No records found on ledger.</li>}

        {(records || []).map((r) => {
          const rId = r?.recordId || r?._id;
          const isSelected = transferringId && rId === transferringId;
          
          return (
            <li key={rId} className={`flex items-center justify-between rounded-xl border p-4 transition-all hover:shadow-md ${ isSelected ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-100' : 'border-slate-100 bg-white'}`}>
              <div className="min-w-0">
                <div className="font-bold text-slate-800 truncate">{r?.filename || rId}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-1">CID: {r?.cid ? `${r.cid.substring(0, 32)}...` : "-"}</div>
              </div>

              <div className="flex flex-wrap gap-2 ml-4 shrink-0">
                <button onClick={() => handleDownload(rId, r?.filename)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase text-slate-700 transition hover:bg-slate-200">View</button>
                
                {user?.role === "patient" && (
                  <>
                    <button onClick={() => onSelectRecord && onSelectRecord(rId)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black uppercase text-white transition hover:bg-emerald-700 shadow-sm">Grant</button>
                    <button onClick={() => handleRequestTransfer(r)} className="rounded-lg bg-amber-600 px-3 py-1.5 text-[10px] font-black uppercase text-white transition hover:bg-amber-700 shadow-sm">Transfer</button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
