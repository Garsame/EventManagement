import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client.js";
import AdminLayout from "../components/layout/AdminLayout.jsx";
import AdminSidebar from "../components/layout/AdminSidebar.jsx";
import Card from "../components/ui/Card.jsx";
import Input from "../components/ui/Input.jsx";
import Button from "../components/ui/Button.jsx";
import Alert from "../components/ui/Alert.jsx";
import Badge from "../components/ui/Badge.jsx";
import Loading from "../components/ui/Loading.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import Avatar from "../components/Avatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const formatDate = (v) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));

const toLocalInput = (v) => {
  if (!v) return "";
  const d = new Date(v);
  // datetime-local needs local time, not the UTC string.
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};

const EMPTY = {
  title: "", description: "", location: "",
  startDateTime: "", endDateTime: "", visibility: "public", published: true,
};

export default function AdminEventsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [events, setEvents] = useState([]);
  const [photographers, setPhotographers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ev, ph] = await Promise.all([
        client.get("/api/admin/events"),
        isAdmin ? client.get("/api/admin/events/photographers") : Promise.resolve({ data: { photographers: [] } }),
      ]);
      setEvents(ev.data.events);
      setPhotographers(ph.data.photographers);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not load events");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) =>
      [e.title, e.location, e.description].filter(Boolean).some((s) => s.toLowerCase().includes(q))
    );
  }, [events, filter]);

  const startEdit = (event) => {
    setEditingId(event._id);
    setForm({
      title: event.title || "",
      description: event.description || "",
      location: event.location || "",
      startDateTime: toLocalInput(event.startDateTime),
      endDateTime: toLocalInput(event.endDateTime),
      visibility: event.visibility || "public",
      published: !!event.published,
    });
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => { setEditingId(null); setForm(EMPTY); };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        ...form,
        startDateTime: new Date(form.startDateTime).toISOString(),
        endDateTime: new Date(form.endDateTime).toISOString(),
      };
      if (editingId) {
        await client.patch(`/api/admin/events/${editingId}`, payload);
        setMessage("Event updated.");
      } else {
        await client.post("/api/admin/events", payload);
        setMessage("Event created.");
      }
      cancelEdit();
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not save the event");
    } finally {
      setSaving(false);
    }
  };

  const togglePhotographer = async (event, photographerId) => {
    const current = event.photographers.map((p) => p.id);
    const next = current.includes(photographerId)
      ? current.filter((id) => id !== photographerId)
      : [...current, photographerId];

    setBusyId(event._id);
    setError("");
    try {
      const res = await client.put(`/api/admin/events/${event._id}/photographers`, { photographerIds: next });
      setEvents((prev) => prev.map((e) => (e._id === event._id ? { ...e, photographers: res.data.photographers } : e)));
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not update assignments");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (event) => {
    const warning =
      `Delete "${event.title}"?\n\n` +
      `This also deletes ${event.mediaCount} media file(s) and ${event.registrationCount} registration(s). ` +
      `This cannot be undone.`;
    if (!window.confirm(warning)) return;

    setBusyId(event._id);
    setError("");
    try {
      const res = await client.delete(`/api/admin/events/${event._id}`);
      setMessage(`Deleted "${event.title}" (${res.data.deleted.media} media, ${res.data.deleted.registrations} registrations).`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not delete the event");
    } finally {
      setBusyId(null);
    }
  };

  const topbar = (
    <PageHeader
      title="Events"
      subtitle={isAdmin ? "Create, edit, assign photographers, and delete" : "Events you can work on"}
    />
  );

  return (
    <AdminLayout sidebar={<AdminSidebar />} topbar={topbar}>
      {message && <Alert variant="success" className="mb-4">{message}</Alert>}
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {isAdmin && (
        <Card className="mb-5">
          <h3 className="mt-0 mb-4 text-lg font-bold">{editingId ? "Edit event" : "Create event"}</h3>
          <form onSubmit={submit} className="grid gap-4">
            <Input label="Title" id="title" name="title" value={form.title} onChange={handleChange} required />
            <Input label="Description" id="description" name="description" value={form.description} onChange={handleChange} />
            <Input label="Location" id="location" name="location" value={form.location} onChange={handleChange} />
            <div className="two-col">
              <Input label="Start" id="startDateTime" type="datetime-local" name="startDateTime"
                value={form.startDateTime} onChange={handleChange} required />
              <Input label="End" id="endDateTime" type="datetime-local" name="endDateTime"
                value={form.endDateTime} onChange={handleChange} required />
            </div>
            <div className="two-col">
              <div className="input-row">
                <label className="input-label" htmlFor="visibility">Visibility</label>
                <select id="visibility" name="visibility" value={form.visibility} onChange={handleChange} className="input">
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>
              <div className="input-row justify-end">
                <label className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                  <input type="checkbox" name="published" checked={form.published} onChange={handleChange}
                    className="w-4 h-4 accent-brand-600" />
                  Published
                </label>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save changes" : "Create event"}
              </Button>
              {editingId && (
                <Button type="button" variant="ghost" onClick={cancelEdit} disabled={saving}>Cancel</Button>
              )}
            </div>
          </form>
        </Card>
      )}

      <div className="page-header mb-4">
        <h3 className="text-lg font-bold m-0">All events ({events.length})</h3>
        <Input className="!mb-0" id="filter" placeholder="Search events…" value={filter}
          onChange={(e) => setFilter(e.target.value)} />
      </div>

      {loading && <Loading />}

      {!loading && visible.length === 0 && (
        <div className="empty-state"><p className="m-0">No events match.</p></div>
      )}

      <div className="stack gap-4">
        {visible.map((event) => {
          const assigned = event.photographers.map((p) => p.id);
          return (
            <Card key={event._id}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <h4 className="m-0 text-base font-bold">{event.title}</h4>
                  <p className="text-muted m-0 mt-1 text-sm">
                    {formatDate(event.startDateTime)} · {event.location || "Location TBA"}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  <Badge variant={event.published ? "success" : "warn"}>
                    {event.published ? "Published" : "Draft"}
                  </Badge>
                  <Badge variant={event.visibility === "public" ? "info" : "neutral"}>
                    {event.visibility}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-4 mt-4">
                <div className="card-muted"><div className="text-xs uppercase">Registered</div><strong>{event.registrationCount}</strong></div>
                <div className="card-muted"><div className="text-xs uppercase">Attended</div><strong>{event.attendedCount}</strong></div>
                <div className="card-muted"><div className="text-xs uppercase">Media</div><strong>{event.mediaCount}</strong></div>
                <div className="card-muted"><div className="text-xs uppercase">Photographers</div><strong>{event.photographers.length}</strong></div>
              </div>

              {isAdmin && (
                <div className="mt-4">
                  <div className="input-label mb-2">Assigned photographers</div>
                  {photographers.length === 0 && (
                    <p className="helper-text m-0">No photographer accounts exist yet.</p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {photographers.map((p) => {
                      const on = assigned.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePhotographer(event, p.id)}
                          disabled={busyId === event._id}
                          className={`btn ${on ? "btn-primary" : "btn-ghost"} !px-3 !py-2`}
                          title={on ? "Click to unassign" : "Click to assign"}
                        >
                          <Avatar user={{ ...p, initials: p.fullName?.[0] || "?" }} size="sm" />
                          <span className="truncate max-w-[10rem]">{p.fullName}</span>
                          <span aria-hidden="true">{on ? "✓" : "+"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!isAdmin && event.photographers.length > 0 && (
                <p className="text-muted text-sm mt-3 mb-0">
                  Assigned: {event.photographers.map((p) => p.fullName).join(", ")}
                </p>
              )}

              <div className="flex gap-2 flex-wrap mt-4">
                <Link to={`/events/${event._id}/media/manage`} className="btn btn-ghost">Manage media</Link>
                <Link to={`/events/${event._id}`} className="btn btn-ghost">View public page</Link>
                {isAdmin && (
                  <>
                    <Button type="button" variant="ghost" onClick={() => startEdit(event)} disabled={busyId === event._id}>
                      Edit
                    </Button>
                    <Button type="button" variant="danger" onClick={() => remove(event)} disabled={busyId === event._id}>
                      {busyId === event._id ? "Working…" : "Delete"}
                    </Button>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </AdminLayout>
  );
}
