import { Link } from "react-router-dom";
import Card from "./ui/Card.jsx";
import Badge from "./ui/Badge.jsx";

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function PremiumEventCard({ event }) {
  const coverUrl = event.coverImageUrl || `https://picsum.photos/seed/${event._id}/640/400`;
  const prices = (event.plans || []).map((p) => p.price).filter((n) => Number.isFinite(n));
  const fromPrice = prices.length ? Math.min(...prices) : null;
  const currency = event.currency || "USD";

  return (
    <Card className="p-0 overflow-hidden flex flex-col border-2 border-violet-200 dark:border-violet-500/30">
      <div className="aspect-video overflow-hidden bg-slate-100 relative">
        <img src={coverUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        <Badge variant="premium" className="!absolute top-3 left-3">★ Premium</Badge>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="m-0 text-lg font-bold text-slate-900 dark:text-white">{event.title}</h3>
        <p className="text-muted mt-1 text-sm">{formatDate(event.startDateTime)}</p>
        <p className="text-muted mt-1 flex-1">{event.location || "Location TBA"}</p>
        {fromPrice !== null && (
          <p className="mt-2 font-semibold text-violet-700 dark:text-violet-300">
            From {currency} {fromPrice} · {(event.plans || []).length} plan{(event.plans || []).length === 1 ? "" : "s"}
          </p>
        )}
        <Link
          to={`/events/${event._id}`}
          className="mt-4 inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:text-brand-700 hover:gap-2.5 transition-all"
        >
          View plans & register
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </Card>
  );
}
