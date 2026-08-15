import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import client from "../api/client.js";
import Card from "../components/ui/Card.jsx";
import Input from "../components/ui/Input.jsx";
import Button from "../components/ui/Button.jsx";
import Alert from "../components/ui/Alert.jsx";
import Loading from "../components/ui/Loading.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import AdminLayout from "../components/layout/AdminLayout.jsx";
import AdminSidebar from "../components/layout/AdminSidebar.jsx";

export default function PhotographerUploadPage() {
  const { eventId } = useParams();
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const loadMedia = async () => {
    setLoading(true);
    setListError("");
    try {
      const res = await client.get(`/api/events/${eventId}/media`);
      setMedia(res.data.media);
    } catch (err) {
      setListError(err.response?.data?.error?.message || "Failed to load media");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const handleFileChange = (e) => {
    setFile(e.target.files?.[0] || null);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setUploadError("Choose a photo or video first");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (caption) formData.append("caption", caption);
      await client.post(`/api/events/${eventId}/media`, formData, {
        headers: { "Content-Type": undefined },
      });
      setFile(null);
      setCaption("");
      e.target.reset();
      await loadMedia();
    } catch (err) {
      setUploadError(err.response?.data?.error?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (mediaId) => {
    setDeletingId(mediaId);
    try {
      await client.delete(`/api/events/${eventId}/media/${mediaId}`);
      setMedia((prev) => prev.filter((m) => m.id !== mediaId));
    } catch (err) {
      setListError(err.response?.data?.error?.message || "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const topbar = <PageHeader title="Manage Media" subtitle={`Upload and manage photos/videos for this event`} />;

  return (
    <AdminLayout sidebar={<AdminSidebar />} topbar={topbar}>
      <Card>
        <h3 className="mt-0 mb-3 text-lg font-bold">Upload Media</h3>
        <form onSubmit={handleUpload} className="grid gap-3">
          <input
            type="file"
            accept="image/*,video/*"
            onChange={handleFileChange}
            className="text-sm text-slate-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0
                       file:bg-brand-50 file:text-brand-700 file:font-semibold hover:file:bg-brand-100 file:cursor-pointer cursor-pointer"
          />
          <Input label="Caption (optional)" name="caption" value={caption} onChange={(e) => setCaption(e.target.value)} />
          {uploadError && <Alert variant="error">{uploadError}</Alert>}
          <Button type="submit" disabled={uploading}>
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </form>
      </Card>

      <div className="section">
        <h3 className="mb-3 text-lg font-bold">Uploaded Media</h3>
        {loading && <Loading />}
        {listError && <Alert variant="error">{listError}</Alert>}
        {!loading && !listError && media.length === 0 && (
          <EmptyState title="No media yet" description="Uploaded photos and videos for this event will appear here." />
        )}
        {!loading && media.length > 0 && (
          <div className="grid grid-3">
            {media.map((m) => (
              <Card key={m.id} style={{ textAlign: "center" }}>
                {m.type === "video" ? (
                  <video src={m.url} poster={m.thumbnailUrl} controls style={{ width: "100%", borderRadius: 8 }} />
                ) : (
                  <img src={m.thumbnailUrl} alt={m.caption || "Event media"} style={{ width: "100%", borderRadius: 8 }} />
                )}
                {m.caption && <p className="text-muted" style={{ marginTop: "0.5rem" }}>{m.caption}</p>}
                <Button
                  variant="danger"
                  disabled={deletingId === m.id}
                  onClick={() => handleDelete(m.id)}
                  style={{ marginTop: "0.5rem" }}
                >
                  {deletingId === m.id ? "Deleting..." : "Delete"}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
