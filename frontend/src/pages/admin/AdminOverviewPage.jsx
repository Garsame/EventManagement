import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminClient } from "../../context/AdminAuthContext.jsx";
import { useAdminAuth } from "../../context/AdminAuthContext.jsx";
import AdminConsoleLayout from "../../components/layout/AdminConsoleLayout.jsx";
import Card from "../../components/ui/Card.jsx";
import Alert from "../../components/ui/Alert.jsx";
import Loading from "../../components/ui/Loading.jsx";
import Badge from "../../components/ui/Badge.jsx";

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

export default function AdminOverviewPage() {
  const { user } = useAdminAuth();
  const [events, setEvents] = useState([]);
  const [userCounts, setUserCounts] = useState({ attendee: 0, photographer: 0, admin: 0 });
  const [inactiveCount, setInactiveCount] = useState(0);
  const [openMessages, setOpenMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      adminClient.get("/api/admin/events"),
      adminClient.get("/api/admin/users"),
      adminClient.get("/api/admin/messages", { params: { status: "open" } }),
    ])
      .then(([ev, us, msg]) => {
        setEvents(ev.data.events);
        setUserCounts(us.data.counts);
        setInactiveCount(us.data.users.filter((u) => !u.isActive).length);
        setOpenMessages(msg.data.counts.open);
      })
      .catch((err) => setError(err.response?.data?.error?.message || "Could not load dashboard data"))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const upcoming = events
    .filter((e) => new Date(e.endDateTime) >= now && e.status !== "draft")
    .sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime))
    .slice(0, 5);
  const drafts = events.filter((e) => e.status === "draft").length;
  const unassigned = events.filter((e) => e.status !== "draft" && e.photographers.length === 0).length;
  const totals = events.reduce(
    (acc, e) => ({
      registrations: acc.registrations + e.registrationCount,
      attended: acc.attended + e.attendedCount,
      media: acc.media + e.mediaCount,
    }),
    { registrations: 0, attended: 0, media: 0 }
  );

  return (
    <AdminConsoleLayout title="Dashboard" subtitle={`Welcome back, ${user?.firstName || "admin"}.`}>
      {loading && <Loading />}
      {error && <Alert variant="error">{error}</Alert>}

      {!loading && !error && (
        <>
          <div className="grid grid-4">
            <Stat label="Events" value={events.length} hint={`${drafts} draft(s)`} />
            <Stat label="Registrations" value={totals.registrations} hint={`${totals.attended} checked in`} />
            <Stat label="Media files" value={totals.media} />
            <Stat label="Attendees" value={userCounts.attendee} hint={`${userCounts.photographer} photographers, ${userCounts.admin} admins`} />
          </div>

          {(unassigned > 0 || inactiveCount > 0 || openMessages > 0) && (
            <div className="section stack gap-3">
              {openMessages > 0 && (
                <Alert variant="warn">
                  {openMessages} contact message(s) awaiting a reply.{" "}
                  <Link to="/maamul/messages" className="underline font-bold">View messages</Link>
                </Alert>
              )}
              {unassigned > 0 && (
                <Alert variant="warn">
                  {unassigned} open event(s) have no photographer assigned.{" "}
                  <Link to="/maamul/events" className="underline font-bold">Assign now</Link>
                </Alert>
              )}
              {inactiveCount > 0 && (
                <Alert variant="info">
                  {inactiveCount} account(s) are currently deactivated and cannot sign in.
                </Alert>
              )}
            </div>
          )}

          <div className="section">
            <div className="page-header mb-4">
              <h3 className="text-lg font-bold m-0">Upcoming events</h3>
              <Link to="/maamul/events" className="btn btn-ghost">Manage events</Link>
            </div>

            {upcoming.length === 0 && <div className="empty-state"><p className="m-0">No upcoming events.</p></div>}

            <div className="stack gap-3">
              {upcoming.map((e) => (
                <Card key={e._id}>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <h4 className="m-0 text-base font-bold">{e.title}</h4>
                      <p className="text-muted m-0 mt-1 text-sm">{formatDate(e.startDateTime)} · {e.location || "TBA"}</p>
                    </div>
                    <div className="flex gap-2 items-center flex-wrap">
                      <Badge variant={e.status === "registration-open" ? "success" : "neutral"}>{e.status}</Badge>
                      {e.photographers.length === 0
                        ? <Badge variant="warn">No photographer</Badge>
                        : <Badge variant="info">{e.photographers.length} photographer(s)</Badge>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </AdminConsoleLayout>
  );
}
