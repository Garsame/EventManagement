import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminClient } from "../../context/AdminAuthContext.jsx";
import AdminConsoleLayout from "../../components/layout/AdminConsoleLayout.jsx";
import Card from "../../components/ui/Card.jsx";
import Input from "../../components/ui/Input.jsx";
import Textarea from "../../components/ui/Textarea.jsx";
import Alert from "../../components/ui/Alert.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Loading from "../../components/ui/Loading.jsx";
import Avatar from "../../components/Avatar.jsx";
import { useToast } from "../../context/ToastContext.jsx";

const formatDateTime = (v) =>
  v ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v)) : "";
const formatDate = (v) =>
  v ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(v)) : "";

const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : 0);

const APPROVAL = {
  pending: { label: "Pending", badge: "warn" },
  approved: { label: "Approved", badge: "success" },
  rejected: { label: "Rejected", badge: "danger" },
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "attended", label: "Checked in" },
];

const PAYMENT_BADGE = { pending: "warn", paid: "success", refunded: "neutral" };
const PAYMENT_LABEL = { pending: "Payment pending", paid: "Paid", refunded: "Refunded" };

const EDUCATION_LABEL = {
  "high-school": "High school", certificate: "Certificate", diploma: "Diploma",
  bachelors: "Bachelor's degree", masters: "Master's degree", doctorate: "Doctorate", other: "Other",
};
const SEX_LABEL = { female: "Female", male: "Male", "prefer-not-to-say": "Prefer not to say" };

/** One labelled value in the review panel. */
const Detail = ({ label, children }) => (
  <div className="min-w-0">
    <div className="text-[11px] uppercase font-bold text-muted tracking-wide">{label}</div>
    <div className="text-sm mt-0.5 break-words">{children || <span className="text-muted">—</span>}</div>
  </div>
);

