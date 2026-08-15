import { useCallback, useEffect, useRef, useState } from "react";
import { adminClient } from "../../context/AdminAuthContext.jsx";
import AdminConsoleLayout from "../../components/layout/AdminConsoleLayout.jsx";
import Card from "../../components/ui/Card.jsx";
import Input from "../../components/ui/Input.jsx";
import Button from "../../components/ui/Button.jsx";
import Alert from "../../components/ui/Alert.jsx";
import Badge from "../../components/ui/Badge.jsx";
import QrScanner from "../../components/QrScanner.jsx";

export default function AdminCheckInConsolePage() {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [feed, setFeed] = useState([]);

  const lastScanRef = useRef({ token: "", at: 0 });

  useEffect(() => {
    adminClient
      .get("/api/admin/events")
      .then((res) => setEvents(res.data.events.filter((e) => e.status !== "completed")))
      .catch(() => setError("Could not load events."));
  }, []);

  const event = events.find((e) => e._id === eventId);

  const submitCheckIn = useCallback(
    async ({ code, token }) => {
      if (!eventId) { setError("Select an event first."); return; }
      if (!code && !token) { setError("Enter a registration code or scan a QR code."); return; }

      setError("");
      setLoading(true);
      try {
        const res = await adminClient.post(`/api/events/${eventId}/checkin`, {
          registrationCode: code || undefined,
          qrToken: token || undefined,
        });
        setFeed((prev) => [{ ...res.data.registration, at: Date.now() }, ...prev].slice(0, 8));
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
      if (decodedText === token && now - at < 3000) return;
      lastScanRef.current = { token: decodedText, at: now };
      submitCheckIn({ token: decodedText });
    },
    [submitCheckIn]
  );

  return (
    <AdminConsoleLayout title="Check-in" subtitle="Scan a guest's QR code or enter their registration code">
      <div className="grid gap-5 grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="input-row">
            <label className="input-label" htmlFor="checkin-event">Event</label>
            <select
              id="checkin-event"
              className="input"
              value={eventId}
              onChange={(e) => { setEventId(e.target.value); setError(""); }}
            >
              <option value="">Select an event…</option>
              {events.map((e) => <option key={e._id} value={e._id}>{e.title}</option>)}
            </select>
          </div>

          {event && (
            <div className="flex gap-2 flex-wrap mb-4">
              <Badge variant={event.status === "registration-open" ? "success" : "neutral"}>{event.status}</Badge>
              <Badge variant="info">{event.registrationCount} registered</Badge>
              <Badge variant="success">{event.attendedCount} checked in</Badge>
            </div>
          )}

          <div className="flex gap-2 flex-wrap mb-4">
            <Button type="button" variant={scanning ? "ghost" : "primary"} onClick={() => setScanning((s) => !s)} disabled={!eventId}>
              {scanning ? "Stop camera" : "📷 Scan QR code"}
            </Button>
            {!eventId && <p className="helper-text self-center">Select an event to begin.</p>}
          </div>

          {scanning && eventId && (
            <div className="mb-4 flex justify-center">
              <QrScanner onScan={handleScan} />
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); submitCheckIn({ code: registrationCode.trim() }); }} className="grid gap-3">
            <Input
              label="Registration code"
              id="registrationCode"
              name="registrationCode"
              value={registrationCode}
              onChange={(e) => setRegistrationCode(e.target.value)}
              placeholder="EVT-XXXXXX"
              inputClassName="text-center text-lg tracking-widest font-bold"
            />
            <Button type="submit" disabled={loading || !eventId}>{loading ? "Checking in…" : "Check in guest"}</Button>
          </form>

          {error && <Alert variant="error" className="mt-4">{error}</Alert>}
        </Card>

        <Card>
          <h3 className="mt-0 mb-4 text-lg font-bold">Recent check-ins</h3>
          {feed.length === 0 && <p className="text-muted m-0">Nobody checked in yet this session.</p>}
          <div className="stack gap-2.5">
            {feed.map((r) => (
              <div key={r._id + r.at} className="card-muted flex items-center justify-between gap-3">
                <div>
                  <strong className="tracking-wide">{r.registrationCode}</strong>
                  <div className="text-xs text-muted">{new Date(r.checkedInAt).toLocaleTimeString()}</div>
                </div>
                <Badge variant="success">✓ Checked in</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AdminConsoleLayout>
  );
}
