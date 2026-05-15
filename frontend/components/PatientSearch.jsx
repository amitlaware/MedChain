import { useEffect, useState } from "react";
import { listPatients } from "../services/userService.js";

export default function PatientSearch({ onSelectPatient }) {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await listPatients();
      setPatients(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = patients.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
      <h2 className="text-lg font-bold text-ink">Find Patient</h2>
      <input 
        type="text" 
        placeholder="Search by name or email..." 
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-4 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
      />
      
      <div className="mt-4 max-h-[300px] overflow-y-auto space-y-2">
        {loading && <p className="text-sm text-slate-500">Loading patients...</p>}
        {!loading && filtered.length === 0 && <p className="text-sm text-slate-500">No patients found.</p>}
        {filtered.map(p => (
          <button 
            key={p._id} 
            onClick={() => onSelectPatient(p)}
            className="w-full text-left rounded-lg p-3 transition hover:bg-slate-50 border border-transparent hover:border-slate-100"
          >
            <p className="text-sm font-bold text-slate-700">{p.name}</p>
            <p className="text-xs text-slate-500">{p.email}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
