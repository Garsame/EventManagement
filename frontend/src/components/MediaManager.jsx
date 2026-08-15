import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Card from "./ui/Card.jsx";
import Input from "./ui/Input.jsx";
import Button from "./ui/Button.jsx";
import Alert from "./ui/Alert.jsx";
import Loading from "./ui/Loading.jsx";
import EmptyState from "./ui/EmptyState.jsx";

/**
 * Upload/list/delete for one event's media. Realm-agnostic: it is handed the
 * right axios client (admin or photographer) by its wrapper page, so the same
 * component works from either console without knowing which one it is in.
 */
export default function MediaManager({ client }) {
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
        headers: { "Content-Type": "multipart/form-data" },
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

  return (
    <>
      <Card>
        <h3 className="mt-0 mb-3 text-lg font-bold">Upload media</h3>
        <form onSubmit={handleUpload} className="grid gap-3">
          <input
            type="file"
            accept="image/*,video/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-sm text-slate-600 dark:text-slate-300 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0
                       file:bg-brand-50 file:text-brand-700 file:font-semibold hover:file:bg-brand-100 file:cursor-pointer cursor-pointer"
          />
          <Input label="Caption (optional)" id="caption" name="caption" value={caption} onChange={(e) => setCaption(e.target.value)} />
          {uploadError && <Alert variant="error">{uploadError}</Alert>}
          <Button type="submit" disabled={uploading}>{uploading ? "Uploading…" : "Upload"}</Button>
        </form>
      </Card>

      <div className="section">
        <h3 className="mb-3 text-lg font-bold">Uploaded media ({media.length})</h3>
        {loading && <Loading />}
        {listError && <Alert variant="error">{listError}</Alert>}
        {!loading && !listError && media.length === 0 && (
          <EmptyState title="No media yet" description="Uploaded photos and videos for this event will appear here." />
        )}
        {!loading && media.length > 0 && (
          <div className="gallery-grid">
            {media.map((m) => (
              <div key={m.id} className="gallery-tile group">
                {m.type === "video" ? (
                  <video src={m.url} poster={m.thumbnailUrl} controls />
                ) : (
                  <img src={m.thumbnailUrl} alt={m.caption || "Event media"} />
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(m.id)}
                  disabled={deletingId === m.id}
                  className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full bg-black/60 text-white
                             flex items-center justify-center hover:bg-rose-600 transition-colors"
                  title="Delete"
                >
                  {deletingId === m.id ? "…" : "✕"}
                </button>
                {m.caption && <span className="gallery-caption">{m.caption}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
