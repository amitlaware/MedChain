import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { grantAccess, revokeAccess } from "../services/recordService.js";
import api from "../services/api.js";

export default function PermissionManager({ initialRecordId }) {
  const { user } = useAuth();
  const [recordId, setRecordId] = useState(initialRecordId || "");
  const [doctorId, setDoctorId] = useState("");
  const [hospitals, setHospitals] = useState([]);
  const [hospitalId, setHospitalId] = useState("");
  const [doctors, setDoctors] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [canView, setCanView] = useState(true);
  const [expires, setExpires] = useState("");

  useEffect(() => {
    if (initialRecordId) {
      setRecordId(initialRecordId);
    }
  }, [initialRecordId]);

  async function handleAction(action) {
    setMessage("");
    if (!recordId || !doctorId) {
      setMessage("Record ID and Doctor ID are required.");
      return;
    }

    setLoading(true);

    try {
      let res;

      if (action === "grant") {
        res = await grantAccess(recordId, doctorId, { canView, expires });
      } else {
        res = await revokeAccess(recordId, doctorId);
      }

      setMessage(res?.message || "Success");
    } catch (err) {
      setMessage(err.response?.data?.message || err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    api
      .get("/hospitals")
      .then((res) => {
        if (!mounted) return;
        setHospitals(Array.isArray(res.data?.data) ? res.data.data : []);
      })
      .catch(() => {});

    // if user is a patient and has hospital assigned, preselect it
    if (user?.role === "patient" && user?.hospitalId) {
      setHospitalId(user.hospitalId);
    }

    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    let mounted = true;
    if (!hospitalId) {
      setDoctors([]);
      return;
    }

    api
      .get(`/users?role=doctor&hospitalId=${hospitalId}`)
      .then((res) => {
        if (!mounted) return;
        setDoctors(Array.isArray(res.data?.data) ? res.data.data : []);
      })
      .catch(() => setDoctors([]));

    return () => {
      mounted = false;
    };
  }, [hospitalId]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
      <h2 className="text-lg font-bold text-ink">Manage Record Permissions</h2>

      <div className="mt-4 space-y-3">
        <div>
          <label className="block text-sm font-semibold text-slate-600">Record ID</label>
          <input value={recordId} onChange={(e) => setRecordId(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" placeholder="Enter recordId (from uploads)" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-600">Doctor ID</label>
          <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2">
            <option value="">Select doctor</option>
            {doctors.map((d) => (
              <option key={d._id} value={d._id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Your Hospital</label>
          <div className="mt-1 text-sm font-bold text-primary-700 flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            {user?.hospitalName || "Assigned Facility"}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={canView} onChange={(e) => setCanView(e.target.checked)} />
            <span className="text-sm text-slate-600">Can View</span>
          </label>

          <div>
            <label className="block text-sm font-semibold text-slate-600">Expires</label>
            <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className="mt-1 rounded-md border px-3 py-2" />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button 
            disabled={loading} 
            onClick={() => handleAction("grant")} 
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-700 hover:shadow-emerald-300 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Grant Access
          </button>
          <button 
            disabled={loading} 
            onClick={() => handleAction("revoke")} 
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600 transition-all hover:bg-rose-100 disabled:opacity-50"
          >
            Revoke
          </button>
        </div>

        {message && <p className="text-sm text-slate-700">{message}</p>}
      </div>
    </div>
  );
}
