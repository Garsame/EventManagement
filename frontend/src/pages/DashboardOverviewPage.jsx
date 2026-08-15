import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client.js";
import DashboardLayout from "../components/layout/DashboardLayout.jsx";
import Card from "../components/ui/Card.jsx";
import Alert from "../components/ui/Alert.jsx";
import Loading from "../components/ui/Loading.jsx";
import Badge from "../components/ui/Badge.jsx";
import EventJourney from "../components/EventJourney.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const REQUIRED_LABELS = {
  phone: "Mobile number",
  location: "Location",
  institution: "Institution",
  educationLevel: "Education level",
  sex: "Sex",
};

const formatDate = (v) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));

function Stat({ label, value, hint, tone = "" }) {
  return (
    <div className="stat-card">
      <div className={`stat-value ${tone}`}>{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="text-muted text-xs mt-1">{hint}</div>}
    </div>
  );
}

export default function DashboardOverviewPage() {
  const { user } = useAuth();
  const [data, setData] = useState({ registrations: [], stats: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    client
      .get("/api/users/me/registrations")
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error?.message || "Could not load your events"))
      .finally(() => setLoading(false));
  }, []);

  const stats = data.stats;

  const completion = useMemo(() => {
    const missing = user?.missingProfileFields?.length || 0;
    const total = 5;
    return Math.round(((total - missing) / total) * 100);
  }, [user]);

  const nextUp = useMemo(
    () =>
      [...data.registrations]
        .filter((r) => !r.hasEnded)
        .sort((a, b) => new Date(a.event.startDateTime) - new Date(b.event.startDateTime))[0],
    [data.registrations]
  );

  return (
    <DashboardLayout
      title={`Welcome back, ${user?.firstName || "there"}`}
      subtitle="Everything you have joined, at a glance."
    >
      {loading && <Loading />}
      {error && <Alert variant="error">{error}</Alert>}

      {!loading && stats && (
        <>
          <div className="grid grid-4">
            <Stat label="Events joined" value={stats.total} hint="all time" />
            <Stat label="Attended" value={stats.attended} hint="checked in on site" tone="text-emerald-600 dark:text-emerald-400" />
            <Stat label="Awaiting check-in" value={stats.pending} hint="upcoming" tone="text-amber-600 dark:text-amber-400" />
            <Stat label="Photos available" value={stats.photosAvailable} hint={`${stats.galleriesAvailable} gallery/galleries`} />
          </div>

          {!user?.profileComplete && (
            <div className="section">
              <Card>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="m-0 text-lg font-bold">Complete your profile</h3>
                    <p className="text-muted m-0 mt-1">
                      Organisers need these details before you can register for an event.
                    </p>
                  </div>
                  <Link to="/dashboard/profile" className="btn btn-primary">Complete profile</Link>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-semibold">{completion}% complete</span>
                    <span className="text-muted">{user?.missingProfileFields?.length || 0} field(s) left</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${completion}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {(user?.missingProfileFields || []).map((f) => (
                      <span key={f} className="badge badge-warn">{REQUIRED_LABELS[f] || f}</span>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          )}

          <div className="section">
            <div className="page-header mb-4">
              <h2 className="text-xl font-extrabold m-0">Next up</h2>
              <Link to="/dashboard/events" className="btn btn-ghost">View all events</Link>
            </div>

            {!nextUp && (
              <div className="empty-state">
                <div className="empty-icon">🎟️</div>
                <p className="m-0">You have no upcoming events.</p>
                <Link to="/events" className="btn btn-primary mt-4">Browse events</Link>
              </div>
            )}

            {nextUp && (
              <Card>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <h3 className="m-0 text-lg font-bold truncate">{nextUp.event.title}</h3>
                    <p className="text-muted m-0 mt-1">
                      {formatDate(nextUp.event.startDateTime)} · {nextUp.event.location || "Location TBA"}
                    </p>
                  </div>
                  <Badge variant={nextUp.attended ? "success" : "warn"}>
                    {nextUp.attended ? "Checked in" : "Not checked in"}
                  </Badge>
                </div>

                <div className="mt-5">
                  <EventJourney stage={nextUp.stage} />
                </div>

                <div className="flex gap-2 flex-wrap mt-5">
                  <Link to={`/events/${nextUp.event.id}/registration`} className="btn btn-primary">
                    Show my QR code
                  </Link>
                  <Link to={`/events/${nextUp.event.id}`} className="btn btn-ghost">Event details</Link>
                </div>
              </Card>
            )}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
