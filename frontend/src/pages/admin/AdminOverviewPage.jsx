import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminClient } from "../../context/AdminAuthContext.jsx";
import { useAdminAuth } from "../../context/AdminAuthContext.jsx";
import AdminConsoleLayout from "../../components/layout/AdminConsoleLayout.jsx";
import Card from "../../components/ui/Card.jsx";
import Alert from "../../components/ui/Alert.jsx";
import Loading from "../../components/ui/Loading.jsx";
import Badge from "../../components/ui/Badge.jsx";
import IconBadge from "../../components/IconBadge.jsx";

const formatDate = (v) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));

const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : 0);

const STATUS_BADGE = { draft: "neutral", "registration-open": "success", completed: "info" };
const STATUS_LABEL = { draft: "Draft", "registration-open": "Registration open", completed: "Completed" };
const STATUS_BAR_COLOR = {
  draft: "bg-slate-300 dark:bg-slate-600",
  "registration-open": "bg-emerald-500",
  completed: "bg-brand-500",
};

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

/** Small labelled progress bar used for check-in / attendance rates. */
function RateBar({ label, done, total }) {
  const rate = pct(done, total);
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-sm font-bold text-muted">{rate}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${rate}%` }} />
      </div>
      <p className="text-xs text-muted mt-1 mb-0">{done} of {total}</p>
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
  const recentlyCompleted = events
    .filter((e) => e.status === "completed")
    .sort((a, b) => new Date(b.endDateTime) - new Date(a.endDateTime))
    .slice(0, 3);

  const unassigned = events.filter((e) => e.status !== "draft" && e.photographers.length === 0).length;

  const totals = events.reduce(
    (acc, e) => ({
      registrations: acc.registrations + e.registrationCount,
      attended: acc.attended + e.attendedCount,
      media: acc.media + e.mediaCount,
    }),
    { registrations: 0, attended: 0, media: 0 }
  );

  const statusCounts = events.reduce(
    (acc, e) => ({ ...acc, [e.status]: (acc[e.status] || 0) + 1 }),
    { draft: 0, "registration-open": 0, completed: 0 }
  );

  const totalAccounts = userCounts.attendee + userCounts.photographer + userCounts.admin;

  return (
    <AdminConsoleLayout title="Dashboard" subtitle={`Welcome back, ${user?.firstName || "admin"}.`}>
      {loading && <Loading />}
      {error && <Alert variant="error">{error}</Alert>}

      {!loading && !error && (
        <>
          {(unassigned > 0 || inactiveCount > 0 || openMessages > 0) && (
            <div className="stack gap-3 mb-6">
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

          {/* People: who holds which role, at a glance. */}
          <div className="section !mt-0">
            <h3 className="text-lg font-bold m-0 mb-4">People</h3>
            <div className="grid grid-4">
              <Stat label="Total accounts" value={totalAccounts} icon="shield" tone="slate" />
              <Stat label="Attendees" value={userCounts.attendee} icon="register" tone="brand" />
              <Stat label="Photographers" value={userCounts.photographer} icon="camera" tone="accent" />
              <Stat label="Admins" value={userCounts.admin} icon="shield" tone="success" />
            </div>
          </div>

          {/* Events: lifecycle mix plus how the whole program is converting
              registrations into actual attendance. */}
          <div className="section">
            <h3 className="text-lg font-bold m-0 mb-4">Events</h3>
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              <Card>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <span className="font-bold">{events.length} event(s) total</span>
                </div>
                {events.length > 0 && (
                  <div className="flex h-3 w-full rounded-full overflow-hidden mb-3">
                    {["draft", "registration-open", "completed"].map((s) =>
                      statusCounts[s] > 0 ? (
                        <div
                          key={s}
                          className={STATUS_BAR_COLOR[s]}
                          style={{ width: `${pct(statusCounts[s], events.length)}%` }}
                          title={`${STATUS_LABEL[s]}: ${statusCounts[s]}`}
                        />
                      ) : null
                    )}
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {["draft", "registration-open", "completed"].map((s) => (
                    <div key={s} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${STATUS_BAR_COLOR[s]}`} />
                        {STATUS_LABEL[s]}
                      </span>
                      <span className="font-bold">{statusCounts[s]}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <div className="stack gap-4">
                  <RateBar label="Overall check-in rate" done={totals.attended} total={totals.registrations} />
                  <div className="grid grid-3 !gap-3">
                    <div className="card-muted !p-3">
                      <div className="text-xs uppercase">Registered</div>
                      <strong className="text-lg">{totals.registrations}</strong>
                    </div>
                    <div className="card-muted !p-3">
                      <div className="text-xs uppercase">Checked in</div>
                      <strong className="text-lg">{totals.attended}</strong>
                    </div>
                    <div className="card-muted !p-3">
                      <div className="text-xs uppercase">Media files</div>
                      <strong className="text-lg">{totals.media}</strong>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <div className="section">
            <div className="page-header mb-4">
              <h3 className="text-lg font-bold m-0">Upcoming events</h3>
              <Link to="/maamul/events" className="btn btn-ghost">Manage events</Link>
            </div>

            {upcoming.length === 0 && <div className="empty-state"><p className="m-0">No upcoming events.</p></div>}

            <div className="stack gap-3">
              {upcoming.map((e) => (
                <Card key={e._id}>
                  <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
                    <div className="min-w-0">
                      <h4 className="m-0 text-base font-bold">{e.title}</h4>
                      <p className="text-muted m-0 mt-1 text-sm">{formatDate(e.startDateTime)} · {e.location || "TBA"}</p>
                    </div>
                    <div className="flex gap-2 items-center flex-wrap">
                      <Badge variant={STATUS_BADGE[e.status]}>{STATUS_LABEL[e.status]}</Badge>
                      {e.photographers.length === 0
                        ? <Badge variant="warn">No photographer</Badge>
                        : <Badge variant="info">{e.photographers.length} photographer(s)</Badge>}
                    </div>
                  </div>
                  <div className="flex items-end gap-4 flex-wrap">
                    <div className="flex-1 min-w-[180px]">
                      <RateBar label="Check-in rate" done={e.attendedCount} total={e.registrationCount} />
                    </div>
                    <Link to={`/maamul/events/${e._id}/registrations`} className="btn btn-ghost">View registrations</Link>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {recentlyCompleted.length > 0 && (
            <div className="section">
              <h3 className="text-lg font-bold m-0 mb-4">Recently completed</h3>
              <div className="stack gap-3">
                {recentlyCompleted.map((e) => (
                  <Card key={e._id}>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <h4 className="m-0 text-base font-bold">{e.title}</h4>
                        <p className="text-muted m-0 mt-1 text-sm">Ended {formatDate(e.endDateTime)}</p>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
                        <Badge variant="success">{pct(e.attendedCount, e.registrationCount)}% attended</Badge>
                        <span className="text-sm text-muted">{e.attendedCount} of {e.registrationCount} checked in</span>
                        <Link to={`/maamul/events/${e._id}/registrations`} className="btn btn-ghost">View registrations</Link>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </AdminConsoleLayout>
  );
}
