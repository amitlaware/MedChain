import { useState } from "react";
import ActivityList from "../components/ActivityList.jsx";
import DashboardLayout from "../components/DashboardLayout.jsx";
import StatCard from "../components/StatCard.jsx";
import PatientSearch from "../components/PatientSearch.jsx";
import PatientProfile from "../components/PatientProfile.jsx";
import RecordsList from "../components/RecordsList.jsx";
import TransferManager from "../components/TransferManager.jsx";
import AuditTrail from "../components/AuditTrail.jsx";

export default function DoctorDashboard() {
  const [selectedPatient, setSelectedPatient] = useState(null);

  return (
    <DashboardLayout>
      <section className="mb-6 rounded-2xl bg-white p-6 shadow-soft">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary-700">Doctor Workspace</p>
        <h1 className="mt-3 text-3xl font-bold text-ink">Clinical overview</h1>
        <p className="mt-2 max-w-2xl text-slate-500">Search patients, review medical histories, and manage consultation records.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
        <StatCard label="Network Access" value="Secured" detail="Restricted to local hospital & approved transfers" tone="primary" />
        <StatCard label="Blockchain Integrity" value="Active" detail="Verified by Peer Org1" tone="emerald" />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-6">
          <PatientSearch onSelectPatient={(p) => setSelectedPatient(p)} />
          
          <TransferManager />
        </div>

        <div className="space-y-6">
          {selectedPatient ? (
            <>
              <PatientProfile userId={selectedPatient._id} />
              <RecordsList forPatientId={selectedPatient._id} />
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-bold text-ink">No patient selected</h3>
              <p className="mt-2 text-sm text-slate-500">Select a patient from the search list to view their clinical profile and medical records.</p>
            </div>
          )}
        </div>
      </section>
    </DashboardLayout>
  );
}
