import { useEffect, useMemo, useState } from "react";
import client from "../api/client.js";
import EmptyState from "../components/ui/EmptyState.jsx";
import Loading from "../components/ui/Loading.jsx";
import Input from "../components/ui/Input.jsx";
import PublicLayout from "../components/layout/PublicLayout.jsx";
import PageHero from "../components/PageHero.jsx";
import EventCard from "../components/EventCard.jsx";

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await client.get("/api/events/public");
        setEvents(res.data);
      } catch (err) {
        setError(err.response?.data?.error?.message || "Failed to load events");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return events.filter((e) => e.title.toLowerCase().includes(q) || (e.location || "").toLowerCase().includes(q));
  }, [events, search]);

  return (
    <PublicLayout>
      <PageHero
        eyebrow="Events"
        title="Every event on EventMedia, in one place."
        subtitle="Public and published events, open for anyone to browse and register. Find yours, RSVP, and check your gallery after check-in."
        image="https://picsum.photos/seed/eventmedia-events/900/700"
      />

      <div className="shell-wrap">
        <div className="section">
          <div className="max-w-md mb-8">
            <Input placeholder="Search by title or location" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {loading && <Loading label="Loading events..." />}
          {error && <p className="text-rose-600">{error}</p>}
          {!loading && !error && (
            filtered.length === 0 ? (
              <EmptyState
                title={events.length === 0 ? "No events published yet" : "No events match your search"}
                description={events.length === 0 ? "Check back soon, or log in as an organizer to create one." : "Try a different title or location."}
              />
            ) : (
              <div className="grid grid-3">
                {filtered.map((e) => (
                  <EventCard key={e._id} event={e} />
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
