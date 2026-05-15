import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api.js";

export default function TransferManager() {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState({ incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/records/transfers/list");
      const result = data.data || {};
      setTransfers({
        incoming: Array.isArray(result.incoming) ? result.incoming : [],
        outgoing: Array.isArray(result.outgoing) ? result.outgoing : []
      });
    } catch (err) {
      setError("Failed to load transfers.");
      setTransfers({ incoming: [], outgoing: [] });
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id) {
    try {
      await api.post(`/records/transfers/${id}/approve`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Approve failed: Not authorized.");
    }
  }

  async function handleExecute(id) {
    try {
      await api.post(`/records/transfers/${id}/execute`);
      alert("Transfer complete!");
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Finalize failed.");
    }
  }

  if (loading) return <div className="p-4 text-slate-500">Loading transfers...</div>;

  return (
    <div className="space-y-6">
      {/* Incoming Transfers */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-ink flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Incoming Transfers
          </h2>
          {transfers.incoming.length > 2 && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-tighter">Scroll to view more</span>}
        </div>
        
        <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar transition-all duration-300">
          {transfers.incoming.length === 0 && <p className="text-sm text-slate-500 italic py-4">No incoming requests.</p>}
          {transfers.incoming.map(t => (
            <div key={t._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 border border-slate-100 transition-all hover:border-primary-200 hover:bg-white hover:shadow-md">
              <div>
                <p className="text-sm font-bold text-slate-800">{t.patientId?.name || "Unknown Patient"}</p>
                <div className="flex flex-col gap-0.5 mt-1">
                  <p className="text-[11px] text-slate-600 flex items-center gap-1">
                    <span className="font-black text-slate-400 uppercase text-[9px]">From:</span> {t.fromHospital?.name || "Source Facility"}
                  </p>
                  <p className="text-[11px] text-slate-600 flex items-center gap-1">
                    <span className="font-black text-slate-400 uppercase text-[9px]">To:</span> {t.toHospital?.name || "This Facility"}
                  </p>
                  {t.toDoctorId && (
                    <p className="text-[11px] text-primary-700 flex items-center gap-1 font-bold mt-0.5">
                      <span className="font-black text-slate-400 uppercase text-[9px]">Target:</span> Dr. {t.toDoctorId?.name || "Assigned"}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`inline-block rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                    t.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {t.status}
                  </span>
                  <p className="text-[9px] text-slate-400 font-mono">ID: {t._id.substring(0,8)}...</p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {user?.role !== "patient" && (
                  <>
                    {t.status === 'pending' && (
                      <button onClick={() => handleApprove(t._id)} className="w-full sm:w-auto rounded-lg bg-primary-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-700 shadow-sm">
                        Approve
                      </button>
                    )}
                    {t.status === 'approved' && (
                      <button onClick={() => handleExecute(t._id)} className="w-full sm:w-auto rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 shadow-sm">
                        Finalize
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Outgoing Requests */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-ink flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-slate-300"></span>
            Outgoing Requests
          </h2>
          {transfers.outgoing.length > 2 && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-tighter">Scroll to view more</span>}
        </div>

        <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
          {transfers.outgoing.length === 0 && <p className="text-sm text-slate-500 italic py-4">No outgoing requests.</p>}
          {transfers.outgoing.map(t => (
            <div key={t._id} className="flex items-center justify-between rounded-lg bg-slate-50 p-4 border border-slate-100 opacity-90 hover:opacity-100 transition-opacity">
              <div>
                <p className="text-sm font-bold text-slate-700">{t.patientId?.name || "My Transfer"}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[11px] text-slate-600">To: <span className="font-bold">{t.toHospital?.name || "Provider"}</span></p>
                  <span className="h-1 w-1 rounded-full bg-slate-300"></span>
                  <span className="text-[9px] font-bold uppercase text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">{t.status}</span>
                </div>
                <p className="text-[9px] text-slate-400 mt-1 font-mono">REQ: {t._id.substring(0,8)}...</p>
              </div>
              <div className="hidden sm:block">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Awaiting Approval</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
