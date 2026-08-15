import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client.js";
import Card from "../components/ui/Card.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Loading from "../components/ui/Loading.jsx";
import SectionHeader from "../components/ui/SectionHeader.jsx";
import PublicLayout from "../components/layout/PublicLayout.jsx";
import Hero from "../components/Hero.jsx";
import EventCard from "../components/EventCard.jsx";
import IconBadge from "../components/IconBadge.jsx";

const valueProps = [
  { icon: "shield", title: "Secure by default", desc: "Every gallery is gated behind check-in — no public link ever exposes your photos." },
  { icon: "checkin", title: "Zero setup for guests", desc: "No app, no downloads. Register, show up, and your gallery is simply there." },
  { icon: "camera", title: "Built for any event", desc: "Weddings, conferences, launches, community nights — publish yours in minutes." },
];

export default function PublicEventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const featured = events.slice(0, 3);

  return (
    <PublicLayout>
      <Hero />

      <div className="shell-wrap">
        <div className="section">
          <SectionHeader
            title="Why EventMedia"
            subtitle="The short version"
            actions={
              <Link to="/how-it-works" className="font-semibold text-brand-600 hover:text-brand-700 text-sm">
                See the full walkthrough →
              </Link>
            }
          />
          <div className="grid grid-3">
            {valueProps.map((v) => (
              <Card key={v.title}>
                <IconBadge icon={v.icon} tone="brand" />
                <h3 className="mt-4 mb-1.5 text-lg font-bold">{v.title}</h3>
                <p className="text-muted">{v.desc}</p>
              </Card>
            ))}
          </div>
        </div>

        <div className="section">
          <SectionHeader title="Happening soon" subtitle="A preview of what's live right now" />
          {loading && <Loading label="Loading events..." />}
          {error && <p className="text-rose-600">{error}</p>}
          {!loading && !error && (
            featured.length === 0 ? (
              <EmptyState title="No events published yet" description="Check back soon, or log in as an organizer to create one." />
            ) : (
              <div className="grid grid-3">
                {featured.map((e) => (
                  <EventCard key={e._id} event={e} />
                ))}
              </div>
            )
          )}
          <div className="text-center mt-9">
            <Link to="/events" className="btn btn-primary text-base px-7 py-3.5">
              Explore all events
            </Link>
          </div>
        </div>

        <div className="section mb-4">
          <div className="rounded-3xl bg-gradient-to-br from-brand-700 to-brand-900 text-white px-8 py-14 text-center shadow-lg shadow-brand-900/20">
            <h2 className="m-0 text-3xl sm:text-4xl font-extrabold">Have an event to run?</h2>
            <p className="mt-3 text-brand-100 max-w-lg mx-auto">
              Publish it in minutes, check guests in on-site, and give every attendee a private gallery of the moment.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link className="btn bg-white text-brand-700 hover:bg-brand-50 text-base px-6 py-3.5" to="/register">
                Create account
              </Link>
              <Link className="btn bg-brand-800/60 text-white border border-white/20 hover:bg-brand-800 text-base px-6 py-3.5" to="/login">
                Log in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
