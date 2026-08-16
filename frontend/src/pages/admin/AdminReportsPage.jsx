import { useCallback, useEffect, useState } from "react";
import { adminClient } from "../../context/AdminAuthContext.jsx";
import AdminConsoleLayout from "../../components/layout/AdminConsoleLayout.jsx";
import Card from "../../components/ui/Card.jsx";
import Input from "../../components/ui/Input.jsx";
import Alert from "../../components/ui/Alert.jsx";
import Loading from "../../components/ui/Loading.jsx";

const ICONS = {
  user: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />,
  event: <path d="M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" strokeLinecap="round" strokeLinejoin="round" />,
  registration: <path d="M4 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />,
  media: <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" strokeLinecap="round" strokeLinejoin="round" />,
  message: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" strokeLinecap="round" strokeLinejoin="round" />,
};

const TONE = {
  user: "text-brand-600 bg-brand-50 dark:text-brand-300 dark:bg-brand-500/15",
  event: "text-accent-600 bg-accent-50 dark:text-accent-400 dark:bg-accent-500/15",
  registration: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/15",
  media: "text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800",
  message: "text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-500/15",
};

const categoryOf = (action) => action.split(".")[0];

const ACTION_LABELS = {
  "user.created": "Account created",
  "user.updated": "Account updated",
  "user.password_reset": "Password reset",
  "user.activated": "Account activated",
  "user.deactivated": "Account deactivated",
  "user.deleted": "Account deleted",
  "event.created": "Event created",
  "event.updated": "Event updated",
  "event.deleted": "Event deleted",
  "event.photographers_assigned": "Photographer assigned",
  "registration.checked_in": "Guest checked in",
  "media.uploaded": "Media uploaded",
  "media.deleted": "Media deleted",
  "message.replied": "Message replied",
};

const formatWhen = (v) => {
  const d = new Date(v);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(d);
};

export default function AdminReportsPage() {
  const [activity, setActivity] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminClient.get("/api/admin/activity", {
        params: {
          q: q || undefined,
          action: actionFilter === "all" ? undefined : actionFilter,
        },
      });
      setActivity(res.data.activity);
      setActions(res.data.actions);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not load activity");
    } finally {
      setLoading(false);
    }
  }, [q, actionFilter]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  return (
    <AdminConsoleLayout title="Reports" subtitle="Everything that has happened across the app, newest first">
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <div className="flex gap-3 flex-wrap items-end mb-5">
        <Input className="!mb-0 max-w-xs" placeholder="Search who, what, or which event…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="input-row !mb-0">
          <label className="input-label" htmlFor="action-filter">Action</label>
          <select
            id="action-filter"
            className="input"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="all">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <Loading />}

      {!loading && activity.length === 0 && (
        <div className="empty-state"><p className="m-0">No activity recorded yet.</p></div>
      )}

      {!loading && activity.length > 0 && (
        <Card className="!p-0 overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {activity.map((entry) => {
              const cat = categoryOf(entry.action);
              return (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-3.5">
                  <div className={`shrink-0 w-9 h-9 rounded-xl inline-flex items-center justify-center ${TONE[cat] || TONE.media}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      {ICONS[cat] || ICONS.media}
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="m-0 text-sm font-semibold truncate">{entry.summary}</p>
                      <span className="text-xs text-muted shrink-0">{formatWhen(entry.createdAt)}</span>
                    </div>
                    <p className="text-muted text-xs m-0 mt-0.5">
                      {ACTION_LABELS[entry.action] || entry.action} · by {entry.actorLabel}
                      {entry.actorRole ? ` (${entry.actorRole})` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </AdminConsoleLayout>
  );
}
