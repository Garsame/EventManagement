import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import Card from "../components/ui/Card.jsx";
import Input from "../components/ui/Input.jsx";
import Button from "../components/ui/Button.jsx";
import Alert from "../components/ui/Alert.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import PublicLayout from "../components/layout/PublicLayout.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      // Send them back where they were headed, otherwise into the dashboard -
      // or straight to the profile if it still needs filling in.
      const from = location.state?.from;
      if (from) navigate(from, { replace: true });
      else navigate(user.profileComplete ? "/dashboard" : "/dashboard/profile", { replace: true });
    } catch (err) {
      const message = err.response?.data?.error?.message || "Login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="container page" style={{ maxWidth: 460 }}>
        <PageHeader title="Welcome back" subtitle="Access your event workspace" />
        <Card>
          <form onSubmit={handleSubmit}>
            <Input
              label="Email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
              icon="@"
            />
            <Input
              label="Password"
              name="password"
              type="password"
              placeholder="••••••"
              value={form.password}
              onChange={handleChange}
              required
              icon="🔒"
            />
            {error && <Alert variant="error">{error}</Alert>}
            <Button type="submit" disabled={loading} style={{ width: "100%", marginTop: "0.5rem" }}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          <p className="text-muted" style={{ marginTop: "0.75rem", textAlign: "center" }}>
            No account? <Link to="/register">Create one</Link>
          </p>
        </Card>
      </div>
    </PublicLayout>
  );
}
