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
import Avatar from "../../components/Avatar.jsx";

const formatDate = (v) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));

const toLocalInput = (v) => {
  if (!v) return "";
  const d = new Date(v);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};

const EMPTY = {
  title: "", description: "", location: "",
  startDateTime: "", endDateTime: "", visibility: "public", status: "draft",
};

const STATUS_BADGE = { draft: "neutral", "registration-open": "success", completed: "info" };
const STATUS_LABEL = { draft: "Draft", "registration-open": "Registration open", completed: "Completed" };

export default function AdminEventsConsolePage() {
  const [events, setEvents] = useState([]);
  const [photographers, setPhotographers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [changingEventId, setChangingEventId] = useState(null);

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
    let list = events;
    if (statusFilter !== "all") list = list.filter((e) => e.status === statusFilter);
    const q = filter.trim().toLowerCase();
    if (q) list = list.filter((e) => [e.title, e.location].filter(Boolean).some((s) => s.toLowerCase().includes(q)));
    return list;
  }, [events, filter, statusFilter]);

  const resetCover = () => {
    setCoverFile(null);
    setCoverPreview("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
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
    });
    resetCover();
    setCoverPreview(event.coverImageUrl || "");
    setError("");
    setModalOpen(true);
  };

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

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

  const remove = async (event) => {
    const warning = `Delete "${event.title}"?\n\nThis also deletes ${event.mediaCount} media file(s) and ${event.registrationCount} registration(s). This cannot be undone.`;
    if (!window.confirm(warning)) return;
    setBusyId(event._id);
    setError("");
    try {
      const res = await adminClient.delete(`/api/admin/events/${event._id}`);
      setMessage(`Deleted "${event.title}" (${res.data.deleted.media} media, ${res.data.deleted.registrations} registrations).`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not delete the event");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminConsoleLayout
      title="Events"
      subtitle={`${events.length} event(s)`}
      actions={<Button type="button" onClick={openCreate}>+ Create a new event</Button>}
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
            <Card key={event._id}>
              <div className="flex gap-4 flex-col sm:flex-row">
                <div className="cover-thumb">
                  {event.coverImageUrl
                    ? <img src={event.coverImageUrl} alt="" />
                    : <span className="text-3xl" aria-hidden="true">🖼️</span>}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <h4 className="m-0 text-base font-bold truncate">{event.title}</h4>
                      <p className="text-muted m-0 mt-1 text-sm">{formatDate(event.startDateTime)} · {event.location || "Location TBA"}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap items-center">
                      <Badge variant={STATUS_BADGE[event.status]}>{STATUS_LABEL[event.status]}</Badge>
                      <Badge variant={event.visibility === "public" ? "info" : "neutral"}>{event.visibility}</Badge>
                    </div>
                  </div>

                  <div className="grid grid-4 mt-4">
                    <div className="card-muted"><div className="text-xs uppercase">Registered</div><strong>{event.registrationCount}</strong></div>
                    <div className="card-muted"><div className="text-xs uppercase">Attended</div><strong>{event.attendedCount}</strong></div>
                    <div className="card-muted"><div className="text-xs uppercase">Media</div><strong>{event.mediaCount}</strong></div>
                    <div className="card-muted"><div className="text-xs uppercase">Photographers</div><strong>{event.photographers.length}</strong></div>
                  </div>

                  <div className="mt-4">
                    <div className="input-label mb-2">Photographer</div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {assignedPhotographer ? (
                        <span className="card-muted !inline-flex items-center gap-2 !py-2 !px-3">
                          <Avatar user={{ ...assignedPhotographer, initials: assignedPhotographer.fullName?.[0] || "?" }} size="sm" />
                          <span className="font-semibold">{assignedPhotographer.fullName}</span>
                        </span>
                      ) : (
                        <span className="text-muted text-sm">No photographer assigned.</span>
                      )}

                      {isChanging ? (
                        <>
                          <select
                            className="input !w-56"
                            defaultValue=""
                            disabled={busyId === event._id}
                            onChange={(e) => {
                              if (e.target.value) setPrimaryPhotographer(event, e.target.value);
                            }}
                          >
                            <option value="" disabled>Choose a photographer…</option>
                            {pickable.map((p) => (
                              <option key={p.id} value={p.id}>{p.fullName}</option>
                            ))}
                          </select>
                          <Button type="button" variant="ghost" onClick={() => setChangingEventId(null)} disabled={busyId === event._id}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setChangingEventId(event._id)}
                          disabled={busyId === event._id || pickable.length === 0}
                          title={pickable.length === 0 ? "No other active photographers available" : undefined}
                        >
                          {assignedPhotographer ? "Change photographer" : "Assign a photographer"}
                        </Button>
                      )}
                    </div>
                    {photographers.length === 0 && (
                      <p className="helper-text mt-2 mb-0">No active photographer accounts available.</p>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap mt-4">
                    <Link to={`/maamul/events/${event._id}/media`} className="btn btn-ghost">Manage media</Link>
                    <Link to={`/events/${event._id}`} className="btn btn-ghost">View public page</Link>
                    <Button type="button" variant="ghost" onClick={() => openEdit(event)} disabled={busyId === event._id}>Edit</Button>
                    <Button type="button" variant="danger" onClick={() => remove(event)} disabled={busyId === event._id}>
                      {busyId === event._id ? "Working…" : "Delete"}
                    </Button>
                  </div>
                </div>
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
            {error && <Alert variant="error">{error}</Alert>}
            <div className="flex gap-2 mt-2">
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Create event"}</Button>
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}
    </AdminConsoleLayout>
  );
}
