import { useEffect, useState } from "react";
import { getUserProfile } from "../services/userService.js";

export default function PatientProfile({ userId }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (userId) load();
  }, [userId]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await getUserProfile(userId);
      setProfile(res.data);
    } catch (err) {
      if (err.response?.status === 403) {
        setProfile({ ...err.response.data.data, restricted: true });
      } else {
        setError("Failed to load profile");
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-4">Loading profile...</div>;
  if (error) return <div className="p-4 text-rose-600">{error}</div>;
  if (!profile) return <div className="p-4 text-slate-500">Select a patient to view profile</div>;

  return (
    <div className={`rounded-xl border bg-white p-6 shadow-soft transition-all ${profile.restricted ? 'border-amber-200' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold shadow-md ${profile.restricted ? 'bg-amber-100 text-amber-700' : 'bg-primary-100 text-primary-700'}`}>
            {profile.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink">{profile.name}</h2>
            <p className="text-sm text-slate-500">{profile.restricted ? "Full Clinical Profile Locked" : profile.email}</p>
          </div>
        </div>
        {profile.restricted && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-600 border border-amber-200">
            Transfer Required
          </span>
        )}
      </div>

      {profile.restricted ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl bg-amber-50/50 p-4 border border-amber-100">
            <p className="text-sm font-medium text-amber-800">
              This patient is currently registered at <span className="font-bold underline">{profile.hospitalName}</span>. 
              You must request a medical record transfer to view their history and upload new records.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-3 opacity-50">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Gender</p>
              <p className="mt-1 text-sm font-semibold text-slate-700 italic">Locked</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 opacity-50">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Hospital</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{profile.hospitalName}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Gender</p>
            <p className="mt-1 text-sm font-semibold text-slate-700 capitalize">{profile.gender || "Not specified"}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Date of Birth</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              {profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString() : "Not specified"}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Patient ID</p>
            <p className="mt-1 text-xs font-mono text-slate-600">{profile.id}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Hospital</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">{profile.hospitalName || "General Network"}</p>
          </div>
        </div>
      )}
    </div>
  );
}
