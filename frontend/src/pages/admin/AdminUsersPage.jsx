import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { adminClient, useAdminAuth } from "../../context/AdminAuthContext.jsx";
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

const GROUPS = {
  attendees: { role: "attendee", label: "Attendees", singular: "attendee", verifiedNote: "" },
  photographers: {
    role: "photographer",
    label: "Photographers",
    singular: "photographer",
    verifiedNote: "Sign-in details are emailed to them; there is no self sign-up.",
  },
  admins: { role: "admin", label: "Admins", singular: "admin", verifiedNote: "" },
};

const EMPTY_FORM = { fullName: "", email: "", phone: "", password: "", sendEmail: true };

export default function AdminUsersPage() {
  const { group } = useParams();
  const { user: me } = useAdminAuth();
  const config = GROUPS[group];

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [q, setQ] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState(null);

  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const [passwordTarget, setPasswordTarget] = useState(null);
  const [passwordResult, setPasswordResult] = useState(null);
  const [passwordSending, setPasswordSending] = useState(false);

  const [busyId, setBusyId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    if (!config) return;
    setLoading(true);
    try {
      const res = await adminClient.get("/api/admin/users", { params: { role: config.role } });
      setUsers(res.data.users);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not load users");
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setQ(""); setMessage(""); setError(""); }, [group]);

  if (!config) return <Navigate to="/maamul/users/attendees" replace />;

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return users;
    return users.filter((u) =>
      [u.fullName, u.email, u.phone, u.institution].filter(Boolean).some((s) => s.toLowerCase().includes(query))
    );
  }, [users, q]);

  const openCreate = () => {
    setCreateForm(EMPTY_FORM);
    setCreateResult(null);
    setCreateOpen(true);
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const res = await adminClient.post("/api/admin/users", {
        fullName: createForm.fullName,
        email: createForm.email,
        phone: createForm.phone || undefined,
        role: config.role,
        password: createForm.password || undefined,
        sendEmail: createForm.sendEmail,
      });
      setCreateResult(res.data);
      setMessage(`${config.label.slice(0, -1)} account created.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not create the account");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (u) => {
    setEditing(u);
    setEditForm({ fullName: u.fullName, email: u.email, phone: u.phone || "" });
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await adminClient.patch(`/api/admin/users/${editing.id}`, editForm);
      setMessage("Details updated.");
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not save changes");
    } finally {
      setSaving(false);
    }
  };

  const openPassword = (u) => {
    setPasswordTarget(u);
    setPasswordResult(null);
  };

  const submitPassword = async (customPassword, sendEmail) => {
    setPasswordSending(true);
    setError("");
    try {
      const res = await adminClient.patch(`/api/admin/users/${passwordTarget.id}/password`, {
        password: customPassword || undefined,
        sendEmail,
      });
      setPasswordResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not set a new password");
    } finally {
      setPasswordSending(false);
    }
  };

  const toggleStatus = async (u) => {
    setBusyId(u.id);
    setError("");
    try {
      await adminClient.patch(`/api/admin/users/${u.id}/status`, { isActive: !u.isActive });
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not change status");
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    const u = deleteTarget;
    setBusyId(u.id);
    setError("");
    try {
      await adminClient.delete(`/api/admin/users/${u.id}`);
      setMessage(`Deleted ${u.fullName}.`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not delete this account");
      setDeleteTarget(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminConsoleLayout
      title={config.label}
      subtitle={`${users.length} account(s)`}
      actions={<Button type="button" onClick={openCreate}>+ Create {config.singular}</Button>}
    >
      {message && <Alert variant="success" className="mb-4">{message}</Alert>}
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {config.verifiedNote && <Alert variant="info" className="mb-4">{config.verifiedNote}</Alert>}

      <Input className="!mb-4 max-w-sm" placeholder={`Search ${config.label.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} />

      {loading && <Loading />}

      {!loading && visible.length === 0 && (
        <div className="empty-state"><p className="m-0">No {config.label.toLowerCase()} yet.</p></div>
      )}

      <div className="stack gap-3">
        {visible.map((u) => (
          <Card key={u.id}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar user={u} size="md" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="m-0 text-base font-bold truncate">{u.fullName}</h4>
                    {!u.isActive && <Badge variant="neutral">Deactivated</Badge>}
                    {u.id === me?.id && <Badge variant="info">You</Badge>}
                  </div>
                  <p className="text-muted m-0 mt-0.5 text-sm truncate">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
                  {config.role === "attendee" && (
                    <p className="text-muted m-0 mt-0.5 text-xs">
                      {u.registrationCount} registration(s) · {u.attendedCount} attended
                    </p>
                  )}
                  {config.role === "photographer" && (
                    <p className="text-muted m-0 mt-0.5 text-xs">Assigned to {u.assignedEventCount} event(s)</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button type="button" variant="ghost" onClick={() => openEdit(u)}>Edit</Button>
                <Button type="button" variant="ghost" onClick={() => openPassword(u)}>Set password</Button>
                <Button
                  type="button"
                  variant={u.isActive ? "danger" : "primary"}
                  onClick={() => toggleStatus(u)}
                  disabled={busyId === u.id || u.id === me?.id}
                  title={u.id === me?.id ? "You cannot deactivate your own account" : undefined}
                >
                  {u.isActive ? "Deactivate" : "Activate"}
                </Button>
                <Button type="button" variant="danger" onClick={() => setDeleteTarget(u)} disabled={busyId === u.id || u.id === me?.id}>
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {createOpen && (
        <Modal title={`Create ${config.singular}`} onClose={() => setCreateOpen(false)}>
          {!createResult ? (
            <form onSubmit={submitCreate}>
              <Input label="Full name" id="c-fullName" value={createForm.fullName}
                onChange={(e) => setCreateForm((p) => ({ ...p, fullName: e.target.value }))} required autoFocus />
              <Input label="Email" id="c-email" type="email" value={createForm.email}
                onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))} required />
              <Input label="Phone" id="c-phone" value={createForm.phone}
                onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Optional" />
              <Input label="Password" id="c-password" type="text" value={createForm.password}
                onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Leave blank to auto-generate" helper="No OTP step for admin-created accounts." />
              <label className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300 mb-4">
                <input type="checkbox" checked={createForm.sendEmail}
                  onChange={(e) => setCreateForm((p) => ({ ...p, sendEmail: e.target.checked }))}
                  className="w-4 h-4 accent-brand-600" />
                Email the sign-in details to this address
              </label>
              <Button type="submit" disabled={creating} style={{ width: "100%" }}>
                {creating ? "Creating…" : `Create ${config.singular}`}
              </Button>
            </form>
          ) : (
            <div>
              <Alert variant="success">Account created for {createResult.user.email}.</Alert>
              <Alert variant={createResult.emailDelivered ? "info" : "warn"} className="mt-3">
                {createResult.emailDelivered
                  ? "Credentials were emailed to them."
                  : "Email delivery is not configured, so nothing was sent."}
              </Alert>
              {createResult.generatedPassword && (
                <div className="card-muted mt-3">
                  <div className="text-xs uppercase">Generated password</div>
                  <strong className="text-base tracking-wide">{createResult.generatedPassword}</strong>
                  <p className="text-sm m-0 mt-1">Share this with them if the email was not delivered.</p>
                </div>
              )}
              <div className="card-muted mt-3">
                <div className="text-xs uppercase">Sign-in link</div>
                <a href={createResult.loginUrl} className="font-semibold text-brand-600 dark:text-brand-300 break-all">
                  {createResult.loginUrl}
                </a>
              </div>
              <Button type="button" className="mt-4" style={{ width: "100%" }} onClick={() => setCreateOpen(false)}>Done</Button>
            </div>
          )}
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit ${editing.fullName}`} onClose={() => setEditing(null)}>
          <form onSubmit={submitEdit}>
            <Input label="Full name" id="e-fullName" value={editForm.fullName}
              onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))} required />
            <Input label="Email" id="e-email" type="email" value={editForm.email}
              onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} required />
            <Input label="Phone" id="e-phone" value={editForm.phone}
              onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} />
            <Button type="submit" disabled={saving} style={{ width: "100%" }}>{saving ? "Saving…" : "Save changes"}</Button>
          </form>
        </Modal>
      )}

      {passwordTarget && (
        <PasswordModal
          user={passwordTarget}
          result={passwordResult}
          sending={passwordSending}
          onSubmit={submitPassword}
          onClose={() => setPasswordTarget(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.fullName}?`}
        message="This also removes their registrations. This cannot be undone."
        confirmLabel="Delete"
        loading={busyId === deleteTarget?.id}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminConsoleLayout>
  );
}

function PasswordModal({ user, result, sending, onSubmit, onClose }) {
  const [custom, setCustom] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  return (
    <Modal title={`Set password for ${user.fullName}`} onClose={onClose}>
      {!result ? (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(custom, sendEmail); }}>
          <Input label="New password" id="p-password" value={custom} onChange={(e) => setCustom(e.target.value)}
            placeholder="Leave blank to auto-generate" minLength={custom ? 6 : undefined} />
          <label className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300 mb-4">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="w-4 h-4 accent-brand-600" />
            Email the new password to them
          </label>
          <p className="helper-text mb-4">This ends any session they are currently signed into.</p>
          <Button type="submit" disabled={sending} style={{ width: "100%" }}>{sending ? "Working…" : "Set password"}</Button>
        </form>
      ) : (
        <div>
          <Alert variant="success">Password updated.</Alert>
          <Alert variant={result.emailDelivered ? "info" : "warn"} className="mt-3">
            {result.emailDelivered ? "The new password was emailed to them." : "Email delivery is not configured."}
          </Alert>
          {result.generatedPassword && (
            <div className="card-muted mt-3">
              <div className="text-xs uppercase">Generated password</div>
              <strong className="text-base tracking-wide">{result.generatedPassword}</strong>
            </div>
          )}
          <Button type="button" className="mt-4" style={{ width: "100%" }} onClick={onClose}>Done</Button>
        </div>
      )}
    </Modal>
  );
}
