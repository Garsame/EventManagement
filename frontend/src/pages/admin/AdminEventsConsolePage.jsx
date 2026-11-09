import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { adminClient } from "../../context/AdminAuthContext.jsx";
import AdminConsoleLayout from "../../components/layout/AdminConsoleLayout.jsx";
import Card from "../../components/ui/Card.jsx";
import Input from "../../components/ui/Input.jsx";
import Button from "../../components/ui/Button.jsx";
import Alert from "../../components/ui/Alert.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Loading from "../../components/ui/Loading.jsx";
import Modal from "../../components/ui/Modal.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import Avatar from "../../components/Avatar.jsx";

const formatDate = (v) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));

const toLocalInput = (v) => {
  if (!v) return "";
  const d = new Date(v);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};

const BASE_EMPTY = {
  title: "", description: "", location: "",
  startDateTime: "", endDateTime: "", visibility: "public", status: "draft",
};
// Non-premium form state never carries currency/plans keys at all, so the
// standard console never sends them - only the premium page seeds these.
const emptyForm = (premium) =>
  premium ? { ...BASE_EMPTY, currency: "USD", plans: [{ name: "", price: "", description: "" }] } : { ...BASE_EMPTY };

const STATUS_BADGE = { draft: "neutral", "registration-open": "success", completed: "info" };
const STATUS_LABEL = { draft: "Draft", "registration-open": "Registration open", completed: "Completed" };

