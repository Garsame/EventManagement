import { useEffect, useRef, useState } from "react";
import client from "../api/client.js";
import DashboardLayout from "../components/layout/DashboardLayout.jsx";
import Card from "../components/ui/Card.jsx";
import Input from "../components/ui/Input.jsx";
import Button from "../components/ui/Button.jsx";
import Alert from "../components/ui/Alert.jsx";
import Avatar from "../components/Avatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const EDUCATION_LEVELS = [
  { value: "high-school", label: "High school" },
  { value: "certificate", label: "Certificate" },
  { value: "diploma", label: "Diploma" },
  { value: "bachelors", label: "Bachelor's degree" },
  { value: "masters", label: "Master's degree" },
  { value: "doctorate", label: "Doctorate" },
  { value: "other", label: "Other" },
];

const SEX_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];

const REQUIRED_LABELS = {
  phone: "Mobile number",
  location: "Location",
  institution: "Institution",
  educationLevel: "Education level",
  sex: "Sex",
};

const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");

export default function DashboardProfilePage() {
  const { user, applyUser, refreshUser } = useAuth();
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    fullName: "", phone: "", location: "", institution: "",
    educationLevel: "", fieldOfStudy: "", sex: "", dateOfBirth: "", bio: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    setForm({
      fullName: user.fullName || "",
      phone: user.phone || "",
      location: user.location || "",
      institution: user.institution || "",
      educationLevel: user.educationLevel || "",
      fieldOfStudy: user.fieldOfStudy || "",
      sex: user.sex || "",
      dateOfBirth: toDateInput(user.dateOfBirth),
      bio: user.bio || "",
    });
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await client.patch("/api/users/me", {
        ...form,
        dateOfBirth: form.dateOfBirth || null,
      });
      applyUser(res.data.user);
      setMessage(
        res.data.user.profileComplete
          ? "Profile saved. You can now register for events."
          : "Profile saved."
      );
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
    setMessage("");
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await client.post("/api/users/me/avatar", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      applyUser(res.data.user);
      setMessage("Profile photo updated.");
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not upload that image");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    setUploading(true);
    setError("");
    try {
      const res = await client.delete("/api/users/me/avatar");
      applyUser(res.data.user);
      setMessage("Profile photo removed.");
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not remove the photo");
    } finally {
      setUploading(false);
    }
  };

  const missing = user?.missingProfileFields || [];

  return (
    <DashboardLayout title="Profile" subtitle="Your details, saved once and reused for every event.">
      {message && <Alert variant="success" className="mb-5">{message}</Alert>}
      {error && <Alert variant="error" className="mb-5">{error}</Alert>}

      <div className="grid" style={{ gap: "1.25rem", gridTemplateColumns: "minmax(0,1fr)" }}>
        <Card>
          <div className="flex items-center gap-5 flex-wrap">
            <Avatar user={user} size="lg" />
            <div className="min-w-0">
              <h3 className="m-0 text-lg font-bold truncate">{user?.fullName}</h3>
              <p className="text-muted m-0 mt-0.5 truncate">{user?.email}</p>
              <span className="badge badge-neutral mt-2 capitalize">{user?.role}</span>

              <div className="flex gap-2 mt-4 flex-wrap">
                <input
                  ref={fileRef}
                  id="avatar-input"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatar}
                  className="hidden"
                />
                <label htmlFor="avatar-input" className="btn btn-ghost cursor-pointer">
                  {uploading ? "Working…" : user?.avatarUrl ? "Change photo" : "Upload photo"}
                </label>
                {user?.avatarUrl && (
                  <Button type="button" variant="danger" onClick={handleRemoveAvatar} disabled={uploading}>
                    Remove
                  </Button>
                )}
              </div>
              {!user?.avatarUrl && (
                <p className="helper-text mt-2 mb-0">
                  Without a photo your initials are shown instead.
                </p>
              )}
            </div>
          </div>
        </Card>

        {missing.length > 0 && (
          <Alert variant="error">
            Still needed before you can register for an event:{" "}
            <strong>{missing.map((f) => REQUIRED_LABELS[f] || f).join(", ")}</strong>
          </Alert>
        )}

        <Card>
          <h3 className="mt-0 mb-4 text-lg font-bold">Your details</h3>
          <form onSubmit={handleSubmit}>
            <div className="two-col">
              <Input label="Full name" id="fullName" name="fullName" value={form.fullName} onChange={handleChange} required />
              <Input
                label="Mobile number"
                id="phone"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="+252 61 234 5678"
                error={missing.includes("phone") ? "Required" : ""}
              />
            </div>

            <div className="two-col">
              <Input
                label="Location"
                id="location"
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="City, Country"
                error={missing.includes("location") ? "Required" : ""}
              />
              <Input
                label="Institution"
                id="institution"
                name="institution"
                value={form.institution}
                onChange={handleChange}
                placeholder="University, company or organisation"
                error={missing.includes("institution") ? "Required" : ""}
              />
            </div>

            <div className="two-col">
              <div className="input-row">
                <label className="input-label" htmlFor="educationLevel">Highest education level</label>
                <select id="educationLevel" name="educationLevel" value={form.educationLevel} onChange={handleChange} className="input">
                  <option value="">Select…</option>
                  {EDUCATION_LEVELS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {missing.includes("educationLevel") && <div className="error-text">Required</div>}
              </div>

              <Input
                label="Field of study"
                id="fieldOfStudy"
                name="fieldOfStudy"
                value={form.fieldOfStudy}
                onChange={handleChange}
                placeholder="Optional"
                helper="Leave blank if it does not apply to you."
              />
            </div>

            <div className="two-col">
              <div className="input-row">
                <label className="input-label" htmlFor="sex">Sex</label>
                <select id="sex" name="sex" value={form.sex} onChange={handleChange} className="input">
                  <option value="">Select…</option>
                  {SEX_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {missing.includes("sex") && <div className="error-text">Required</div>}
              </div>

              <Input label="Date of birth" id="dateOfBirth" type="date" name="dateOfBirth" value={form.dateOfBirth} onChange={handleChange} />
            </div>

            <div className="input-row">
              <label className="input-label" htmlFor="bio">Short bio</label>
              <textarea
                id="bio"
                name="bio"
                value={form.bio}
                onChange={handleChange}
                rows={3}
                maxLength={500}
                className="input"
                placeholder="Optional — a sentence about you."
              />
              <div className="helper-text">{form.bio.length}/500</div>
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </Card>

        <Card>
          <h3 className="mt-0 mb-3 text-lg font-bold">Account</h3>
          <div className="two-col">
            <div className="card-muted">
              <div className="text-xs uppercase tracking-wide">Email</div>
              <strong>{user?.email}</strong>
              <p className="text-sm m-0 mt-1">Email cannot be changed here.</p>
            </div>
            <div className="card-muted">
              <div className="text-xs uppercase tracking-wide">Member since</div>
              <strong>
                {user?.createdAt
                  ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(user.createdAt))
                  : "—"}
              </strong>
              <p className="text-sm m-0 mt-1">Role: {user?.role}</p>
            </div>
          </div>
          <Button type="button" variant="ghost" className="mt-4" onClick={refreshUser}>
            Reload from server
          </Button>
        </Card>
      </div>
    </DashboardLayout>
  );
}
