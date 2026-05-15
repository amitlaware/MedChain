import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api.js";

export default function Navbar({ onMenuClick }) {
  const { user, logout, saveSession } = useAuth();
  const location = useLocation();
  const [showProfile, setShowProfile] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (user?.name) setEditedName(user.name);
  }, [user?.name]);

  async function handleSaveName() {
    if (!editedName.trim() || editedName === user?.name) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      const res = await api.put("/auth/profile", { name: editedName });
      saveSession({ user: res.data.user });
      setIsEditing(false);
      setMsg("Name updated!");
      setTimeout(() => setMsg(""), 3000);
    } catch (err) {
      setMsg(err.response?.data?.message || "Failed to update name");
    } finally {
      setSaving(false);
    }
  }

  const peerInfo = {
    Org1MSP: { name: "peer0.org1.example.com", port: "7051", zone: "Hospital A Cluster" },
    Org2MSP: { name: "peer0.org2.example.com", port: "9051", zone: "Hospital B Cluster" }
  }[user?.mspId] || { name: "orderer.example.com", port: "7050", zone: "Network Core" };

  const title = {
    "/patient": "Patient Dashboard",
    "/doctor": "Doctor Dashboard",
    "/admin": "Admin Dashboard"
  }[location.pathname] || "EHR System";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 lg:hidden"
            aria-label="Open sidebar"
          >
            <span className="text-xl leading-none">≡</span>
          </button>
          <Link to={`/${user?.role || "patient"}`} className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 font-bold text-white">
              EH
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-400">Blockchain EHR</span>
              <span className="block text-base font-bold text-ink">{title}</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:bg-slate-100 transition rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-1.5" 
            onClick={() => setShowProfile(true)}
          >
            <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center text-xs font-bold text-white uppercase shadow-sm">
              {user?.name?.[0] || "U"}
            </div>
            <div className="text-right leading-tight">
              <div className="flex items-center justify-end gap-1.5">
                <span className={`text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-md border ${
                  user?.mspId === 'Org1MSP' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  user?.mspId === 'Org2MSP' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  'bg-slate-50 text-slate-700 border-slate-200'
                }`}>
                  {user?.mspId || 'Node'}
                </span>
                <p className="text-sm font-bold text-slate-800">{user?.name || "User"}</p>
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowProfile(true); setIsEditing(true); }}
                  className="ml-1 p-1 hover:bg-white rounded-md text-primary-600 transition shadow-sm border border-slate-100"
                  title="Edit Profile"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
              <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                View Profile
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setShowProfile(true); setIsEditing(true); }}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-black text-white transition hover:bg-orange-600 shadow-lg animate-pulse"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            EDIT PROFILE
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-primary-500 hover:text-primary-700"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Profile Side Drawer */}
      {showProfile && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" 
            onClick={() => { setShowProfile(false); setIsEditing(false); }}
          />
      {/* Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md animate-in fade-in zoom-in duration-200 rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-ink">User Profile Settings</h2>
              <button 
                onClick={() => { setShowProfile(false); setIsEditing(false); }}
                className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition flex items-center justify-center font-bold"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* Profile Section */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-primary-50/50 border border-primary-100">
                <div className="h-14 w-14 rounded-xl bg-primary-600 flex items-center justify-center text-2xl font-bold text-white shadow-md">
                  {user?.name?.[0] || "U"}
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-black uppercase text-primary-600 tracking-widest mb-1">Display Name</label>
                  <input 
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="w-full text-lg font-bold text-ink bg-transparent outline-none border-b border-primary-400 pb-1"
                  />
                </div>
                <button 
                  onClick={handleSaveName} 
                  disabled={saving}
                  className="h-10 px-4 rounded-lg bg-primary-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-primary-700 transition"
                >
                  {saving ? "..." : "Save"}
                </button>
              </div>

              {/* Info Grid */}
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-medium">MSP Identity</span>
                  <span className="font-bold text-primary-700">{user?.mspId}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-medium">Role</span>
                  <span className="font-bold text-slate-700 uppercase text-xs">{user?.role}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-medium">Blockchain Node</span>
                  <span className="font-bold text-emerald-600">{peerInfo.name}</span>
                </div>
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-medium">Associated Provider</span>
                  <span className="font-bold text-ink">{user?.hospitalName || "Global Admin Network"}</span>
                </div>
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-medium">Ledger User ID</span>
                  <span className="font-mono text-[10px] text-slate-400 break-all">{user?._id}</span>
                </div>
              </div>

              <button
                onClick={() => { setShowProfile(false); setIsEditing(false); }}
                className="w-full rounded-xl bg-slate-800 py-3 text-xs font-bold text-white uppercase tracking-widest transition hover:bg-slate-900"
              >
                Close Settings
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </header>
  );
}
