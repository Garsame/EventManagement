import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { photographerClient, usePhotographerAuth } from "../../context/PhotographerAuthContext.jsx";
import PhotographerConsoleLayout from "../../components/layout/PhotographerConsoleLayout.jsx";
import Card from "../../components/ui/Card.jsx";
import Alert from "../../components/ui/Alert.jsx";
import Loading from "../../components/ui/Loading.jsx";
import Badge from "../../components/ui/Badge.jsx";
import IconBadge from "../../components/IconBadge.jsx";

const formatDate = (v) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));

const STATUS_BADGE = { draft: "neutral", "registration-open": "success", completed: "info" };

function Stat({ label, value, hint, icon, tone = "brand" }) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between gap-3">
        <div className="stat-label">{label}</div>
        <IconBadge icon={icon} tone={tone} size="sm" />
      </div>
      <div className="mt-3 flex items-baseline gap-2 flex-wrap">
        <div className="stat-value">{value}</div>
        {hint && <span className="text-xs font-semibold text-muted">{hint}</span>}
      </div>
    </div>
  );
}

export default function PhotographerDashboardPage() {
  const { user } = usePhotographerAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    photographerClient
      .get("/api/photographer/dashboard")
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error?.message || "Could not load your dashboard"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PhotographerConsoleLayout title="Dashboard" subtitle={`Welcome back, ${user?.firstName || ""}`}>
      {loading && <Loading />}
      {error && <Alert variant="error">{error}</Alert>}

      {!loading && !error && data && (
        <>
          <div className="grid grid-4">
            <Stat
              label="Media uploaded"
              value={data.totals.mediaUploaded}
              hint={`${data.totals.images} photos, ${data.totals.videos} videos`}
              icon="camera"
              tone="brand"
            />
            <Stat label="Events assigned" value={data.totals.eventsAssigned} icon="publish" tone="accent" />
            <Stat label="Upcoming events" value={data.totals.upcomingEvents} icon="checkin" tone="success" />
            <Stat label="Completed events" value={data.totals.completedEvents} icon="shield" tone="slate" />
          </div>

          {data.mostActiveEvent && (
            <Alert variant="info" className="mt-6">
              Your most active event is <strong>{data.mostActiveEvent.title}</strong> — {data.mostActiveEvent.mediaCount} media file(s) uploaded there.
            </Alert>
          )}

          <div className="section">
            <div className="page-header mb-4">
              <h3 className="text-lg font-bold m-0">Your events</h3>
              <Link to="/photographer/events" className="btn btn-ghost">View all</Link>
            </div>

            {data.events.length === 0 && (
              <div className="empty-state">
                <p className="m-0">You are not assigned to any events yet. An admin needs to assign you first.</p>
              </div>
            )}

            <div className="stack gap-3">
              {data.events.slice(0, 5).map((e) => (
                <Card key={e.id}>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <h4 className="m-0 text-base font-bold">{e.title}</h4>
                      <p className="text-muted m-0 mt-1 text-sm">{formatDate(e.startDateTime)} · {e.location || "TBA"}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant={STATUS_BADGE[e.status]}>{e.status}</Badge>
                      <span className="text-sm text-muted">{e.mediaCount} uploaded</span>
                      <Link to={`/photographer/events/${e.id}/media`} className="btn btn-ghost">Manage media</Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {data.recentUploads.length > 0 && (
            <div className="section">
              <h3 className="text-lg font-bold m-0 mb-4">Recent uploads</h3>
              <div className="gallery-grid">
                {data.recentUploads.map((m) => (
                  <Link
                    key={m.id}
                    to={m.event ? `/photographer/events/${m.event.id}/media` : "/photographer/events"}
                    className="gallery-tile"
                  >
                    {m.type === "video" ? (
                      <video src={m.url} poster={m.thumbnailUrl} muted />
                    ) : (
                      <img src={m.thumbnailUrl} alt={m.caption || "Uploaded media"} />
                    )}
                    {m.event && <span className="gallery-caption">{m.event.title}</span>}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </PhotographerConsoleLayout>
  );
}
