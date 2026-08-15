import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../api/client.js";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import Alert from "../components/ui/Alert.jsx";
import Loading from "../components/ui/Loading.jsx";
import SectionLayout, { useEventBase } from "../components/layout/SectionLayout.jsx";
import QrCode from "../components/QrCode.jsx";

const formatDate = (value) => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function RegistrationStatusPage() {
  const { eventId } = useParams();
  const base = useEventBase();
  const [registration, setRegistration] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await client.get(`/api/events/${eventId}/registration/me`);
        setRegistration(res.data.registration);
      } catch (err) {
        setError(err.response?.data?.error?.message || "Not registered");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventId]);

  const attended = registration?.attended;

  return (
    <SectionLayout title="Registration Status" subtitle="Show this QR code at the door to check in">
      <>
        {loading && <Loading />}
        {error && <Alert variant="error">{error}</Alert>}
        {registration && (
          <Card style={{ maxWidth: 560 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
              <div>
                <div className="text-muted">Registration Code</div>
                <h2 style={{ margin: 0, letterSpacing: "0.04em" }}>{registration.registrationCode}</h2>
              </div>
              <Badge variant={attended ? "success" : "warn"}>
                {attended ? "Checked in" : "Not checked in"}
              </Badge>
            </div>

            <div style={{ display: "grid", placeItems: "center", gap: "0.75rem", margin: "1.25rem 0" }}>
              <QrCode value={registration.qrToken} size={220} />
              <p className="text-muted" style={{ margin: 0, textAlign: "center", maxWidth: 340 }}>
                {attended
                  ? "You are already checked in. Your gallery is unlocked."
                  : "Staff will scan this at the event. Once you are checked in, the gallery unlocks."}
              </p>
            </div>

            {registration.checkedInAt && (
              <p className="text-muted">Checked in at {formatDate(registration.checkedInAt)}</p>
            )}

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
              <Link to={`${base}/${eventId}`} className="btn btn-ghost">
                Back to event
              </Link>
              {attended && (
                <Link to={`${base}/${eventId}/gallery`} className="btn btn-primary">
                  View gallery
                </Link>
              )}
            </div>
          </Card>
        )}
      </>
    </SectionLayout>
  );
}
