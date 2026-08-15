import { Link } from "react-router-dom";
import Navbar from "../Navbar.jsx";

export default function PublicLayout({ children }) {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="flex-1">{children}</main>
      <footer className="footer">
        <div className="container py-10 flex flex-col sm:flex-row justify-between gap-6">
          <div>
            <Link to="/" className="nav-brand">
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <circle cx="16" cy="16" r="15" stroke="#6366f1" strokeWidth="2" />
                <circle cx="16" cy="16" r="4.5" fill="#6366f1" />
              </svg>
              <span>EventMedia</span>
            </Link>
            <p className="text-muted mt-2 max-w-xs text-sm">
              Public events, easy registration, secure check-in, and private galleries for verified attendees.
            </p>
          </div>
          <div className="flex gap-10 text-sm">
            <div className="stack gap-2">
              <span className="font-bold text-slate-900">Product</span>
              <Link to="/how-it-works" className="text-muted hover:text-slate-900">How it works</Link>
              <Link to="/events" className="text-muted hover:text-slate-900">Events</Link>
            </div>
            <div className="stack gap-2">
              <span className="font-bold text-slate-900">Account</span>
              <Link to="/login" className="text-muted hover:text-slate-900">Log in</Link>
              <Link to="/register" className="text-muted hover:text-slate-900">Register</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
