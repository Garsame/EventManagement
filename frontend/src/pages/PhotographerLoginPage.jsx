import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Card from "../components/ui/Card.jsx";
import Input from "../components/ui/Input.jsx";
import Button from "../components/ui/Button.jsx";
import Alert from "../components/ui/Alert.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import { usePhotographerAuth } from "../context/PhotographerAuthContext.jsx";

/**
 * Photographers never self-register: an admin creates the account and emails
 * the credentials, so this page is sign-in only, with no link to sign up.
 */
export default function PhotographerLoginPage() {
  const navigate = useNavigate();
  const { login } = usePhotographerAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate("/photographer/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.error?.message || "Sign-in failed");
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
          <h1 className="text-lg font-bold mt-0 mb-1 text-center">Photographer sign-in</h1>
          <p className="text-muted text-center mt-0 mb-5 text-sm">
            Accounts are created by an administrator.
          </p>
          <form onSubmit={handleSubmit}>
            <Input label="Email" id="email" name="email" type="email" value={form.email} onChange={handleChange} required autoFocus />
            <Input label="Password" id="password" name="password" type="password" value={form.password} onChange={handleChange} required />
            <p style={{ marginTop: "-0.5rem", marginBottom: "1rem", textAlign: "right" }}>
              <Link to="/photographer/forgot-password" className="text-sm font-semibold text-brand-600 dark:text-brand-300">
                Forgot password?
              </Link>
            </p>
            {error && <Alert variant="error">{error}</Alert>}
            <Button type="submit" disabled={loading} style={{ width: "100%", marginTop: "0.5rem" }}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
