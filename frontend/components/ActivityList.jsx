export default function ActivityList({ title, items }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        <button className="text-sm font-semibold text-primary-700">View all</button>
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.title} className="flex items-start gap-3 rounded-lg border border-slate-100 p-3">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary-500" />
            <div>
              <p className="font-semibold text-slate-800">{item.title}</p>
              <p className="mt-1 text-sm text-slate-500">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
