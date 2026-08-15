import { useState } from "react";
import client from "../api/client.js";
import Card from "../components/ui/Card.jsx";
import Input from "../components/ui/Input.jsx";
import Button from "../components/ui/Button.jsx";
import Alert from "../components/ui/Alert.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import Badge from "../components/ui/Badge.jsx";
import AdminLayout from "../components/layout/AdminLayout.jsx";
import AdminSidebar from "../components/layout/AdminSidebar.jsx";

export default function AdminCheckInPage() {
  const [form, setForm] = useState({ eventId: "", registrationCode: "", qrToken: "" });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      if (!form.eventId || (!form.registrationCode && !form.qrToken)) {
        setError("Event ID and registrationCode or qrToken are required");
        setLoading(false);
        return;
      }
      const res = await client.post(`/api/events/${form.eventId}/checkin`, {
        registrationCode: form.registrationCode || undefined,
        qrToken: form.qrToken || undefined,
      });
      setResult(res.data.registration);
    } catch (err) {
      setError(err.response?.data?.error?.message || "Check-in failed");
    } finally {
      setLoading(false);
    }
  };

  const topbar = (
    <PageHeader title="Guest Check-in" subtitle="Verify attendance with code or QR token" />
  );

  return (
    <AdminLayout sidebar={<AdminSidebar />} topbar={topbar}>
      <Card>
        <form onSubmit={handleSubmit} className="grid" style={{ gap: "0.75rem" }}>
          <Input label="Event ID" name="eventId" value={form.eventId} onChange={handleChange} required />
          <div className="two-col">
            <Input label="Registration Code" name="registrationCode" value={form.registrationCode} onChange={handleChange} placeholder="EVT-XXXX" />
            <Input label="QR Token" name="qrToken" value={form.qrToken} onChange={handleChange} placeholder="long token" />
          </div>
          <p className="text-muted" style={{ marginTop: -6 }}>Provide either registration code or QR token.</p>
          <Button type="submit" disabled={loading}>
            {loading ? "Checking in..." : "Check-in"}
          </Button>
        </form>
        {error && <Alert variant="error" style={{ marginTop: "0.75rem" }}>{error}</Alert>}
        {result && (
          <Card className="card-muted" style={{ marginTop: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="text-muted">Registration</div>
                <strong>{result.registrationCode}</strong>
              </div>
              <Badge variant={result.attended ? "success" : "warn"}>
                {result.attended ? "Attended" : "Pending"}
              </Badge>
            </div>
            {result.checkedInAt && <p className="text-muted">Checked in at: {new Date(result.checkedInAt).toLocaleString()}</p>}
          </Card>
        )}
      </Card>
    </AdminLayout>
  );
}
