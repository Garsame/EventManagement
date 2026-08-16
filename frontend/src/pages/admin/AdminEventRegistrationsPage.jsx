import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminClient } from "../../context/AdminAuthContext.jsx";
import AdminConsoleLayout from "../../components/layout/AdminConsoleLayout.jsx";
import Card from "../../components/ui/Card.jsx";
import Input from "../../components/ui/Input.jsx";
import Alert from "../../components/ui/Alert.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Loading from "../../components/ui/Loading.jsx";
import Avatar from "../../components/Avatar.jsx";

const formatDateTime = (v) =>
  v ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v)) : "";

const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : 0);

const FILTERS = [
  { key: "all", label: "All" },
  { key: "attended", label: "Checked in" },
  { key: "not-attended", label: "Not checked in" },
];

export default function AdminEventRegistrationsPage() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [counts, setCounts] = useState({ total: 0, attended: 0, notAttended: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    setLoading(true);
    adminClient
      .get(`/api/admin/events/${eventId}/registrations`)
      .then((res) => {
        setEvent(res.data.event);
        setRegistrations(res.data.registrations);
        setCounts(res.data.counts);
        setError("");
      })
      .catch((err) => setError(err.response?.data?.error?.message || "Could not load registrations"))
      .finally(() => setLoading(false));
  }, [eventId]);

  const visible = useMemo(() => {
    let list = registrations;
    if (filter === "attended") list = list.filter((r) => r.attended);
    if (filter === "not-attended") list = list.filter((r) => !r.attended);
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((r) =>
        [r.user?.fullName, r.user?.email, r.user?.phone, r.registrationCode]
          .filter(Boolean)
          .some((s) => s.toLowerCase().includes(query))
      );
    }
    return list;
  }, [registrations, filter, q]);

  return (
    <AdminConsoleLayout
      title="Registrations"
      subtitle={event ? event.title : "Loading event…"}
      actions={<Link to="/maamul/events" className="btn btn-ghost">Back to events</Link>}
    >
      {loading && <Loading />}
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {!loading && !error && (
        <>
          <div className="grid grid-3 mb-6">
            <div className="stat-card">
              <div className="stat-label">Registered</div>
              <div className="stat-value">{counts.total}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Checked in</div>
              <div className="stat-value">{counts.attended}</div>
              <div className="text-xs font-semibold text-muted mt-1">{pct(counts.attended, counts.total)}% attendance</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Not checked in</div>
              <div className="stat-value">{counts.notAttended}</div>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap items-end mb-5">
            <Input
              className="!mb-0 max-w-xs"
              placeholder="Search by name, email, or code…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="flex gap-2 flex-wrap">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`btn ${filter === f.key ? "btn-primary" : "btn-ghost"} !px-3 !py-2 text-xs`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 && (
            <div className="empty-state"><p className="m-0">No registrations match.</p></div>
          )}

          {visible.length > 0 && (
            <Card className="!p-0 overflow-hidden">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {visible.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 px-4 py-3.5 flex-wrap sm:flex-nowrap">
                    <Avatar user={{ ...r.user, initials: r.user?.fullName?.[0] || "?" }} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="m-0 font-bold truncate">{r.user?.fullName || "Deleted account"}</p>
                        {r.attended
                          ? <Badge variant="success">✓ Checked in</Badge>
                          : <Badge variant="neutral">Not yet</Badge>}
                      </div>
                      <p className="text-muted m-0 mt-0.5 text-sm truncate">
                        {r.user?.email}
                        {r.user?.phone ? ` · ${r.user.phone}` : ""}
                      </p>
                      {r.user?.institution && (
                        <p className="text-muted m-0 mt-0.5 text-xs truncate">{r.user.institution}</p>
                      )}
                      <p className="text-xs text-muted m-0 mt-1.5">
                        Registered {formatDateTime(r.registeredAt)}
                        {r.attended && r.checkedInAt && (
                          <> · Checked in {formatDateTime(r.checkedInAt)}{r.checkedInBy ? ` by ${r.checkedInBy.fullName}` : ""}</>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[10px] uppercase font-bold text-muted mb-1">Serial / QR code</div>
                      <span className="card-muted !inline-block !py-1.5 !px-3 font-bold tracking-widest text-sm">
                        {r.registrationCode}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </AdminConsoleLayout>
  );
}