export default function AdminEventsConsolePage({ premium = false }) {
  const [events, setEvents] = useState([]);
  const [photographers, setPhotographers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(() => emptyForm(premium));
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [changingEventId, setChangingEventId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Only active photographers can sign in and work an event, so the
      // assignment picker only ever offers accounts that can actually pick
      // up the job.
      const [ev, ph] = await Promise.all([
        adminClient.get("/api/admin/events"),
        adminClient.get("/api/admin/users", { params: { role: "photographer", status: "active" } }),
      ]);
      setEvents(ev.data.events);
      setPhotographers(ph.data.users);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not load events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    let list = events.filter((e) => !!e.isPremium === premium);
    if (statusFilter !== "all") list = list.filter((e) => e.status === statusFilter);
    const q = filter.trim().toLowerCase();
    if (q) list = list.filter((e) => [e.title, e.location].filter(Boolean).some((s) => s.toLowerCase().includes(q)));
    return list;
  }, [events, filter, statusFilter, premium]);

  const resetCover = () => {
    setCoverFile(null);
    setCoverPreview("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(premium));
    resetCover();
    setError("");
    setModalOpen(true);
  };

  const openEdit = (event) => {
    setEditingId(event._id);
    setForm({
      title: event.title || "",
      description: event.description || "",
      location: event.location || "",
      startDateTime: toLocalInput(event.startDateTime),
      endDateTime: toLocalInput(event.endDateTime),
      visibility: event.visibility || "public",
      status: event.status || "draft",
      ...(premium
        ? {
            currency: event.currency || "USD",
            plans: (event.plans || []).length
              ? event.plans.map((p) => ({ name: p.name, price: String(p.price), description: p.description || "" }))
              : [{ name: "", price: "", description: "" }],
          }
        : {}),
    });
    resetCover();
    setCoverPreview(event.coverImageUrl || "");
    setError("");
    setModalOpen(true);
  };

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const updatePlan = (index, field, value) =>
    setForm((p) => ({ ...p, plans: p.plans.map((plan, i) => (i === index ? { ...plan, [field]: value } : plan)) }));
  const addPlan = () => setForm((p) => ({ ...p, plans: [...p.plans, { name: "", price: "", description: "" }] }));
  const removePlan = (index) => setForm((p) => ({ ...p, plans: p.plans.filter((_, i) => i !== index) }));

  const handleCoverPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        startDateTime: new Date(form.startDateTime).toISOString(),
        endDateTime: new Date(form.endDateTime).toISOString(),
      };
      if (premium) {
        payload.isPremium = true;
        payload.currency = form.currency || "USD";
        payload.plans = form.plans.map((p) => ({
          name: p.name.trim(),
          price: Number(p.price),
          description: p.description.trim(),
        }));
      }

      let eventId = editingId;
      if (editingId) {
        await adminClient.patch(`/api/admin/events/${editingId}`, payload);
        setMessage("Event updated.");
      } else {
        const res = await adminClient.post("/api/admin/events", payload);
        eventId = res.data._id;
        setMessage("Event created.");
      }

      if (coverFile && eventId) {
        const fd = new FormData();
        fd.append("file", coverFile);
        await adminClient.post(`/api/admin/events/${eventId}/cover`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not save the event");
    } finally {
      setSaving(false);
    }
  };

  // Replaces whichever photographer is on the event with a single new one -
  // "change" means swap, not add, so the event always has at most one
  // assigned photographer at a time.
  const setPrimaryPhotographer = async (event, photographerId) => {
    setBusyId(event._id);
    setError("");
    try {
      const res = await adminClient.put(`/api/admin/events/${event._id}/photographers`, {
        photographerIds: [photographerId],
      });
      setEvents((prev) => prev.map((e) => (e._id === event._id ? { ...e, photographers: res.data.photographers } : e)));
      setChangingEventId(null);
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not update the assignment");
    } finally {
      setBusyId(null);
    }
  };

  // Opens or closes the check-in door for this event. The API itself refuses
  // to open it with zero registrations, so the error message shown here is
  // always the server's, not a guess made client-side.
  const toggleCheckIn = async (event) => {
    setBusyId(event._id);
    setError("");
    try {
      const res = await adminClient.patch(`/api/admin/events/${event._id}/checkin-open`, {
        checkInOpen: !event.checkInOpen,
      });
      setEvents((prev) => prev.map((e) => (e._id === event._id ? { ...e, checkInOpen: res.data.checkInOpen } : e)));
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not update check-in");
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    const event = deleteTarget;
    setBusyId(event._id);
    setError("");
    try {
      const res = await adminClient.delete(`/api/admin/events/${event._id}`);
      setMessage(
        `Moved "${event.title}" to the trash. Its ${res.data.retained.media} media file(s) and ${res.data.retained.registrations} registration(s) are kept, so you can restore it from Trash.`
      );
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not delete the event");
      setDeleteTarget(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminConsoleLayout
      title={premium ? "Premium Events" : "Events"}
      subtitle={`${events.filter((e) => !!e.isPremium === premium).length} event(s)`}
      actions={
        <div className="flex gap-2 items-center">
          <Link to="/maamul/events/trash" className="btn btn-ghost">Trash</Link>
          <Button type="button" onClick={openCreate}>{premium ? "+ Create a premium event" : "+ Create a new event"}</Button>
        </div>
      }
    >
      {message && <Alert variant="success" className="mb-4">{message}</Alert>}
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <div className="flex gap-3 flex-wrap items-end mb-5">
        <Input className="!mb-0 max-w-xs" placeholder="Search events…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="flex gap-2 flex-wrap">
          {["all", "draft", "registration-open", "completed"].map((s) => (
            <button key={s} type="button" onClick={() => setStatusFilter(s)}
              className={`btn ${statusFilter === s ? "btn-primary" : "btn-ghost"} !px-3 !py-2 text-xs`}>
              {s === "all" ? "All" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {loading && <Loading />}
      {!loading && visible.length === 0 && <div className="empty-state"><p className="m-0">No events match.</p></div>}

      <div className="stack gap-4">
        {visible.map((event) => {
          // The assigned photographer, if any - shown first and prominently
          // rather than as one checked chip among many.
          const assignedPhotographer = event.photographers[0] || null;
          const isChanging = changingEventId === event._id;
          const pickable = photographers.filter((p) => p.id !== assignedPhotographer?.id);
          return (
            <Card key={event._id} className="event-admin-card">
              {/* --- Header: identity and state, nothing else --- */}
              <div className="event-admin-head">
                <div className="cover-thumb shrink-0">
                  {event.coverImageUrl
                    ? <img src={event.coverImageUrl} alt="" />
                    : <span className="text-3xl" aria-hidden="true">🖼️</span>}
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="m-0 text-base font-bold truncate">{event.title}</h4>
                  <p className="text-muted m-0 mt-1 text-sm truncate">
                    {formatDate(event.startDateTime)} · {event.location || "Location TBA"}
                  </p>
                  <div className="flex gap-1.5 flex-wrap items-center mt-2">
                    <Badge variant={STATUS_BADGE[event.status]}>{STATUS_LABEL[event.status]}</Badge>
                    <Badge variant={event.visibility === "public" ? "info" : "neutral"}>{event.visibility}</Badge>
                    <Badge variant={event.checkInOpen ? "success" : "neutral"}>
                      {event.checkInOpen ? "Check-in open" : "Check-in closed"}
                    </Badge>
                    {premium && (event.plans || []).length > 0 && (
                      <Badge variant="premium">
                        {event.plans.length} plan{event.plans.length === 1 ? "" : "s"} · {event.currency || "USD"}{" "}
                        {Math.min(...event.plans.map((p) => p.price))}
                        {event.plans.length > 1 && `–${Math.max(...event.plans.map((p) => p.price))}`}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Needs-attention count is the one number worth interrupting for. */}
                {event.pendingApprovalCount > 0 && (
                  <Link
                    to={`/maamul/events/${event._id}/registrations`}
                    className="attention-pill shrink-0"
                    title="Registrations waiting for your decision"
                  >
                    <strong>{event.pendingApprovalCount}</strong>
                    <span>awaiting approval</span>
                  </Link>
                )}
              </div>

              {/* --- Metrics: one row, reading left to right through the funnel --- */}
              <div className="event-metrics">
                <Link to={`/maamul/events/${event._id}/registrations`} className="event-metric">
                  <span className="event-metric-value">{event.registrationCount}</span>
                  <span className="event-metric-label">Requested</span>
                </Link>
                <Link to={`/maamul/events/${event._id}/registrations`} className="event-metric">
                  <span className="event-metric-value text-emerald-600 dark:text-emerald-400">
                    {event.approvedCount ?? 0}
                  </span>
                  <span className="event-metric-label">Approved</span>
                </Link>
                <Link to={`/maamul/events/${event._id}/registrations`} className="event-metric">
                  <span className="event-metric-value">{event.attendedCount}</span>
                  <span className="event-metric-label">Checked in</span>
                </Link>
                <Link to={`/maamul/events/${event._id}/media`} className="event-metric">
                  <span className="event-metric-value">{event.mediaCount}</span>
                  <span className="event-metric-label">Media</span>
                </Link>
                {premium && (
                  <div className="event-metric">
                    <span className="event-metric-value">{event.currency || "USD"} {event.revenue || 0}</span>
                    <span className="event-metric-label">
                      Revenue · {event.paidCount || 0} paid
                    </span>
                  </div>
                )}
              </div>

              {/* --- Crew: the one assignment this event needs --- */}
              <div className="event-admin-row">
                <span className="event-row-label">Photographer</span>
                {isChanging ? (
                  <div className="flex items-center gap-2 flex-wrap flex-1">
                    <select
                      className="select !w-56 !py-2"
                      defaultValue=""
                      disabled={busyId === event._id}
                      onChange={(e) => { if (e.target.value) setPrimaryPhotographer(event, e.target.value); }}
                    >
                      <option value="" disabled>Choose a photographer…</option>
                      {pickable.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                    </select>
                    <Button type="button" variant="ghost" onClick={() => setChangingEventId(null)} disabled={busyId === event._id}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    {assignedPhotographer ? (
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <Avatar user={{ ...assignedPhotographer, initials: assignedPhotographer.fullName?.[0] || "?" }} size="sm" />
                        <span className="font-semibold truncate">{assignedPhotographer.fullName}</span>
                      </span>
                    ) : (
                      <span className="text-muted text-sm">Nobody assigned</span>
                    )}
                    <button
                      type="button"
                      className="link-button ml-auto"
                      onClick={() => setChangingEventId(event._id)}
                      disabled={busyId === event._id || pickable.length === 0}
                      title={pickable.length === 0 ? "No other active photographers available" : undefined}
                    >
                      {assignedPhotographer ? "Change" : "Assign"}
                    </button>
                  </>
                )}
              </div>

              {/* --- Actions: the primary one first, destructive one last --- */}
              <div className="event-admin-actions">
                <Button
                  type="button"
                  variant={event.checkInOpen ? "secondary" : "primary"}
                  onClick={() => toggleCheckIn(event)}
                  disabled={busyId === event._id || (!event.checkInOpen && (event.approvedCount ?? 0) === 0)}
                  title={
                    !event.checkInOpen && (event.approvedCount ?? 0) === 0
                      ? "Approve at least one registration before opening check-in"
                      : undefined
                  }
                >
                  {event.checkInOpen ? "Close check-in" : "Open check-in"}
                </Button>
                <Link to={`/maamul/events/${event._id}/registrations`} className="btn btn-ghost">
                  Registrations
                </Link>
                <Link to={`/maamul/events/${event._id}/media`} className="btn btn-ghost">Media</Link>
                <Button type="button" variant="ghost" onClick={() => openEdit(event)} disabled={busyId === event._id}>
                  Edit
                </Button>
                <Button
                  type="button" variant="danger" className="ml-auto"
                  onClick={() => setDeleteTarget(event)} disabled={busyId === event._id}
                >
                  {busyId === event._id ? "Working…" : "Delete"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {modalOpen && (
        <Modal title={editingId ? "Edit event" : "Create a new event"} onClose={() => setModalOpen(false)} wide>
          <form onSubmit={submit}>
            <div className="flex gap-4 flex-col sm:flex-row mb-1">
              <div className="cover-thumb">
                {coverPreview ? <img src={coverPreview} alt="Cover preview" /> : <span className="text-3xl" aria-hidden="true">🖼️</span>}
              </div>
              <div className="flex-1">
                <label className="input-label">Cover image</label>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleCoverPick} className="input mt-1.5" />
                <p className="helper-text mt-1">Shown on the public event card. Optional.</p>
              </div>
            </div>

            <Input label="Title" id="title" name="title" value={form.title} onChange={handleChange} required />
            <Input label="Description" id="description" name="description" value={form.description} onChange={handleChange} />
            <Input label="Location" id="location" name="location" value={form.location} onChange={handleChange} />
            <div className="two-col">
              <Input label="Start" id="startDateTime" type="datetime-local" name="startDateTime" value={form.startDateTime} onChange={handleChange} required />
              <Input label="End" id="endDateTime" type="datetime-local" name="endDateTime" value={form.endDateTime} onChange={handleChange} required />
            </div>
            <div className="two-col">
              <div className="input-row">
                <label className="input-label" htmlFor="visibility">Visibility</label>
                <select id="visibility" name="visibility" value={form.visibility} onChange={handleChange} className="input">
                  <option value="public">Public — guests can find and view it</option>
                  <option value="private">Private — hidden from public listings</option>
                </select>
              </div>
              <div className="input-row">
                <label className="input-label" htmlFor="status">Status</label>
                <select id="status" name="status" value={form.status} onChange={handleChange} className="input">
                  <option value="draft">Draft — not visible, no registration</option>
                  <option value="registration-open">Registration open</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            {premium && (
              <div className="mt-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <label className="input-label">Participation plans</label>
                  <Button type="button" variant="ghost" onClick={addPlan}>+ Add plan</Button>
                </div>
                <Input
                  label="Currency"
                  id="currency"
                  name="currency"
                  className="!max-w-[10rem]"
                  value={form.currency}
                  onChange={handleChange}
                  required
                />
                {form.plans.map((p, i) => (
                  <div key={i} className="card-muted mt-2">
                    <div className="two-col">
                      <Input
                        label="Plan name"
                        value={p.name}
                        onChange={(e) => updatePlan(i, "name", e.target.value)}
                        required
                      />
                      <Input
                        label={`Price (${form.currency || "USD"})`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={p.price}
                        onChange={(e) => updatePlan(i, "price", e.target.value)}
                        required
                      />
                    </div>
                    <Input
                      label="Description (optional)"
                      value={p.description}
                      onChange={(e) => updatePlan(i, "description", e.target.value)}
                    />
                    {form.plans.length > 1 && (
                      <Button type="button" variant="ghost" onClick={() => removePlan(i)}>Remove plan</Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {error && <Alert variant="error">{error}</Alert>}
            <div className="flex gap-2 mt-2">
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Create event"}</Button>
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.title}"?`}
        message={
          deleteTarget
            ? `It leaves the site, the Events page and the check-in desk straight away. Its ${deleteTarget.mediaCount} media file(s) and ${deleteTarget.registrationCount} registration(s) stay attached, so you can restore it from Trash at any time in the next 30 days.`
            : ""
        }
        confirmLabel="Delete"
        loading={busyId === deleteTarget?._id}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminConsoleLayout>
  );
}
