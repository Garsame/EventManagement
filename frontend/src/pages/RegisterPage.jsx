import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import client from "../api/client.js";
import Card from "../components/ui/Card.jsx";
import Input from "../components/ui/Input.jsx";
import Button from "../components/ui/Button.jsx";
import Alert from "../components/ui/Alert.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import PublicLayout from "../components/layout/PublicLayout.jsx";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
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
      await client.post("/api/auth/register", form);
      navigate("/login");
    } catch (err) {
      const message = err.response?.data?.error?.message || "Registration failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="container page" style={{ maxWidth: 460 }}>
        <PageHeader title="Join the platform" subtitle="Register to access events and media" />
        <Card>
          <form onSubmit={handleSubmit}>
            <Input
              label="Full name"
              name="fullName"
              placeholder="Your name"
              value={form.fullName}
              onChange={handleChange}
              required
              icon="👤"
            />
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
              placeholder="Create a password"
              value={form.password}
              onChange={handleChange}
              required
              icon="🔒"
            />
            {error && <Alert variant="error">{error}</Alert>}
            <Button type="submit" disabled={loading} style={{ width: "100%", marginTop: "0.5rem" }}>
              {loading ? "Creating..." : "Create account"}
            </Button>
          </form>
          <p className="text-muted" style={{ marginTop: "0.75rem", textAlign: "center" }}>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </Card>
      </div>
    </PublicLayout>
  );
}
