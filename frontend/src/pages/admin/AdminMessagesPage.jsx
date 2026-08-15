import { useCallback, useEffect, useMemo, useState } from "react";
import { adminClient } from "../../context/AdminAuthContext.jsx";
import AdminConsoleLayout from "../../components/layout/AdminConsoleLayout.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Alert from "../../components/ui/Alert.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Loading from "../../components/ui/Loading.jsx";

const formatDate = (v) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));

function MessageCard({ message, onReplied }) {
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const submitReply = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    setError("");
    try {
      const res = await adminClient.post(`/api/admin/messages/${message.id}/reply`, { reply });
      setResult({ delivered: res.data.delivered });
      onReplied(res.data.message);
      setReplying(false);
      setReply("");
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not send the reply");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="m-0 text-base font-bold">{message.subject || "(no subject)"}</h4>
            <Badge variant={message.status === "replied" ? "success" : "warn"}>
              {message.status === "replied" ? "Replied" : "Open"}
            </Badge>
          </div>
          <p className="text-muted m-0 mt-1 text-sm">
            {message.name} · <a href={`mailto:${message.email}`} className="text-brand-600 dark:text-brand-300">{message.email}</a>
          </p>
          <p className="text-muted m-0 mt-0.5 text-xs">{formatDate(message.createdAt)}</p>
        </div>
      </div>

      <div className="card-muted mt-3 whitespace-pre-wrap">{message.body}</div>

      {message.reply && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/30 p-4">
          <div className="text-xs uppercase text-emerald-700 dark:text-emerald-300 font-bold mb-1.5">
            Your reply · {formatDate(message.reply.repliedAt)}
          </div>
          <div className="whitespace-pre-wrap text-sm">{message.reply.body}</div>
        </div>
      )}

      {result && (
        <Alert variant={result.delivered ? "success" : "warn"} className="mt-3">
          {result.delivered ? "Reply emailed to the sender." : "Email delivery is not configured; the reply was saved but not sent."}
        </Alert>
      )}
      {error && <Alert variant="error" className="mt-3">{error}</Alert>}

      <div className="mt-4">
        {!replying && (
          <Button type="button" variant={message.status === "replied" ? "ghost" : "primary"} onClick={() => setReplying(true)}>
            {message.status === "replied" ? "Send another reply" : "Reply"}
          </Button>
        )}
        {replying && (
          <form onSubmit={submitReply} className="grid gap-3">
            <textarea
              className="input"
              rows={4}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={`Reply to ${message.name}…`}
              autoFocus
              required
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={sending || !reply.trim()}>{sending ? "Sending…" : "Send reply"}</Button>
              <Button type="button" variant="ghost" onClick={() => { setReplying(false); setReply(""); }} disabled={sending}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState([]);
  const [counts, setCounts] = useState({ total: 0, open: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("open");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminClient.get("/api/admin/messages");
      setMessages(res.data.messages);
      setCounts(res.data.counts);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not load messages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    if (filter === "all") return messages;
    return messages.filter((m) => m.status === filter);
  }, [messages, filter]);

  const handleReplied = (updated) => {
    setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    setCounts((c) => ({ ...c, open: Math.max(0, c.open - 1) }));
  };

  return (
    <AdminConsoleLayout title="Messages" subtitle={`${counts.open} open of ${counts.total} total`}>
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <div className="flex gap-2 mb-5">
        {[
          { key: "open", label: `Open (${counts.open})` },
          { key: "replied", label: "Replied" },
          { key: "all", label: "All" },
        ].map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)}
            className={`btn ${filter === f.key ? "btn-primary" : "btn-ghost"} !px-3 !py-2 text-xs`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading && <Loading />}
      {!loading && visible.length === 0 && (
        <div className="empty-state"><p className="m-0">No messages here.</p></div>
      )}

      <div className="stack gap-4">
        {visible.map((m) => (
          <MessageCard key={m.id} message={m} onReplied={handleReplied} />
        ))}
      </div>
    </AdminConsoleLayout>
  );
}
