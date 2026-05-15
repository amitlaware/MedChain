export default function StatCard({ label, value, detail, tone = "primary" }) {
  const tones = {
    primary: "bg-primary-50 text-primary-700 ring-primary-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100"
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className={`mb-5 inline-flex rounded-lg px-3 py-1 text-xs font-bold ring-1 ${tones[tone]}`}>
        {label}
      </div>
      <p className="text-3xl font-bold text-ink">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{detail}</p>
    </article>
  );
}
