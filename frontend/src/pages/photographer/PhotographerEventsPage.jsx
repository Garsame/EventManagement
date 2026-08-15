import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { photographerClient, usePhotographerAuth } from "../../context/PhotographerAuthContext.jsx";
import PhotographerConsoleLayout from "../../components/layout/PhotographerConsoleLayout.jsx";
import Card from "../../components/ui/Card.jsx";
import Alert from "../../components/ui/Alert.jsx";
import Loading from "../../components/ui/Loading.jsx";
import Badge from "../../components/ui/Badge.jsx";

const formatDate = (v) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));

const STATUS_BADGE = { draft: "neutral", "registration-open": "success", completed: "info" };

export default function PhotographerEventsPage() {
  const { user } = usePhotographerAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    photographerClient
      .get("/api/admin/events")
      .then((res) => setEvents(res.data.events.filter((e) => e.photographers.some((p) => p.id === user?.id))))
      .catch((err) => setError(err.response?.data?.error?.message || "Could not load your events"))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <PhotographerConsoleLayout title="My events" subtitle={`Welcome back, ${user?.firstName || ""}`}>
      {loading && <Loading />}
      {error && <Alert variant="error">{error}</Alert>}

      {!loading && !error && events.length === 0 && (
        <div className="empty-state">
          <p className="m-0">You are not assigned to any events yet. An admin needs to assign you first.</p>
        </div>
      )}

      <div className="stack gap-4">
        {events.map((e) => (
          <Card key={e._id}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <h4 className="m-0 text-base font-bold">{e.title}</h4>
                <p className="text-muted m-0 mt-1 text-sm">{formatDate(e.startDateTime)} · {e.location || "TBA"}</p>
                <p className="text-muted m-0 mt-1 text-sm">{e.mediaCount} media file(s) uploaded</p>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <Badge variant={STATUS_BADGE[e.status]}>{e.status}</Badge>
                <Link to={`/photographer/events/${e._id}/media`} className="btn btn-primary">Manage media</Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </PhotographerConsoleLayout>
  );
}
