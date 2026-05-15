import { useState } from "react";
import DashboardLayout from "../components/DashboardLayout.jsx";
import StatCard from "../components/StatCard.jsx";
import PermissionManager from "../components/PermissionManager.jsx";
import UploadRecord from "../components/UploadRecord.jsx";
import RecordsList from "../components/RecordsList.jsx";
import TransferManager from "../components/TransferManager.jsx";

export default function PatientDashboard() {
  const [selectedRecordId, setSelectedRecordId] = useState("");

  return (
    <DashboardLayout>
      <section className="mb-6 rounded-2xl bg-white p-6 shadow-soft">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary-700">Patient Portal</p>
        <h1 className="mt-3 text-3xl font-bold text-ink">Your health records</h1>
        <p className="mt-2 max-w-2xl text-slate-500">Review appointments, prescriptions, uploaded reports, and blockchain access history.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Ledger Identity" value="Verified" detail="Secured by Org1 MSP" tone="emerald" />
        <StatCard label="IPFS Storage" value="Active" detail="Records pinned on P2P network" tone="blue" />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <UploadRecord />
          <RecordsList onSelectRecord={(id) => setSelectedRecordId(id)} />
          <PermissionManager initialRecordId={selectedRecordId} />
        </div>

        <div className="space-y-6">
          <TransferManager />
        </div>
      </section>
    </DashboardLayout>
  );
}
