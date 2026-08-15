import { useState } from "react";
import client from "../api/client.js";
import PublicLayout from "../components/layout/PublicLayout.jsx";
import Card from "../components/ui/Card.jsx";
import Input from "../components/ui/Input.jsx";
import Button from "../components/ui/Button.jsx";
import Alert from "../components/ui/Alert.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const EMPTY = { name: "", email: "", subject: "", message: "" };

export default function ContactPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ ...EMPTY, name: user?.fullName || "", email: user?.email || "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await client.post("/api/contact", {
        name: form.name,
        email: form.email,
        subject: form.subject,
        message: form.message,
      });
      setSent(true);
      setForm({ ...EMPTY, name: user?.fullName || "", email: user?.email || "" });
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not send your message");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="shell-wrap page" style={{ maxWidth: 640 }}>
        <PageHeader title="Contact support" subtitle="Question about an event, a registration, or your gallery? Send us a message." />

        <Card>
          {sent && (
            <Alert variant="success" className="mb-5">
              Message sent. We'll reply to {form.email || "your email"} as soon as we can.
            </Alert>
          )}

          <form onSubmit={submit}>
            <div className="two-col">
              <Input label="Your name" id="name" name="name" value={form.name} onChange={handleChange} required />
              <Input label="Your email" id="email" name="email" type="email" value={form.email} onChange={handleChange} required />
            </div>
            <Input label="Subject (optional)" id="subject" name="subject" value={form.subject} onChange={handleChange} />
            <div className="input-row">
              <label className="input-label" htmlFor="message">Message</label>
              <textarea
                id="message"
                name="message"
                value={form.message}
                onChange={handleChange}
                rows={6}
                maxLength={4000}
                required
                className="input"
                placeholder="What can we help with?"
              />
              <div className="helper-text">{form.message.length}/4000</div>
            </div>
            {error && <Alert variant="error">{error}</Alert>}
            <Button type="submit" disabled={loading}>{loading ? "Sending…" : "Send message"}</Button>
          </form>
        </Card>
      </div>
    </PublicLayout>
  );
}
