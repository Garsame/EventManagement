import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../api/client.js";
import Card from "../components/ui/Card.jsx";
import Alert from "../components/ui/Alert.jsx";
import Loading from "../components/ui/Loading.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import SectionLayout, { useEventBase } from "../components/layout/SectionLayout.jsx";

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
    <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SpinnerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" opacity="0.25" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

const extFromUrl = (url) => {
  const clean = (url || "").split("?")[0];
  const match = clean.match(/\.([a-zA-Z0-9]{2,5})$/);
  return match ? match[1] : "";
};

const slugify = (s) =>
  (s || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default function GalleryPage() {
  const { eventId } = useParams();
  const base = useEventBase();
  const [state, setState] = useState({ loading: true, error: "", code: null, unlocked: false, media: [] });
  const [preview, setPreview] = useState(null);
  const [tab, setTab] = useState("photos");
  const [downloadingId, setDownloadingId] = useState(null);

  // Fetches the original file as a blob so `download` actually saves it
  // instead of navigating to it (browsers otherwise ignore `download` on a
  // cross-origin link). If the fetch is ever blocked, this quietly falls
  // back to opening the file in a new tab so the guest can still save it
  // manually - it never surfaces an error to them either way.
  const downloadMedia = async (item) => {
    setDownloadingId(item.id);
    const ext = extFromUrl(item.url) || (item.type === "video" ? "mp4" : "jpg");
    const filename = `${slugify(item.caption) || (item.type === "video" ? "event-video" : "event-photo")}-${item.id}.${ext}`;
    try {
      const res = await fetch(item.url, { mode: "cors" });
      if (!res.ok) throw new Error("Download request failed");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
    } catch (err) {
      window.open(item.url, "_blank", "noopener");
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    client
      .get(`/api/events/${eventId}/gallery`)
      .then((res) => setState({ loading: false, error: "", code: null, unlocked: true, media: res.data.media || [] }))
      .catch((err) =>
        setState({
          loading: false,
          error: err.response?.data?.error?.message || "Unable to load gallery",
          code: err.response?.data?.error?.code,
          unlocked: false,
          media: [],
        })
      );
  }, [eventId]);

  // Escape closes the preview.
  useEffect(() => {
    if (!preview) return undefined;
    const onKey = (e) => e.key === "Escape" && setPreview(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [preview]);

  const locked = !state.unlocked;
  const counts = useMemo(
    () => ({
      photos: state.media.filter((m) => m.type !== "video").length,
      videos: state.media.filter((m) => m.type === "video").length,
    }),
    [state.media]
  );
  const visibleMedia = useMemo(
    () => state.media.filter((m) => (tab === "videos" ? m.type === "video" : m.type !== "video")),
    [state.media, tab]
  );

  return (
    <SectionLayout title="Event Gallery" subtitle="Media available after check-in">
      {state.loading && <Loading />}

      {!state.loading && locked && (
        <Card>
          {state.code === "NOT_REGISTERED" && (
            <EmptyState
              title="Register first"
              description="Sign up for this event to unlock its gallery."
              action={<Link className="btn btn-primary" to={`${base}/${eventId}`}>Go to event</Link>}
            />
          )}
          {state.code === "NOT_ATTENDED" && (
            <EmptyState
              title="Check-in required"
              description="You must be checked in at the event to view media."
              action={<Link className="btn btn-secondary" to={`${base}/${eventId}`}>View event info</Link>}
            />
          )}
          {!state.code && state.error && <Alert variant="error">{state.error}</Alert>}
        </Card>
      )}

      {!state.loading && state.unlocked && state.media.length === 0 && (
        <Card>
          <EmptyState title="No media yet" description="Photos and videos from this event will appear here once uploaded." />
        </Card>
      )}

      {!state.loading && state.unlocked && state.media.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <p className="text-muted m-0">{state.media.length} item(s)</p>
            <div className="flex gap-2">
              {[{ key: "photos", label: "Photos" }, { key: "videos", label: "Videos" }].map((t) => (
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

          {visibleMedia.length === 0 && (
            <div className="empty-state mb-4">
              <p className="m-0">No {tab} yet.</p>
            </div>
          )}

          <div className="gallery-grid">
            {visibleMedia.map((m, i) => (
              <div key={m.id} className="relative group">
                <button
                  type="button"
                  className="gallery-tile w-full"
                  onClick={() => setPreview(m)}
                  title={m.caption || "Open"}
                >
                  {m.type === "video" ? (
                    <video src={m.url} poster={m.thumbnailUrl} muted />
                  ) : (
                    <img
                      src={m.thumbnailUrl}
                      alt={m.caption || "Event media"}
                      /* First two rows are on screen at load; only defer the rest. */
                      loading={i < 8 ? "eager" : "lazy"}
                    />
                  )}
                  {m.caption && <span className="gallery-caption">{m.caption}</span>}
                </button>
                <button
                  type="button"
                  className="gallery-download-btn opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
                  onClick={(e) => { e.stopPropagation(); downloadMedia(m); }}
                  disabled={downloadingId === m.id}
                  title={`Download ${m.type === "video" ? "video" : "photo"}`}
                  aria-label={`Download ${m.caption || (m.type === "video" ? "video" : "photo")}`}
                >
                  {downloadingId === m.id ? <SpinnerIcon /> : <DownloadIcon />}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="mt-6 mb-0">
        <Link to={`${base}/${eventId}`} className="btn btn-ghost">← Back to event details</Link>
      </p>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-4xl w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            {preview.type === "video" ? (
              <video src={preview.url} controls autoPlay className="w-full max-h-[80vh] rounded-xl" />
            ) : (
              <img src={preview.url} alt={preview.caption || "Event media"} className="w-full max-h-[80vh] object-contain rounded-xl" />
            )}
            <div className="flex items-center justify-between gap-3 mt-3">
              <p className="text-white text-sm m-0 truncate">{preview.caption}</p>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => downloadMedia(preview)}
                  disabled={downloadingId === preview.id}
                >
                  {downloadingId === preview.id ? "Downloading…" : "Download"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setPreview(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SectionLayout>
  );
}
