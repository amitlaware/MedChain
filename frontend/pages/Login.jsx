import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { loginUser } from "../services/authService.js";
import api from "../services/api.js";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loading: authLoading, saveSession, user } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const redirectTo = location.state?.from?.pathname || `/${user?.role || "patient"}`;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const role = formData.get("role");

    try {
      const payload = {
        email: formData.get("email"),
        password: formData.get("password"),
        role
      };

      const hospitalId = formData.get("hospitalId");
      if (hospitalId) payload.hospitalId = hospitalId;

      const session = await loginUser(payload);

      saveSession(session);
      navigate(location.state?.from?.pathname || `/${session.user.role}`, { replace: true });
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const [hospitals, setHospitals] = useState([]);
  const [roleValue, setRoleValue] = useState("patient");

  useEffect(() => {
    let mounted = true;
    api
      .get("/hospitals")
      .then((res) => {
        if (!mounted) return;
        setHospitals(Array.isArray(res.data?.data) ? res.data.data : []);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  if (!authLoading && isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[1fr_1.1fr]">
      <section className="hidden bg-[linear-gradient(135deg,#0f766e,#2563eb)] px-12 py-16 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-teal-100">EHR System</p>
          <h1 className="mt-6 max-w-xl text-5xl font-bold leading-tight">Secure health records for connected care teams.</h1>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {["Fabric audit", "IPFS files", "MongoDB profiles"].map((item) => (
            <div key={item} className="rounded-xl bg-white/15 p-4 backdrop-blur">
              <p className="text-sm font-semibold">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-6">
        <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
          <div className="mb-8">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary-700">Welcome back</p>
            <h2 className="mt-3 text-3xl font-bold text-ink">Login</h2>
          </div>

          <label className="block text-sm font-semibold text-slate-700" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-100" placeholder="doctor@hospital.org" />

          <label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-100" placeholder="Enter password" />

          <label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="role">Role</label>
          <select id="role" name="role" value={roleValue} onChange={(e) => setRoleValue(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-100">
            <option value="patient">Patient</option>
            <option value="doctor">Doctor</option>
            <option value="admin">Hospital Admin</option>
          </select>

          {error ? (
            <p className="mt-5 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </p>
          ) : null}

          {roleValue !== "admin" && (
            <div className="mt-4">
              <label className="block text-sm font-semibold text-slate-700" htmlFor="hospitalId">Hospital</label>
              <select id="hospitalId" name="hospitalId" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-100">
                <option value="">Select a hospital</option>
                {hospitals.map((h) => (
                  <option key={h._id} value={h._id}>{h.name}</option>
                ))}
              </select>
            </div>
          )}

          <button type="submit" disabled={loading} className="mt-7 w-full rounded-xl bg-primary-600 px-4 py-3 font-bold text-white shadow-lg shadow-teal-100 transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70">
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <p className="mt-6 text-center text-sm text-slate-500">
            New to the network? <Link className="font-bold text-primary-700" to="/register">Create account</Link>
          </p>
        </form>
      </section>
    </main>
  );
}
