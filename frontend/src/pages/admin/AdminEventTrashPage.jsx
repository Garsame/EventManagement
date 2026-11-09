import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { adminClient } from "../../context/AdminAuthContext.jsx";
import AdminConsoleLayout from "../../components/layout/AdminConsoleLayout.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Alert from "../../components/ui/Alert.jsx";
import Input from "../../components/ui/Input.jsx";
import Loading from "../../components/ui/Loading.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";

const formatDate = (v) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));

/**
 * The other half of deleting an event. The Events console only ever moves
 * events here, so this is where an admin goes to undo a deletion or make one
 * final. Events leave on their own once the retention window closes, and this
 * page is the only place that sweep can happen - nothing expires unseen.
 */
export default function AdminEventTrashPage() {
  const [events, setEvents] = useState([]);
  const [retentionDays, setRetentionDays] = useState(30);
  const [purged, setPurged] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [purgeTarget, setPurgeTarget] = useState(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminClient.get("/api/admin/events/trash");
      setEvents(res.data.events);
      setRetentionDays(res.data.retentionDays);
      setPurged(res.data.autoPurged || 0);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not load the trash");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => [e.title, e.location].filter(Boolean).some((s) => s.toLowerCase().includes(q)));
  }, [events, filter]);

  const restore = async (event) => {
    setBusyId(event._id);
    setError("");
    try {
      await adminClient.patch(`/api/admin/events/${event._id}/restore`);
      setMessage(`Restored "${event.title}". It is back on the Events page and can take registrations again.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not restore the event");
    } finally {
      setBusyId(null);
    }
  };

  const confirmPurge = async () => {
    const event = purgeTarget;
    setBusyId(event._id);
    setError("");
    try {
      const res = await adminClient.delete(`/api/admin/events/${event._id}/permanent`);
      setMessage(
        `Deleted "${event.title}" for good, along with ${res.data.deleted.media} photo(s) and ${res.data.deleted.registrations} registration(s).`
      );
      setPurgeTarget(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not delete the event");
      setPurgeTarget(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminConsoleLayout
      title="Trash"
      subtitle={`${events.length} event(s) here can still be brought back`}
      actions={<Link to="/maamul/events" className="btn btn-ghost">Back to events</Link>}
    >
      {message && <Alert variant="success" className="mb-4">{message}</Alert>}
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {purged > 0 && (
        <Alert variant="info" className="mb-4">
          {purged} event(s) passed {retentionDays} days in the trash and were deleted permanently.
        </Alert>
      )}

      <Card className="mb-5">
        <p className="m-0 text-sm">
          Deleting an event hides it from the site, the attendee app and the check-in desk, but keeps its
          photos and registrations so you can put it back. After {retentionDays} days it is removed for good.
        </p>
      </Card>

      <div className="flex gap-3 flex-wrap items-end mb-5">
        <Input className="!mb-0 max-w-xs" placeholder="Search trashed events…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      {loading && <Loading />}
      {!loading && visible.length === 0 && (
        <div className="empty-state">
          <p className="m-0">{events.length ? "Nothing here matches that search." : "Trash is empty."}</p>
        </div>
      )}

      <div className="stack gap-4">
        {!loading &&
          visible.map((event) => (
            <Card key={event._id}>
              <div className="flex flex-wrap gap-4 items-start justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2 items-center">
                    <h3 className="m-0 text-lg font-bold">{event.title}</h3>
                    <Badge variant={event.daysLeft <= 5 ? "danger" : "warn"}>
                      {event.daysLeft} day(s) left
                    </Badge>
                    {event.isPremium && <Badge variant="premium">Premium</Badge>}
                  </div>
                  <p className="m-0 mt-1 text-sm">
                    Deleted {formatDate(event.deletedAt)} · gone for good {formatDate(event.autoDeleteAt)}
                  </p>
                  <p className="m-0 mt-1 text-sm">
                    {event.location || "No location"} · {formatDate(event.startDateTime)}
                  </p>
                  <p className="m-0 mt-2 text-sm">
                    Still attached: {event.mediaCount} media file(s), {event.registrationCount} registration(s)
                  </p>
                </div>

                <div className="flex gap-2 shrink-0">
                  <Button type="button" onClick={() => restore(event)} disabled={busyId === event._id} loading={busyId === event._id}>
                    {busyId === event._id ? "Working…" : "Restore"}
                  </Button>
                  <Button type="button" variant="danger" onClick={() => setPurgeTarget(event)} disabled={busyId === event._id}>
                    Delete permanently
                  </Button>
                </div>
              </div>
            </Card>
          ))}
      </div>

      <ConfirmDialog
        open={!!purgeTarget}
        title={`Delete "${purgeTarget?.title}" for good?`}
        message={
          purgeTarget
            ? `This removes ${purgeTarget.mediaCount} media file(s) and ${purgeTarget.registrationCount} registration(s) along with the event. Nobody can undo this, and the guests who registered will lose their place.`
            : ""
        }
        confirmLabel="Delete permanently"
        loading={busyId === purgeTarget?._id}
        onConfirm={confirmPurge}
        onCancel={() => setPurgeTarget(null)}
      />
    </AdminConsoleLayout>
  );
}
