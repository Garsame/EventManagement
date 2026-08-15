import { Link } from "react-router-dom";
import Card from "./ui/Card.jsx";

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function EventCard({ event }) {
  const coverUrl = `https://picsum.photos/seed/${event._id}/640/400`;

  return (
    <Card className="p-0 overflow-hidden flex flex-col">
      <div className="aspect-video overflow-hidden bg-slate-100">
        <img src={coverUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
      </div>
      <div className="p-5 flex flex-col flex-1">
        <div className="flex justify-between items-start gap-2">
          <h3 className="m-0 text-lg font-bold text-slate-900">{event.title}</h3>
          <span className="badge badge-info shrink-0">Upcoming</span>
        </div>
        <p className="text-muted mt-1 text-sm">{formatDate(event.startDateTime)}</p>
        <p className="text-muted mt-1 flex-1">{event.location || "Location TBA"}</p>
        <Link
          to={`/events/${event._id}`}
          className="mt-4 inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:text-brand-700 hover:gap-2.5 transition-all"
        >
          Explore event
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </Card>
  );
}
