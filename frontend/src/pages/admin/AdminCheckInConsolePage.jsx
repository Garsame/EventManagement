import { useCallback, useEffect, useRef, useState } from "react";
import { adminClient } from "../../context/AdminAuthContext.jsx";
import AdminConsoleLayout from "../../components/layout/AdminConsoleLayout.jsx";
import Card from "../../components/ui/Card.jsx";
import Input from "../../components/ui/Input.jsx";
import Button from "../../components/ui/Button.jsx";
import Alert from "../../components/ui/Alert.jsx";
import Badge from "../../components/ui/Badge.jsx";
import QrScanner from "../../components/QrScanner.jsx";
import { Link } from "react-router-dom";

export default function AdminCheckInConsolePage() {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [feed, setFeed] = useState([]);
  const [checkedIn, setCheckedIn] = useState([]);
  const [checkedInLoading, setCheckedInLoading] = useState(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(null);

  const lastScanRef = useRef({ token: "", at: 0 });

  useEffect(() => {
    // Only events an admin has explicitly opened the door for show up here -
    // see the "Open check-in" button on the Events page. That button itself
    // refuses to open a door with zero registrations, so every event listed
    // below is guaranteed to have someone to check in.
    adminClient
      .get("/api/admin/events")
      .then((res) => setEvents(res.data.events.filter((e) => e.checkInOpen)))
      .catch(() => setError("Could not load events."));
  }, []);

  // Full, persistent roster of who has been checked in for the selected
  // event - distinct from `feed`, which is only this browser tab's scan
  // history for the current session and resets on reload.
  useEffect(() => {
    if (!eventId) { setCheckedIn([]); return; }
    setCheckedInLoading(true);
    adminClient
      .get(`/api/admin/events/${eventId}/registrations`)
      .then((res) => setCheckedIn(res.data.registrations.filter((r) => r.attended)))
      .catch(() => {})
      .finally(() => setCheckedInLoading(false));
  }, [eventId]);

  const event = events.find((e) => e._id === eventId);

  const submitCheckIn = useCallback(
    async ({ code, token }) => {
      if (!eventId) { setError("Select an event first."); return; }
      if (!code && !token) { setError("Enter a registration code or scan a QR code."); return; }

      setError("");
      setAlreadyCheckedIn(null);
      setLoading(true);
      try {
        const res = await adminClient.post(`/api/events/${eventId}/checkin`, {
          registrationCode: code || undefined,
          qrToken: token || undefined,
        });
        const entry = {
          ...res.data.registration,
          guestName: res.data.guest?.fullName || "Guest",
          guestEmail: res.data.guest?.email || "",
          at: Date.now(),
        };
        setFeed((prev) => [entry, ...prev].slice(0, 8));
        setCheckedIn((prev) =>
          prev.some((g) => g.id === res.data.registration._id)
            ? prev
            : [
                {
                  id: res.data.registration._id,
                  user: res.data.guest,
                  registrationCode: res.data.registration.registrationCode,
                  checkedInAt: res.data.registration.checkedInAt,
                },
                ...prev,
              ]
        );
        setRegistrationCode("");
      } catch (err) {
        const data = err.response?.data;
        if (data?.error?.code === "ALREADY_CHECKED_IN") {
          setAlreadyCheckedIn({
            guestName: data.guest?.fullName || "This guest",
            registrationCode: data.registration?.registrationCode,
            checkedInAt: data.registration?.checkedInAt,
          });
        } else {
          setError(data?.error?.message || "Check-in failed");
        }
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
      {events.length === 0 && (
        <Alert variant="info" className="mb-5">
          No events currently have check-in open.{" "}
          <Link to="/maamul/events" className="underline font-bold">Open check-in for an event</Link> once it has registrations.
        </Alert>
      )}

      <div className="grid gap-5 grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="input-row">
            <label className="input-label" htmlFor="checkin-event">Event</label>
            <select
              id="checkin-event"
              className="input"
              value={eventId}
              onChange={(e) => { setEventId(e.target.value); setError(""); setAlreadyCheckedIn(null); }}
              disabled={events.length === 0}
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

          {alreadyCheckedIn && (
            <div className="card-muted !bg-amber-50 !border-amber-200 dark:!bg-amber-500/10 dark:!border-amber-500/30 mt-4 flex items-center gap-3">
              <span className="text-3xl shrink-0" aria-hidden="true">⚠️</span>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide font-bold text-amber-700 dark:text-amber-400">
                  Already checked in
                </div>
                <div className="font-bold text-lg truncate">{alreadyCheckedIn.guestName}</div>
                <div className="text-sm text-muted">
                  {alreadyCheckedIn.registrationCode}
                  {alreadyCheckedIn.checkedInAt && ` · Checked in at ${new Date(alreadyCheckedIn.checkedInAt).toLocaleTimeString()}`}
                </div>
              </div>
            </div>
          )}

          {eventId && (
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
              <h3 className="mt-0 mb-3 text-base font-bold">Checked-in guests ({checkedIn.length})</h3>
              {checkedInLoading && <p className="text-muted text-sm m-0">Loading…</p>}
              {!checkedInLoading && checkedIn.length === 0 && (
                <p className="text-muted text-sm m-0">No one has been checked in yet.</p>
              )}
              {!checkedInLoading && checkedIn.length > 0 && (
                <div className="stack gap-2">
                  {checkedIn.map((g) => (
                    <div key={g.id} className="card-muted flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{g.user?.fullName || "Guest"}</div>
                        <div className="text-xs text-muted">
                          {g.registrationCode}
                          {g.checkedInAt && ` · ${new Date(g.checkedInAt).toLocaleTimeString()}`}
                        </div>
                      </div>
                      <Badge variant="success">✓</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mt-0 mb-4 text-lg font-bold">Recent check-ins</h3>
          {feed.length === 0 && <p className="text-muted m-0">Nobody checked in yet this session.</p>}

          {feed.length > 0 && (
            <div className="card-muted !bg-emerald-50 !border-emerald-200 dark:!bg-emerald-500/10 dark:!border-emerald-500/30 mb-3 flex items-center gap-3">
              <span className="text-3xl shrink-0" aria-hidden="true">✅</span>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide font-bold text-emerald-700 dark:text-emerald-400">
                  Just checked in
                </div>
                <div className="font-bold text-lg truncate">{feed[0].guestName}</div>
                <div className="text-sm text-muted tracking-widest font-semibold">{feed[0].registrationCode}</div>
              </div>
            </div>
          )}

          {feed.length > 1 && (
            <div className="stack gap-2.5">
              {feed.slice(1).map((r) => (
                <div key={r._id + r.at} className="card-muted flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{r.guestName}</div>
                    <strong className="tracking-wide text-sm text-muted">{r.registrationCode}</strong>
                    <div className="text-xs text-muted">{new Date(r.checkedInAt).toLocaleTimeString()}</div>
                  </div>
                  <Badge variant="success">✓ Checked in</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AdminConsoleLayout>
  );
}
