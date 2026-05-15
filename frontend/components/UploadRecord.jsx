import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { uploadRecord } from "../services/recordService.js";
import api from "../services/api.js";

export default function UploadRecord({ onUploaded }) {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [hospitalId, setHospitalId] = useState(user?.hospitalId || "");
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    if (!file) {
      setMessage("Please select a PDF file.");
      return;
    }

    setLoading(true);

    try {
      const res = await uploadRecord({ file, patientId: user.id, hospitalId });
      setMessage(res.message || "Uploaded");
      setFile(null);
      if (onUploaded) onUploaded(res.data);
    } catch (err) {
      setMessage(err.response?.data?.message || err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function loadHospitals() {
      try {
        const { data } = await api.get("/hospitals");
        if (!mounted) return;
        setHospitals(Array.isArray(data?.data) ? data.data : []);
        if (!hospitalId && user?.hospitalId) setHospitalId(user.hospitalId);
      } catch (err) {
        // silent failure; keep the input empty
      }
    }

    loadHospitals();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
      <h2 className="text-lg font-bold text-ink">Upload Medical Record</h2>

      <div className="mt-4 space-y-3">
        <div>
          <label className="block text-sm font-semibold text-slate-600">PDF File</label>
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-600">Hospital</label>
          {user?.role === "patient" && user?.hospitalId ? (
            <div className="mt-1 w-full rounded-md border px-3 py-2 text-slate-700">{user.hospitalName || "Assigned hospital"}</div>
          ) : (
            <select value={hospitalId} onChange={(e) => setHospitalId(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2">
              <option value="">Select a hospital</option>
              {hospitals.map((h) => (
                <option key={h._id} value={h._id}>{h.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button type="submit" disabled={loading} className="rounded bg-indigo-600 px-4 py-2 text-white">{loading ? "Uploading..." : "Upload"}</button>
          {message && <p className="text-sm text-slate-700">{message}</p>}
        </div>
      </div>
    </form>
  );
}
