import { useEffect, useMemo, useState } from "react";
import client from "../api/client.js";
import EmptyState from "../components/ui/EmptyState.jsx";
import Loading from "../components/ui/Loading.jsx";
import Input from "../components/ui/Input.jsx";
import PublicLayout from "../components/layout/PublicLayout.jsx";
import EventCard from "../components/EventCard.jsx";
import PremiumEventCard from "../components/PremiumEventCard.jsx";

/**
 * A mosaic of the actual upcoming events rather than one generic stock photo -
 * it changes as real events are published instead of being decoration
 * unrelated to what the page is about. Only events with a real cover image
 * are eligible; an event with none never contributes a placeholder tile.
 */
function EventMosaic({ events }) {
  const tiles = events.filter((e) => e.coverImageUrl).slice(0, 4);
  if (tiles.length === 0) {
    return (
      <div className="rounded-3xl overflow-hidden shadow-xl shadow-slate-900/10 aspect-square bg-gradient-to-br from-brand-100 to-accent-100 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center">
        <span className="text-5xl" aria-hidden="true">🎟️</span>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 aspect-square">
      {tiles.map((e, i) => (
        <div
          key={e._id}
          className={`rounded-2xl overflow-hidden shadow-lg shadow-slate-900/10 ${tiles.length === 3 && i === 2 ? "col-span-2" : ""}`}
        >
          <img src={e.coverImageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ))}
    </div>
  );
}

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

  const upcomingCount = events.filter((e) => new Date(e.startDateTime) >= new Date()).length;

  return (
    <PublicLayout>
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-white to-accent-50 border-b border-slate-200/70 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 dark:border-slate-800">
        <div className="shell-wrap py-14 sm:py-20 grid gap-10 lg:grid-cols-2 items-center">
          <div>
            <span className="badge badge-info mb-5">Events</span>
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-[1.08] text-slate-900 dark:text-white">
              Every event on EventMedia, in one place.
            </h1>
            <p className="mt-5 text-lg text-slate-600 dark:text-slate-300 max-w-lg">
              Public and published events, open for anyone to browse and register. Find yours, RSVP, and check
              your gallery after check-in.
            </p>

            <div className="flex gap-6 mt-7">
              <div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{events.length}</div>
                <div className="text-sm text-muted">Public events</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{upcomingCount}</div>
                <div className="text-sm text-muted">Upcoming</div>
              </div>
            </div>

            <div className="max-w-md mt-8">
              <Input
                className="!mb-0"
                placeholder="Search by title or location"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <EventMosaic events={events} />
        </div>
      </section>

      <div className="shell-wrap">
        <div className="section">
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
                  e.isPremium ? <PremiumEventCard key={e._id} event={e} /> : <EventCard key={e._id} event={e} />
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
