import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../api/client.js";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import Alert from "../components/ui/Alert.jsx";
import Loading from "../components/ui/Loading.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import PublicLayout from "../components/layout/PublicLayout.jsx";

const formatDate = (value) => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function RegistrationStatusPage() {
  const { eventId } = useParams();
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

  return (
    <PublicLayout>
      <div className="container page">
        <PageHeader title="Registration Status" subtitle="Keep this code handy for check-in" />
        {loading && <Loading />}
        {error && <Alert variant="error">{error}</Alert>}
        {registration && (
          <Card style={{ maxWidth: 520 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="text-muted">Registration Code</div>
                <h2 style={{ margin: 0 }}>{registration.registrationCode}</h2>
              </div>
              <Badge variant={registration.attended ? "success" : "warn"}>
                {registration.attended ? "Attended" : "Not attended"}
              </Badge>
            </div>
            {registration.checkedInAt && <p className="text-muted">Checked in at {formatDate(registration.checkedInAt)}</p>}
            <p className="text-muted">Event ID: {eventId}</p>
            <Link to={`/events/${eventId}`} className="btn btn-ghost" style={{ marginTop: "0.75rem", display: "inline-block" }}>
              Back to event
            </Link>
          </Card>
        )}
      </div>
    </PublicLayout>
  );
}
