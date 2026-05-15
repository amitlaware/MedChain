import DashboardLayout from "../components/DashboardLayout.jsx";
import StatCard from "../components/StatCard.jsx";
import { useEffect, useState } from "react";
import api from "../services/api.js";
import TransferManager from "../components/TransferManager.jsx";
import AuditTrail from "../components/AuditTrail.jsx";

export default function AdminDashboard() {
  const [hospitals, setHospitals] = useState([]);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [createMsg, setCreateMsg] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let mounted = true;
    api
      .get("/hospitals/with-users")
      .then((res) => {
        if (!mounted) return;
        setHospitals(Array.isArray(res.data?.data) ? res.data.data : []);
      })
      .catch(() => setHospitals([]));

    return () => {
      mounted = false;
    };
  }, []);

  async function handleCreateHospital(e) {
    e.preventDefault();
    setCreateMsg("");
    const name = (newName || "").trim();
    const address = (newAddress || "").trim();

    if (!name || !address) {
      setCreateMsg("Name and address are required.");
      return;
    }

    if (name.length < 2) {
      setCreateMsg("Hospital name must be at least 2 characters.");
      return;
    }

    if (address.length < 5) {
      setCreateMsg("Hospital address must be at least 5 characters.");
      return;
    }

    setCreating(true);
    try {
      const res = await api.post("/hospitals", { name, address });
      setCreateMsg(res.data?.message || "Hospital created.");
      setNewName("");
      setNewAddress("");
      // refresh
      const list = await api.get("/hospitals/with-users");
      setHospitals(Array.isArray(list.data?.data) ? list.data.data : []);
    } catch (err) {
      setCreateMsg(err.response?.data?.message || err.message || "Create failed");
    } finally {
      setCreating(false);
    }
  }

  const totalHospitals = hospitals.length;
  const totalDoctors = hospitals.reduce((acc, h) => acc + (h.doctors?.length || 0), 0);
  const totalPatients = hospitals.reduce((acc, h) => acc + (h.patients?.length || 0), 0);

  return (
    <DashboardLayout>
      <div className="mb-6 rounded-2xl bg-primary-600 p-8 text-center shadow-xl shadow-primary-100">
        <h2 className="text-3xl font-black text-white uppercase tracking-widest">Welcome to the Network</h2>
        <p className="mt-2 text-primary-100 font-bold italic">Dashboard Updated: Version 2.0 (Edit Name Feature Active)</p>
      </div>

      <section className="mb-6 rounded-2xl bg-white p-6 shadow-soft">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary-700">Admin Console</p>
        <h1 className="mt-3 text-3xl font-bold text-ink">Network operations</h1>
        <p className="mt-2 max-w-2xl text-slate-500">Manage providers, identity enrollment, ledger visibility, and platform health.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Hospitals" value={totalHospitals} detail="Registered providers" />
        <StatCard label="Total Clinicians" value={totalDoctors} detail="Doctors on network" tone="blue" />
        <StatCard label="Total Patients" value={totalPatients} detail="Registered identities" tone="amber" />
        <StatCard label="Blockchain Nodes" value="2" detail="Peer Org1 & Org2" tone="rose" />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <AuditTrail title="Global Ledger Audit" />
        <div className="space-y-6">
          <TransferManager />
          
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
            <form onSubmit={handleCreateHospital} className="mb-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700">Name</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700">Address</label>
                <input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2" />
              </div>
              <div className="sm:col-span-2 flex items-center gap-3">
                <button type="submit" disabled={creating} className="rounded bg-primary-600 px-4 py-2 text-white">{creating ? "Creating..." : "Create hospital"}</button>
                {createMsg && <div className="text-sm text-slate-700">{createMsg}</div>}
              </div>
            </form>
            <h2 className="text-lg font-bold text-ink">Hospitals & Teams</h2>
            <div className="mt-4 space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {hospitals.length === 0 ? (
                <p className="text-sm text-slate-500">No hospitals found.</p>
              ) : (
                hospitals.map((h) => (
                  <div key={h._id} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-6 transition hover:bg-white hover:shadow-xl hover:shadow-slate-200/50">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-lg font-bold text-ink">{h.name}</div>
                          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">{h.address}</div>
                        </div>
                        <div className="flex gap-2">
                          <span className="rounded-lg bg-blue-100 px-2 py-1 text-[10px] font-black text-blue-700 uppercase">{h.doctors.length} Drs</span>
                          <span className="rounded-lg bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700 uppercase">{h.patients.length} Pts</span>
                        </div>
                      </div>

                      <div className="grid gap-6 sm:grid-cols-2">
                        {/* Doctors List */}
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Clinical Staff</h4>
                          {h.doctors.length === 0 ? (
                            <p className="text-xs italic text-slate-400 italic">No clinicians registered</p>
                          ) : (
                            <div className="space-y-2">
                              {h.doctors.map(dr => (
                                <div key={dr._id} className="flex flex-col rounded-xl bg-white p-3 shadow-sm border border-slate-100">
                                  <span className="text-sm font-bold text-ink">{dr.name}</span>
                                  <span className="text-[10px] text-slate-500 font-medium truncate">{dr.email}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Patients List */}
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Patient Population</h4>
                          {h.patients.length === 0 ? (
                            <p className="text-xs italic text-slate-400 italic">No patients registered</p>
                          ) : (
                            <div className="space-y-2">
                              {h.patients.map(p => (
                                <div key={p._id} className="flex flex-col rounded-xl bg-white p-3 shadow-sm border border-slate-100">
                                  <span className="text-sm font-bold text-ink">{p.name}</span>
                                  <span className="text-[10px] text-slate-500 font-medium truncate">{p.email}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}
