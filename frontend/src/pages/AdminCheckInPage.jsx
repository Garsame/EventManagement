import { useCallback, useEffect, useRef, useState } from "react";
import client from "../api/client.js";
import Card from "../components/ui/Card.jsx";
import Input from "../components/ui/Input.jsx";
import Button from "../components/ui/Button.jsx";
import Alert from "../components/ui/Alert.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import Badge from "../components/ui/Badge.jsx";
import AdminLayout from "../components/layout/AdminLayout.jsx";
import AdminSidebar from "../components/layout/AdminSidebar.jsx";
import QrScanner from "../components/QrScanner.jsx";

export default function AdminCheckInPage() {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  // A camera parked on a QR code fires the callback many times a second.
  const lastScanRef = useRef({ token: "", at: 0 });

  useEffect(() => {
    // The admin list includes drafts and private events, which the public
    // endpoint omits - staff still need to check guests in to those.
    client
      .get("/api/admin/events")
      .then((res) => setEvents(res.data.events || []))
      .catch(() => setError("Could not load events."));
  }, []);

  const submitCheckIn = useCallback(
    async ({ code, token }) => {
      if (!eventId) {
        setError("Select an event first.");
        return;
      }
      if (!code && !token) {
        setError("Enter a registration code or scan a QR code.");
        return;
      }

      setError("");
      setResult(null);
      setLoading(true);
      try {
        const res = await client.post(`/api/events/${eventId}/checkin`, {
          registrationCode: code || undefined,
          qrToken: token || undefined,
        });
        setResult(res.data.registration);
        setRegistrationCode("");
      } catch (err) {
        setError(err.response?.data?.error?.message || "Check-in failed");
      } finally {
        setLoading(false);
      }
    },
    [eventId]
  );

  const handleScan = useCallback(
    (decodedText) => {
      const now = Date.now();
      const { token, at } = lastScanRef.current;
      // Ignore repeat reads of the same code within 3s so one guest is not
      // submitted a dozen times while the camera stays pointed at their phone.
      if (decodedText === token && now - at < 3000) return;
      lastScanRef.current = { token: decodedText, at: now };
      submitCheckIn({ token: decodedText });
    },
    [submitCheckIn]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    submitCheckIn({ code: registrationCode.trim() });
  };

  const topbar = <PageHeader title="Guest Check-in" subtitle="Scan a guest's QR code or enter their registration code" />;

  return (
    <AdminLayout sidebar={<AdminSidebar />} topbar={topbar}>
      <Card>
        <div className="input-row">
          <label className="input-label" htmlFor="checkin-event">Event</label>
          <select
            id="checkin-event"
            className="input"
            value={eventId}
            onChange={(e) => {
              setEventId(e.target.value);
              setResult(null);
              setError("");
            }}
          >
            <option value="">Select an event…</option>
            {events.map((event) => (
              <option key={event._id} value={event._id}>
                {event.title}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <Button type="button" variant={scanning ? "ghost" : "primary"} onClick={() => setScanning((s) => !s)} disabled={!eventId}>
            {scanning ? "Stop camera" : "Scan QR code"}
          </Button>
          {!eventId && <p className="helper-text" style={{ alignSelf: "center" }}>Select an event to begin.</p>}
        </div>

        {scanning && eventId && (
          <div style={{ marginBottom: "1rem" }}>
            <QrScanner onScan={handleScan} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid" style={{ gap: "0.75rem" }}>
          <Input
            label="Registration Code"
            id="registrationCode"
            name="registrationCode"
            value={registrationCode}
            onChange={(e) => setRegistrationCode(e.target.value)}
            placeholder="EVT-XXXXXX"
          />
          <Button type="submit" disabled={loading || !eventId}>
            {loading ? "Checking in…" : "Check in guest"}
          </Button>
        </form>

        {error && <Alert variant="error" style={{ marginTop: "0.75rem" }}>{error}</Alert>}

        {result && (
          <Card className="card-muted" style={{ marginTop: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
              <div>
                <div className="text-muted">Registration</div>
                <strong>{result.registrationCode}</strong>
              </div>
              <Badge variant={result.attended ? "success" : "warn"}>
                {result.attended ? "Checked in" : "Pending"}
              </Badge>
            </div>
            {result.checkedInAt && (
              <p className="text-muted" style={{ marginBottom: 0 }}>
                Checked in at {new Date(result.checkedInAt).toLocaleString()}
              </p>
            )}
          </Card>
        )}
      </Card>
    </AdminLayout>
  );
}
