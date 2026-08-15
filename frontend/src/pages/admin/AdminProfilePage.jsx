import { useEffect, useRef, useState } from "react";
import { adminClient, adminTokenStore, useAdminAuth } from "../../context/AdminAuthContext.jsx";
import AdminConsoleLayout from "../../components/layout/AdminConsoleLayout.jsx";
import Card from "../../components/ui/Card.jsx";
import Input from "../../components/ui/Input.jsx";
import Button from "../../components/ui/Button.jsx";
import Alert from "../../components/ui/Alert.jsx";
import Avatar from "../../components/Avatar.jsx";
import ChangePasswordCard from "../../components/ChangePasswordCard.jsx";

export default function AdminProfilePage() {
  const { user, applyUser } = useAdminAuth();
  const fileRef = useRef(null);
  const [form, setForm] = useState({ fullName: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) setForm({ fullName: user.fullName || "", phone: user.phone || "" });
  }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await adminClient.patch("/api/users/me", form);
      applyUser(res.data.user);
      setMessage("Profile saved.");
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not save your profile");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await adminClient.post("/api/users/me/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } });
      applyUser(res.data.user);
      setMessage("Profile photo updated.");
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not upload that image");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <AdminConsoleLayout title="Profile" subtitle="Your account details">
      {message && <Alert variant="success" className="mb-5">{message}</Alert>}
      {error && <Alert variant="error" className="mb-5">{error}</Alert>}

      <div className="stack gap-5">
        <Card>
          <div className="flex items-center gap-5 flex-wrap">
            <Avatar user={user} size="lg" />
            <div>
              <h3 className="m-0 text-lg font-bold">{user?.fullName}</h3>
              <p className="text-muted m-0 mt-0.5">{user?.email}</p>
              <span className="badge badge-info mt-2 capitalize">{user?.role}</span>
              <div className="mt-4">
                <input ref={fileRef} id="admin-avatar" type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
                <label htmlFor="admin-avatar" className="btn btn-ghost cursor-pointer">
                  {uploading ? "Working…" : "Change photo"}
                </label>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="mt-0 mb-4 text-lg font-bold">Your details</h3>
          <form onSubmit={submit}>
            <Input label="Full name" id="fullName" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} required />
            <Input label="Phone" id="phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </form>
        </Card>

        <ChangePasswordCard email={user?.email} client={adminClient} tokenStore={adminTokenStore} />
      </div>
    </AdminConsoleLayout>
  );
}