export default function AdminEventRegistrationsPage() {
  const { eventId } = useParams();
  const { showToast } = useToast();
  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);

  const [viewing, setViewing] = useState(null);
  // A decision the admin has chosen but not yet confirmed; the note is
  // attached here so it can be typed before the email goes out.
  const [deciding, setDeciding] = useState(null);
  const [note, setNote] = useState("");

  const load = () => {
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
  };

  useEffect(load, [eventId]);

  const submitDecision = async () => {
    const { registration, status } = deciding;
    setBusyId(registration.id);
    setError("");
    try {
      const res = await adminClient.patch(
        `/api/admin/events/${eventId}/registrations/${registration.id}/approval`,
        { approvalStatus: status, note: note.trim() }
      );
      const updated = res.data.registration;
      setRegistrations((prev) =>
        prev.map((r) => (r.id === registration.id ? { ...r, ...updated } : r))
      );
      setCounts((prev) => ({
        ...prev,
        [registration.approvalStatus]: Math.max(0, (prev[registration.approvalStatus] || 0) - 1),
        [status]: (prev[status] || 0) + 1,
      }));
      setDeciding(null);
      setNote("");

      const name = registration.user?.fullName || "the guest";
      if (status === "approved") {
        showToast(
          res.data.emailDelivered
            ? `${name} approved — code and QR emailed to them.`
            : `${name} approved, but the email could not be sent. Code: ${updated.registrationCode}`,
          { variant: res.data.emailDelivered ? "success" : "error", duration: res.data.emailDelivered ? 5000 : 12000 }
        );
      } else if (status === "rejected") {
        showToast(
          res.data.emailDelivered
            ? `${name} rejected — they have been notified and can register for other events.`
            : `${name} rejected, but the notification email could not be sent.`,
          { variant: res.data.emailDelivered ? "success" : "error" }
        );
      } else {
        showToast(`${name} moved back to pending. Their code has been revoked.`);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not update this registration");
      setDeciding(null);
    } finally {
      setBusyId(null);
    }
  };

  const setPayment = async (registrationId, paymentStatus) => {
    setBusyId(registrationId);
    setError("");
    try {
      const res = await adminClient.patch(
        `/api/admin/events/${eventId}/registrations/${registrationId}/payment`,
        { paymentStatus }
      );
      setRegistrations((prev) => prev.map((r) => (r.id === registrationId ? { ...r, ...res.data.registration } : r)));
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not update payment status");
    } finally {
      setBusyId(null);
    }
  };

  const visible = useMemo(() => {
    let list = registrations;
    if (filter === "attended") list = list.filter((r) => r.attended);
    else if (filter !== "all") list = list.filter((r) => r.approvalStatus === filter);
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((r) =>
        [r.user?.fullName, r.user?.email, r.user?.phone, r.user?.institution, r.registrationCode]
          .filter(Boolean)
          .some((s) => s.toLowerCase().includes(query))
      );
    }
    return list;
  }, [registrations, filter, q]);

  const pendingCount = counts.pending || 0;

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
          {pendingCount > 0 && (
            <Alert variant="warn" className="mb-5">
              <strong>{pendingCount}</strong> {pendingCount === 1 ? "guest is" : "guests are"} waiting
              for your decision. Only approved guests receive a QR code and can be checked in.
            </Alert>
          )}

          <div className="grid grid-4 mb-6">
            <div className="stat-card">
              <div className="stat-label">Requested</div>
              <div className="stat-value">{counts.total || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pending</div>
              <div className="stat-value text-amber-600 dark:text-amber-400">{counts.pending || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Approved</div>
              <div className="stat-value text-emerald-600 dark:text-emerald-400">{counts.approved || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Checked in</div>
              <div className="stat-value">{counts.attended || 0}</div>
              <div className="text-xs font-semibold text-muted mt-1">
                {pct(counts.attended, counts.approved)}% of approved
              </div>
            </div>
            {event?.isPremium && (
              <>
                <div className="stat-card">
                  <div className="stat-label">Paid</div>
                  <div className="stat-value">{counts.paid || 0}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Revenue</div>
                  <div className="stat-value">{event.currency || "USD"} {counts.revenue || 0}</div>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 flex-wrap items-end mb-5">
            <Input
              className="!mb-0 max-w-xs"
              placeholder="Search name, email, institution, code…"
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
                  {f.key !== "all" && counts[f.key === "attended" ? "attended" : f.key] > 0 && (
                    <span className="ml-1.5 opacity-70">{counts[f.key === "attended" ? "attended" : f.key]}</span>
                  )}
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
                {visible.map((r) => {
                  const approval = APPROVAL[r.approvalStatus] || APPROVAL.pending;
                  const busy = busyId === r.id;
                  return (
                    <div key={r.id} className="px-4 py-3.5">
                      <div className="flex items-start gap-3 flex-wrap sm:flex-nowrap">
                        <Avatar user={{ ...r.user, initials: r.user?.fullName?.[0] || "?" }} size="md" />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="m-0 font-bold truncate">{r.user?.fullName || "Deleted account"}</p>
                            <Badge variant={approval.badge}>{approval.label}</Badge>
                            {r.attended && <Badge variant="success">✓ Checked in</Badge>}
                            {event?.isPremium && (
                              <Badge variant={PAYMENT_BADGE[r.paymentStatus] || "neutral"}>
                                {PAYMENT_LABEL[r.paymentStatus] || r.paymentStatus}
                              </Badge>
                            )}
                          </div>
                          <p className="text-muted m-0 mt-0.5 text-sm truncate">
                            {r.user?.email}{r.user?.phone ? ` · ${r.user.phone}` : ""}
                          </p>
                          <p className="text-xs text-muted m-0 mt-1">
                            Requested {formatDateTime(r.registeredAt)}
                            {r.decidedAt && <> · Decided {formatDateTime(r.decidedAt)}{r.decidedBy ? ` by ${r.decidedBy.fullName}` : ""}</>}
                            {r.attended && r.checkedInAt && <> · Checked in {formatDateTime(r.checkedInAt)}</>}
                          </p>
                          {r.decisionNote && (
                            <p className="text-xs text-muted m-0 mt-1 italic">“{r.decisionNote}”</p>
                          )}
                        </div>

                        <div className="shrink-0 flex items-center gap-2 flex-wrap">
                          {/* The code only exists once approved. */}
                          {r.approvalStatus === "approved" && r.registrationCode ? (
                            <span className="card-muted !inline-block !py-1.5 !px-3 font-bold tracking-widest text-sm">
                              {r.registrationCode}
                            </span>
                          ) : (
                            <span className="text-xs text-muted">No code issued</span>
                          )}

                          <Button type="button" variant="ghost" onClick={() => setViewing(r)}>
                            View
                          </Button>

                          <select
                            className="select !w-36 !py-2 !text-sm"
                            value={r.approvalStatus}
                            disabled={busy || r.attended}
                            title={r.attended ? "Already checked in — approval cannot be changed" : undefined}
                            onChange={(e) => {
                              if (e.target.value !== r.approvalStatus) {
                                setNote("");
                                setDeciding({ registration: r, status: e.target.value });
                              }
                            }}
                          >
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </div>
                      </div>

                      {event?.isPremium && (
                        <div className="mt-2 pl-0 sm:pl-14">
                          <p className="text-sm m-0">
                            <strong>{r.planName || "No plan"}</strong>
                            {r.amountDue != null && <> — {r.currency || event.currency || "USD"} {r.amountDue}</>}
                            {r.paymentReference && <span className="text-muted"> · ref: {r.paymentReference}</span>}
                          </p>
                          <div className="flex gap-2 flex-wrap mt-1.5">
                            {["paid", "pending", "refunded"]
                              .filter((s) => s !== r.paymentStatus)
                              .map((s) => (
                                <Button key={s} type="button" variant="ghost" onClick={() => setPayment(r.id, s)} disabled={busy}>
                                  Mark {s}
                                </Button>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}

      {/* ---------- Everything the guest submitted ---------- */}
      {viewing && (
        <Modal title="Attendee details" onClose={() => setViewing(null)} wide>
          <div className="flex items-center gap-3 mb-5">
            <Avatar user={{ ...viewing.user, initials: viewing.user?.fullName?.[0] || "?" }} size="lg" />
            <div className="min-w-0">
              <h3 className="m-0 text-lg font-bold truncate">{viewing.user?.fullName || "Deleted account"}</h3>
              <p className="text-muted m-0 text-sm truncate">{viewing.user?.email}</p>
            </div>
            <div className="ml-auto shrink-0">
              <Badge variant={(APPROVAL[viewing.approvalStatus] || APPROVAL.pending).badge}>
                {(APPROVAL[viewing.approvalStatus] || APPROVAL.pending).label}
              </Badge>
            </div>
          </div>

          <div className="card-muted !p-4 mb-4">
            <div className="grid grid-2 gap-4">
              <Detail label="Mobile number">{viewing.user?.phone}</Detail>
              <Detail label="Location">{viewing.user?.location}</Detail>
              <Detail label="Institution">{viewing.user?.institution}</Detail>
              <Detail label="Education level">
                {EDUCATION_LABEL[viewing.user?.educationLevel] || viewing.user?.educationLevel}
              </Detail>
              <Detail label="Field of study">{viewing.user?.fieldOfStudy}</Detail>
              <Detail label="Sex">{SEX_LABEL[viewing.user?.sex] || viewing.user?.sex}</Detail>
              <Detail label="Date of birth">{formatDate(viewing.user?.dateOfBirth)}</Detail>
              <Detail label="Member since">{formatDate(viewing.user?.memberSince)}</Detail>
            </div>
            {viewing.user?.bio && (
              <div className="mt-4">
                <Detail label="Short bio">{viewing.user.bio}</Detail>
              </div>
            )}
          </div>

          <div className="card-muted !p-4 mb-4">
            <div className="grid grid-2 gap-4">
              <Detail label="Requested">{formatDateTime(viewing.registeredAt)}</Detail>
              <Detail label="Decision">
                {viewing.decidedAt
                  ? `${(APPROVAL[viewing.approvalStatus] || {}).label} ${formatDateTime(viewing.decidedAt)}${viewing.decidedBy ? ` by ${viewing.decidedBy.fullName}` : ""}`
                  : "Not decided yet"}
              </Detail>
              <Detail label="Registration code">
                {viewing.registrationCode
                  ? <span className="font-bold tracking-widest">{viewing.registrationCode}</span>
                  : "Issued on approval"}
              </Detail>
              <Detail label="Checked in">
                {viewing.attended ? formatDateTime(viewing.checkedInAt) : "Not yet"}
              </Detail>
              {event?.isPremium && (
                <>
                  <Detail label="Plan">{viewing.planName}</Detail>
                  <Detail label="Payment">
                    {PAYMENT_LABEL[viewing.paymentStatus] || viewing.paymentStatus}
                    {viewing.amountDue != null && ` · ${viewing.currency || event.currency || "USD"} ${viewing.amountDue}`}
                  </Detail>
                </>
              )}
            </div>
            {viewing.decisionNote && (
              <div className="mt-4"><Detail label="Note to guest">{viewing.decisionNote}</Detail></div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap justify-end">
            <Button type="button" variant="ghost" onClick={() => setViewing(null)}>Close</Button>
            {!viewing.attended && viewing.approvalStatus !== "approved" && (
              <Button
                type="button"
                onClick={() => { setNote(""); setDeciding({ registration: viewing, status: "approved" }); setViewing(null); }}
              >
                Approve
              </Button>
            )}
            {!viewing.attended && viewing.approvalStatus !== "rejected" && (
              <Button
                type="button" variant="danger"
                onClick={() => { setNote(""); setDeciding({ registration: viewing, status: "rejected" }); setViewing(null); }}
              >
                Reject
              </Button>
            )}
          </div>
        </Modal>
      )}

      {/* ---------- Confirm the decision, with an optional note ---------- */}
      {deciding && (
        <Modal
          title={
            deciding.status === "approved" ? "Approve this registration"
              : deciding.status === "rejected" ? "Reject this registration"
              : "Move back to pending"
          }
          onClose={() => { setDeciding(null); setNote(""); }}
        >
          <p className="text-muted mt-0">
            <strong>{deciding.registration.user?.fullName}</strong> ({deciding.registration.user?.email})
          </p>

          {deciding.status === "approved" && (
            <Alert variant="success" className="mb-4">
              They will be emailed their QR code and registration code, and can sign in to see
              their status. Only now can they be checked in at the door.
            </Alert>
          )}
          {deciding.status === "rejected" && (
            <Alert variant="warn" className="mb-4">
              They will be emailed that their place was not confirmed. This affects
              <strong> this event only</strong> — their account and details stay intact and they can
              register for other events. Any code already issued stops working.
            </Alert>
          )}
          {deciding.status === "pending" && (
            <Alert variant="warn" className="mb-4">
              Their registration code and QR will be revoked, and they will not be able to check in
              until you approve them again. No email is sent.
            </Alert>
          )}

          <Textarea
            label="Note to the guest"
            id="decisionNote"
            name="decisionNote"
            rows={3}
            placeholder={
              deciding.status === "rejected"
                ? "Optional — a short reason, included in the email."
                : "Optional — anything they should know, included in the email."
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={400}
            showCount
          />

          <div className="flex gap-2 justify-end mt-2">
            <Button type="button" variant="ghost" onClick={() => { setDeciding(null); setNote(""); }}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={deciding.status === "rejected" ? "danger" : "primary"}
              onClick={submitDecision}
              loading={busyId === deciding.registration.id}
            >
              {deciding.status === "approved" ? "Approve and send code"
                : deciding.status === "rejected" ? "Reject and notify"
                : "Move to pending"}
            </Button>
          </div>
        </Modal>
      )}
    </AdminConsoleLayout>
  );
}
