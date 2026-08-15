import { useState, useEffect } from "react";
import client from "../api/client.js";
import Card from "../components/ui/Card.jsx";
import Input from "../components/ui/Input.jsx";
import Button from "../components/ui/Button.jsx";
import Alert from "../components/ui/Alert.jsx";
import SectionHeader from "../components/ui/SectionHeader.jsx";
import StatCard from "../components/ui/StatCard.jsx";
import AdminLayout from "../components/layout/AdminLayout.jsx";
import AdminSidebar from "../components/layout/AdminSidebar.jsx";
import { Link } from "react-router-dom";

const initialForm = {
  title: "",
  description: "",
  location: "",
  startDateTime: "",
  endDateTime: "",
  visibility: "public",
  published: true,
};

export default function AdminDashboardPage() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [counts, setCounts] = useState({ events: 0, published: 0 });

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const res = await client.get("/api/events/public");
        setCounts({ events: res.data.length, published: res.data.filter((e) => e.published).length });
      } catch (e) {
        // silent
      }
    };
    loadCounts();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const payload = { ...form };
      const res = await client.post("/api/admin/events", payload);
      setMessage(`Event created: ${res.data.title}`);
      setForm(initialForm);
    } catch (err) {
      const msg = err.response?.data?.error?.message || "Failed to create event";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const topbar = (
    <div className="topbar">
      <SectionHeader title="Admin Dashboard" subtitle="Manage events, check-ins, and media gates" />
    </div>
  );

  return (
    <AdminLayout sidebar={<AdminSidebar />} topbar={topbar}>
      <div className="stat-grid">
        <StatCard label="Public events" value={counts.events} hint="visible now" />
        <StatCard label="Published" value={counts.published} hint="ready for guests" />
        <StatCard label="Check-ins" value="—" hint="Coming soon" />
      </div>

      <div className="section">
        <Card>
          <h3 className="mt-0 mb-4 text-lg font-bold">Create Event</h3>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <Input label="Title" name="title" value={form.title} onChange={handleChange} required />
            <Input label="Description" name="description" value={form.description} onChange={handleChange} />
            <Input label="Location" name="location" value={form.location} onChange={handleChange} />
            <div className="two-col">
              <Input label="Start" type="datetime-local" name="startDateTime" value={form.startDateTime} onChange={handleChange} required />
              <Input label="End" type="datetime-local" name="endDateTime" value={form.endDateTime} onChange={handleChange} required />
            </div>
            <div className="two-col">
              <div className="input-row">
                <label className="font-semibold text-slate-700 text-sm">Visibility</label>
                <select name="visibility" value={form.visibility} onChange={handleChange} className="input">
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>
              <div className="input-row justify-end">
                <label className="flex items-center gap-2 font-medium text-slate-700">
                  <input type="checkbox" name="published" checked={form.published} onChange={handleChange} className="w-4 h-4 accent-brand-600" />
                  Published
                </label>
              </div>
            </div>
            {message && <Alert variant="success">{message} — <Link to="/">View on public list</Link></Alert>}
            {error && <Alert variant="error">{error}</Alert>}
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Create Event"}
            </Button>
          </form>
        </Card>
      </div>
    </AdminLayout>
  );
}
