import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../api/client.js";
import Card from "../components/ui/Card.jsx";
import Alert from "../components/ui/Alert.jsx";
import Loading from "../components/ui/Loading.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import PublicLayout from "../components/layout/PublicLayout.jsx";

export default function GalleryPage() {
  const { eventId } = useParams();
  const [state, setState] = useState({ loading: true, error: "", code: null, unlocked: false, media: [] });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await client.get(`/api/events/${eventId}/gallery`);
        setState({ loading: false, error: "", code: null, unlocked: true, media: res.data.media || [] });
      } catch (err) {
        const code = err.response?.data?.error?.code;
        const msg = err.response?.data?.error?.message || "Unable to load gallery";
        setState({ loading: false, error: msg, code, unlocked: false, media: [] });
      }
    };
    load();
  }, [eventId]);

  const locked = !state.unlocked;

  return (
    <PublicLayout>
      <div className="container page">
        <PageHeader title="Event Gallery" subtitle="Media available after check-in" />
        {state.loading && <Loading />}
        {!state.loading && locked && (
          <Card>
            {state.code === "NOT_REGISTERED" && (
              <EmptyState
                title="Register first"
                description="Sign up for this event to unlock its gallery."
                action={<Link className="btn btn-primary" to={`/events/${eventId}`}>Go to event</Link>}
              />
            )}
            {state.code === "NOT_ATTENDED" && (
              <EmptyState
                title="Check-in required"
                description="You must be checked in at the event to view media."
                action={<Link className="btn btn-secondary" to={`/events/${eventId}`}>View event info</Link>}
              />
            )}
            {!state.code && state.error && <Alert variant="error">{state.error}</Alert>}
            {!state.code && !state.error && <Loading />}
          </Card>
        )}

        {!state.loading && state.unlocked && state.media.length === 0 && (
          <Card>
            <EmptyState title="No media yet" description="Photos and videos from this event will appear here once uploaded." />
          </Card>
        )}

        {!state.loading && state.unlocked && state.media.length > 0 && (
          <div className="grid grid-3">
            {state.media.map((m) => (
              <Card key={m.id} style={{ textAlign: "center" }}>
                {m.type === "video" ? (
                  <video src={m.url} poster={m.thumbnailUrl} controls style={{ width: "100%", borderRadius: 8 }} />
                ) : (
                  <a href={m.url} target="_blank" rel="noreferrer">
                    <img src={m.thumbnailUrl} alt={m.caption || "Event media"} style={{ width: "100%", borderRadius: 8 }} />
                  </a>
                )}
                {m.caption && <p className="text-muted" style={{ marginTop: "0.5rem" }}>{m.caption}</p>}
              </Card>
            ))}
          </div>
        )}

        <p style={{ marginTop: "1rem" }}>
          <Link to={`/events/${eventId}`}>Back to event details</Link>
        </p>
      </div>
    </PublicLayout>
  );
}
