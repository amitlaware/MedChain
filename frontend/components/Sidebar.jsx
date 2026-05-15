import { NavLink } from "react-router-dom";

const navItems = [
  { label: "Patient", path: "/patient", marker: "P" },
  { label: "Doctor", path: "/doctor", marker: "D" },
  { label: "Admin", path: "/admin", marker: "A" }
];

export default function Sidebar({ open, onClose }) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-200 bg-white px-4 py-6 transition-transform lg:sticky lg:top-16 lg:z-20 lg:h-[calc(100vh-4rem)] lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-8 px-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-700">Care Portal</p>
          <p className="mt-2 text-sm text-slate-500">Secure records, Fabric audit trail, IPFS documents.</p>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                  isActive
                    ? "bg-primary-50 text-primary-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`
              }
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
                {item.marker}
              </span>
              {item.label} Dashboard
            </NavLink>
          ))}
        </nav>

        <div className="mt-8 rounded-xl border border-primary-100 bg-primary-50 p-4">
          <p className="text-sm font-bold text-primary-700">Network Status</p>
          <p className="mt-2 text-sm text-slate-600">Fabric peer connected</p>
          <p className="mt-1 text-sm text-slate-600">IPFS gateway online</p>
        </div>
      </aside>
    </>
  );
}
