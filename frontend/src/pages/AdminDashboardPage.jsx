import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client.js";
import Card from "../components/ui/Card.jsx";
import Alert from "../components/ui/Alert.jsx";
import Loading from "../components/ui/Loading.jsx";
import Badge from "../components/ui/Badge.jsx";
import SectionHeader from "../components/ui/SectionHeader.jsx";
import StatCard from "../components/ui/StatCard.jsx";
import AdminLayout from "../components/layout/AdminLayout.jsx";
import AdminSidebar from "../components/layout/AdminSidebar.jsx";

const formatDate = (v) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));

export default function AdminDashboardPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    client
      .get("/api/admin/events")
      .then((res) => setEvents(res.data.events))
      .catch((err) => setError(err.response?.data?.error?.message || "Could not load events"))
      .finally(() => setLoading(false));
  }, []);

  const totals = events.reduce(
    (acc, e) => ({
      events: acc.events + 1,
      published: acc.published + (e.published ? 1 : 0),
      registrations: acc.registrations + e.registrationCount,
      attended: acc.attended + e.attendedCount,
      media: acc.media + e.mediaCount,
      unassigned: acc.unassigned + (e.photographers.length === 0 ? 1 : 0),
    }),
    { events: 0, published: 0, registrations: 0, attended: 0, media: 0, unassigned: 0 }
  );

  const upcoming = [...events]
    .filter((e) => new Date(e.endDateTime) >= new Date())
    .sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime))
    .slice(0, 5);

  const topbar = (
    <div className="topbar">
      <SectionHeader title="Admin Dashboard" subtitle="Events, check-ins and media at a glance" />
      <Link to="/admin/events" className="btn btn-primary">Manage events</Link>
    </div>
  );

  return (
    <AdminLayout sidebar={<AdminSidebar />} topbar={topbar}>
      {loading && <Loading />}
      {error && <Alert variant="error">{error}</Alert>}

      {!loading && !error && (
        <>
          <div className="stat-grid">
            <StatCard label="Events" value={totals.events} hint={`${totals.published} published`} />
            <StatCard label="Registrations" value={totals.registrations} hint={`${totals.attended} checked in`} />
            <StatCard label="Media files" value={totals.media} hint="across all events" />
          </div>

          {totals.unassigned > 0 && (
            <Alert variant="warn" className="mt-5">
              {totals.unassigned} event(s) have no photographer assigned, so nobody can upload media for them.{" "}
              <Link to="/admin/events" className="underline font-bold">Assign photographers</Link>
            </Alert>
          )}

          <div className="section">
            <div className="page-header mb-4">
              <h3 className="text-lg font-bold m-0">Upcoming events</h3>
              <Link to="/admin/events" className="btn btn-ghost">View all</Link>
            </div>

            {upcoming.length === 0 && (
              <div className="empty-state"><p className="m-0">No upcoming events.</p></div>
            )}

            <div className="stack gap-3">
              {upcoming.map((e) => (
                <Card key={e._id}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <h4 className="m-0 text-base font-bold">{e.title}</h4>
                      <p className="text-muted m-0 mt-1 text-sm">
                        {formatDate(e.startDateTime)} · {e.location || "Location TBA"}
                      </p>
                      <p className="text-muted m-0 mt-1 text-sm">
                        {e.registrationCount} registered · {e.attendedCount} checked in · {e.mediaCount} media
                      </p>
                    </div>
                    <div className="flex gap-2 items-center flex-wrap">
                      {e.photographers.length === 0
                        ? <Badge variant="warn">No photographer</Badge>
                        : <Badge variant="success">{e.photographers.length} photographer(s)</Badge>}
                      <Link to="/admin/events" className="btn btn-ghost">Manage</Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
