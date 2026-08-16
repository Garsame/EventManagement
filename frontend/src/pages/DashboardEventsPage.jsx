import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client.js";
import DashboardLayout from "../components/layout/DashboardLayout.jsx";
import Card from "../components/ui/Card.jsx";
import Alert from "../components/ui/Alert.jsx";
import Loading from "../components/ui/Loading.jsx";
import Badge from "../components/ui/Badge.jsx";
import EventJourney, { stageMessage } from "../components/EventJourney.jsx";

const formatDate = (v) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));

const FILTERS = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "attended", label: "Attended" },
  { key: "galleries", label: "With galleries" },
];

export default function DashboardEventsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    client
      .get("/api/users/me/registrations")
      .then((res) => setItems(res.data.registrations))
      .catch((err) => setError(err.response?.data?.error?.message || "Could not load your events"))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    if (filter === "upcoming") return items.filter((i) => !i.hasEnded);
    if (filter === "attended") return items.filter((i) => i.attended);
    if (filter === "galleries") return items.filter((i) => i.stage === "gallery-ready");
    return items;
  }, [items, filter]);

  return (
    <DashboardLayout
      title="Your events"
      subtitle="Every event you registered for and the stage you have reached."
    >
      {loading && <Loading />}
      {error && <Alert variant="error">{error}</Alert>}

      {!loading && !error && (
        <>
          <div className="flex gap-2 flex-wrap mb-5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`btn ${filter === f.key ? "btn-primary" : "btn-ghost"} !px-4 !py-2`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {visible.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🗓️</div>
              <p className="m-0">
                {items.length === 0
                  ? "You have not registered for any events yet."
                  : "No events match this filter."}
              </p>
              <Link to="/events" className="btn btn-primary mt-4">Browse events</Link>
            </div>
          )}

          <div className="stack gap-4">
            {visible.map((item) => (
              <Card key={item.registrationId}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <h3 className="m-0 text-lg font-bold">{item.event.title}</h3>
                    <p className="text-muted m-0 mt-1">
                      {formatDate(item.event.startDateTime)} · {item.event.location || "Location TBA"}
                    </p>
                  </div>
                  <div className="flex gap-2 items-center flex-wrap">
                    {item.hasEnded && <Badge variant="neutral">Ended</Badge>}
                    <Badge variant={item.attended ? "success" : "warn"}>
                      {item.attended ? "Checked in" : "Registered"}
                    </Badge>
                    {item.event.isPremium && (
                      <Badge variant={item.paymentStatus === "paid" ? "success" : item.paymentStatus === "refunded" ? "neutral" : "warn"}>
                        {item.paymentStatus === "paid" ? "Payment confirmed" : item.paymentStatus === "refunded" ? "Refunded" : "Payment pending"}
                      </Badge>
                    )}
                  </div>
                </div>

                {item.event.isPremium && (
                  <p className="text-muted text-sm mt-2 mb-0">
                    Plan: <strong>{item.planName}</strong> — {item.currency} {item.amountDue}
                  </p>
                )}

                <div className="mt-5">
                  <EventJourney stage={item.stage} />
                </div>

                <p className="text-muted text-sm mt-4 mb-0">{stageMessage(item)}</p>

                <div className="card-muted mt-4 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-xs uppercase tracking-wide">Registration code</div>
                    <strong className="text-base tracking-wider">{item.registrationCode}</strong>
                  </div>
                  {item.checkedInAt && (
                    <div className="text-sm">Checked in {formatDate(item.checkedInAt)}</div>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap mt-4">
                  <Link to={`/dashboard/events/${item.event.id}/registration`} className="btn btn-ghost">
                    QR code
                  </Link>
                  <Link to={`/dashboard/events/${item.event.id}`} className="btn btn-ghost">Event details</Link>
                  {item.stage === "gallery-ready" ? (
                    <Link to={`/dashboard/events/${item.event.id}/gallery`} className="btn btn-primary">
                      View gallery ({item.mediaCount})
                    </Link>
                  ) : (
                    <button type="button" className="btn btn-ghost" disabled title={stageMessage(item)}>
                      Gallery locked
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
