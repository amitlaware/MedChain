import { Link, Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { registerUser } from "../services/authService.js";
import api from "../services/api.js";

export default function Register() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, saveSession, user } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!authLoading && isAuthenticated) {
    return <Navigate to={`/${user.role}`} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const role = formData.get("role");

    try {
      const payload = {
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
        role,
        licenseNumber: formData.get("licenseNumber"),
        gender: formData.get("gender"),
        dateOfBirth: formData.get("dateOfBirth")
      };

      const hospitalId = formData.get("hospitalId");
      if (hospitalId) payload.hospitalId = hospitalId;

      const session = await registerUser(payload);

      saveSession(session);
      navigate(`/${session.user.role}`);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Registration failed. Please try again.");
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 sm:px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary-700">Join care network</p>
          <h1 className="mt-3 text-3xl font-bold text-ink">Register</h1>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-slate-700" htmlFor="name">Full name</label>
            <input id="name" name="name" required className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700" htmlFor="role">Role</label>
            <select id="role" name="role" value={roleValue} onChange={(e) => setRoleValue(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100">
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
              <option value="admin">Hospital Admin</option>
            </select>
          </div>
          {roleValue !== "admin" && (
            <div>
              <label className="block text-sm font-semibold text-slate-700" htmlFor="hospitalId">Hospital</label>
              <select id="hospitalId" name="hospitalId" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100">
                <option value="">Select a hospital</option>
                {hospitals.map((h) => (
                  <option key={h._id} value={h._id}>{h.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-slate-700" htmlFor="licenseNumber">License or staff ID</label>
            <input id="licenseNumber" name="licenseNumber" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700" htmlFor="gender">Gender</label>
            <select id="gender" name="gender" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100">
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700" htmlFor="dateOfBirth">Date of Birth</label>
            <input id="dateOfBirth" name="dateOfBirth" type="date" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100" />
          </div>
        </div>

        {error ? (
          <p className="mt-5 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={loading} className="mt-7 w-full rounded-xl bg-primary-600 px-4 py-3 font-bold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70">
          {loading ? "Creating account..." : "Create account"}
        </button>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already registered? <Link className="font-bold text-primary-700" to="/login">Login</Link>
        </p>
      </form>
    </main>
  );
}
