import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { adminClient } from "../context/AdminAuthContext.jsx";
import Card from "../components/ui/Card.jsx";
import Input from "../components/ui/Input.jsx";
import Button from "../components/ui/Button.jsx";
import Alert from "../components/ui/Alert.jsx";
import Loading from "../components/ui/Loading.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";

/**
 * Bootstraps the very first admin account. The API refuses this the moment
 * one admin already exists, so this page cannot be used to mint extra admins
 * later - every admin after the first is created from inside the dashboard.
 */
export default function MaamulSignupPage() {
  const navigate = useNavigate();
  const { adoptTokens } = useAdminAuth();
  const [checking, setChecking] = useState(true);
  const [adminExists, setAdminExists] = useState(true);
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    adminClient
      .get("/api/auth/admin/exists")
      .then((res) => setAdminExists(res.data.exists))
      .catch(() => setAdminExists(true))
      .finally(() => setChecking(false));
  }, []);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await adminClient.post("/api/auth/admin/signup", form);
      adoptTokens(res.data.accessToken, res.data.refreshToken, res.data.user);
      navigate("/maamul/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not create the account");
      if (err.response?.data?.error?.code === "ADMIN_EXISTS") setAdminExists(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-5">
      <div className="absolute top-5 right-5"><ThemeToggle /></div>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-6 font-extrabold text-xl">
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <circle cx="16" cy="16" r="15" stroke="#4f46e5" strokeWidth="2" />
            <circle cx="16" cy="16" r="4.5" fill="#4f46e5" />
          </svg>
          <span>EventMedia</span>
        </div>
        <Card>
          {checking && <Loading />}

          {!checking && adminExists && (
            <>
              <h1 className="text-lg font-bold mt-0 mb-2 text-center">Set-up already complete</h1>
              <p className="text-muted text-center text-sm mb-4">
                An administrator account already exists. Ask an existing admin to create your account from
                the dashboard's Users section.
              </p>
              <Link to="/maamul/login" className="btn btn-primary" style={{ width: "100%" }}>Go to sign-in</Link>
            </>
          )}

          {!checking && !adminExists && (
            <>
              <h1 className="text-lg font-bold mt-0 mb-1 text-center">Create the first admin</h1>
              <p className="text-muted text-center mt-0 mb-5 text-sm">One-time setup step</p>
              <form onSubmit={handleSubmit}>
                <Input label="Full name" id="fullName" name="fullName" value={form.fullName} onChange={handleChange} required />
                <Input label="Email" id="email" name="email" type="email" value={form.email} onChange={handleChange} required />
                <Input label="Password" id="password" name="password" type="password" value={form.password} onChange={handleChange} required minLength={6} />
                {error && <Alert variant="error">{error}</Alert>}
                <Button type="submit" disabled={loading} style={{ width: "100%", marginTop: "0.5rem" }}>
                  {loading ? "Creating…" : "Create admin account"}
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
