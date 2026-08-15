import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import client from "../api/client.js";
import Card from "../components/ui/Card.jsx";
import Input from "../components/ui/Input.jsx";
import Button from "../components/ui/Button.jsx";
import Alert from "../components/ui/Alert.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import PublicLayout from "../components/layout/PublicLayout.jsx";
import * as tokenStore from "../api/tokenStore.js";

export default function LoginPage() {
  const navigate = useNavigate();
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
      const res = await client.post("/api/auth/login", form);
      tokenStore.setAccessToken(res.data.accessToken);
      tokenStore.setRefreshToken(res.data.refreshToken);
      window.localStorage.setItem("ems_user", JSON.stringify(res.data.user));
      window.dispatchEvent(new Event("authchange"));
      navigate("/");
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
