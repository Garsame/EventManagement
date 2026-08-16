import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminClient } from "../../context/AdminAuthContext.jsx";
import AdminConsoleLayout from "../../components/layout/AdminConsoleLayout.jsx";
import Card from "../../components/ui/Card.jsx";
import Input from "../../components/ui/Input.jsx";
import Alert from "../../components/ui/Alert.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
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

const PAYMENT_BADGE = { pending: "warn", paid: "success", refunded: "neutral" };
const PAYMENT_LABEL = { pending: "Payment pending", paid: "Paid", refunded: "Refunded" };

export default function AdminEventRegistrationsPage() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [counts, setCounts] = useState({ total: 0, attended: 0, notAttended: 0, paid: 0, pendingPayment: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);

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

  const setPayment = async (registrationId, paymentStatus) => {
    setBusyId(registrationId);
    setError("");
    try {
      const res = await adminClient.patch(
        `/api/admin/events/${eventId}/registrations/${registrationId}/payment`,
        { paymentStatus }
      );
      setRegistrations((prev) => prev.map((r) => (r.id === registrationId ? { ...r, ...res.data.registration } : r)));
      setCounts((prev) => {
        const wasPaid = registrations.find((r) => r.id === registrationId)?.paymentStatus === "paid";
        const wasPending = registrations.find((r) => r.id === registrationId)?.paymentStatus === "pending";
        const amount = registrations.find((r) => r.id === registrationId)?.amountDue || 0;
        return {
          ...prev,
          paid: prev.paid + (paymentStatus === "paid" ? 1 : 0) - (wasPaid ? 1 : 0),
          pendingPayment: prev.pendingPayment + (paymentStatus === "pending" ? 1 : 0) - (wasPending ? 1 : 0),
          revenue: prev.revenue + (paymentStatus === "paid" ? amount : 0) - (wasPaid ? amount : 0),
        };
      });
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not update payment status");
    } finally {
      setBusyId(null);
    }
  };

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
      actions={
        <Link to={event?.isPremium ? "/maamul/premium-events" : "/maamul/events"} className="btn btn-ghost">
          Back to events
        </Link>
      }
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
            {event?.isPremium && (
              <>
                <div className="stat-card">
                  <div className="stat-label">Paid</div>
                  <div className="stat-value">{counts.paid}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Pending payment</div>
                  <div className="stat-value">{counts.pendingPayment}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Revenue</div>
                  <div className="stat-value">{event.currency || "USD"} {counts.revenue}</div>
                </div>
              </>
            )}
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
                        {event?.isPremium && (
                          <Badge variant={PAYMENT_BADGE[r.paymentStatus] || "neutral"}>{PAYMENT_LABEL[r.paymentStatus] || r.paymentStatus}</Badge>
                        )}
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
                      {event?.isPremium && (
                        <div className="mt-2">
                          <p className="text-sm m-0">
                            <strong>{r.planName || "No plan"}</strong>
                            {r.amountDue != null && <> — {r.currency || event.currency || "USD"} {r.amountDue}</>}
                            {r.paymentReference && <span className="text-muted"> · ref: {r.paymentReference}</span>}
                          </p>
                          <div className="flex gap-2 flex-wrap mt-1.5">
                            {r.paymentStatus !== "paid" && (
                              <Button type="button" variant="ghost" onClick={() => setPayment(r.id, "paid")} disabled={busyId === r.id}>
                                Mark paid
                              </Button>
                            )}
                            {r.paymentStatus !== "pending" && (
                              <Button type="button" variant="ghost" onClick={() => setPayment(r.id, "pending")} disabled={busyId === r.id}>
                                Mark pending
                              </Button>
                            )}
                            {r.paymentStatus !== "refunded" && (
                              <Button type="button" variant="ghost" onClick={() => setPayment(r.id, "refunded")} disabled={busyId === r.id}>
                                Mark refunded
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
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
