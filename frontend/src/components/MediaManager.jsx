import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Card from "./ui/Card.jsx";
import Input from "./ui/Input.jsx";
import Button from "./ui/Button.jsx";
import Alert from "./ui/Alert.jsx";
import Loading from "./ui/Loading.jsx";
import EmptyState from "./ui/EmptyState.jsx";

const TABS = [
  { key: "photos", label: "Photos" },
  { key: "videos", label: "Videos" },
];

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
  const [files, setFiles] = useState([]);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [tab, setTab] = useState("photos");

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

  const counts = useMemo(
    () => ({
      photos: media.filter((m) => m.type !== "video").length,
      videos: media.filter((m) => m.type === "video").length,
    }),
    [media]
  );
  const visibleMedia = useMemo(
    () => media.filter((m) => (tab === "videos" ? m.type === "video" : m.type !== "video")),
    [media, tab]
  );

  // Uploads go one request at a time behind the scenes - the API only takes
  // one file per call - but selecting many at once and watching them all go
  // up in a single action is the point, so the loop keeps going past a
  // failed file rather than stopping the whole batch.
  const handleUpload = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      setUploadError("Choose one or more photos or videos first");
      return;
    }
    setUploading(true);
    setUploadError("");
    setProgress({ done: 0, total: files.length });

    const failed = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const formData = new FormData();
        formData.append("file", file);
        // A single shared caption only makes sense when there is one file;
        // applying the same text to a whole batch would just be noise.
        if (files.length === 1 && caption) formData.append("caption", caption);
        await client.post(`/api/events/${eventId}/media`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } catch (err) {
        failed.push(file.name);
      }
      setProgress({ done: i + 1, total: files.length });
    }

    setUploading(false);
    setProgress(null);
    setFiles([]);
    setCaption("");
    e.target.reset();
    if (failed.length > 0) {
      setUploadError(`${failed.length} of ${files.length} file(s) failed to upload: ${failed.join(", ")}`);
    }
    await loadMedia();
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
            multiple
            onChange={(e) => setFiles([...(e.target.files || [])])}
            className="text-sm text-slate-600 dark:text-slate-300 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0
                       file:bg-brand-50 file:text-brand-700 file:font-semibold hover:file:bg-brand-100 file:cursor-pointer cursor-pointer"
          />
          {files.length > 1 && (
            <p className="helper-text m-0">{files.length} files selected. Captions are only applied when uploading a single file.</p>
          )}
          {files.length === 1 && (
            <Input label="Caption (optional)" id="caption" name="caption" value={caption} onChange={(e) => setCaption(e.target.value)} />
          )}
          {uploading && progress && (
            <div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
              <p className="helper-text mt-1 mb-0">Uploading {progress.done} of {progress.total}…</p>
            </div>
          )}
          {uploadError && <Alert variant="error">{uploadError}</Alert>}
          <Button type="submit" disabled={uploading}>
            {uploading ? "Uploading…" : files.length > 1 ? `Upload ${files.length} files` : "Upload"}
          </Button>
        </form>
      </Card>

      <div className="section">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h3 className="m-0 text-lg font-bold">Uploaded media ({media.length})</h3>
          <div className="flex gap-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`btn ${tab === t.key ? "btn-primary" : "btn-ghost"} !px-3 !py-2 text-xs`}
              >
                {t.label} ({counts[t.key]})
              </button>
            ))}
          </div>
        </div>

        {loading && <Loading />}
        {listError && <Alert variant="error">{listError}</Alert>}
        {!loading && !listError && visibleMedia.length === 0 && (
          <EmptyState
            title={`No ${tab} yet`}
            description={`Uploaded ${tab} for this event will appear here.`}
          />
        )}
        {!loading && visibleMedia.length > 0 && (
          <div className="gallery-grid">
            {visibleMedia.map((m) => (
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
