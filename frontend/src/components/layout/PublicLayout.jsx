import { Link } from "react-router-dom";
import Navbar from "../Navbar.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

// Placeholders - the admin asked for these to stay generic for now and be
// filled in with real details later.
const ORGANIZER_NAME = "EventMedia Team";
const ORGANIZER_LOCATION = "Mogadishu, Somalia";
const ORGANIZER_EMAIL = "hello@eventmedia.example";

function FooterLink({ to, children }) {
  return (
    <li className="flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" aria-hidden="true" />
      <Link to={to} className="text-brand-300 hover:text-brand-200 transition-colors">
        {children}
      </Link>
    </li>
  );
}

function FooterHeading({ children }) {
  return (
    <h3 className="text-white font-bold text-sm tracking-wide mb-4 pb-3 border-b border-white/10">
      {children}
    </h3>
  );
}

export default function PublicLayout({ children }) {
  const { isAuthed } = useAuth();

  return (
    <div className="app-shell">
      <Navbar />
      <main className="flex-1">{children}</main>

      {/* Footer is intentionally always-dark, independent of the site theme
          toggle, and only ever links to attendee-facing pages - the admin
          and photographer consoles live at their own unlisted addresses and
          have nothing here. */}
      <footer className="bg-slate-950 text-slate-400">
        <div className="shell-wrap py-14 grid gap-10 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <FooterHeading>About EventMedia</FooterHeading>
            <p className="text-sm leading-relaxed m-0">
              EventMedia keeps your event photos and videos private — visible only to guests who
              registered and checked in. No public dumps, no strangers browsing your memories.
            </p>
          </div>

          <div>
            <FooterHeading>Quick Links</FooterHeading>
            <ul className="stack gap-2.5 text-sm list-none p-0 m-0">
              <FooterLink to="/">Home</FooterLink>
              <FooterLink to="/how-it-works">How it works</FooterLink>
              <FooterLink to="/events">Events</FooterLink>
              <FooterLink to="/register">Register</FooterLink>
            </ul>
          </div>

          <div>
            <FooterHeading>Participant Services</FooterHeading>
            <ul className="stack gap-2.5 text-sm list-none p-0 m-0">
              {isAuthed ? (
                <>
                  <FooterLink to="/dashboard">Dashboard</FooterLink>
                  <FooterLink to="/dashboard/events">Your events</FooterLink>
                  <FooterLink to="/dashboard/profile">Profile</FooterLink>
                </>
              ) : (
                <>
                  <FooterLink to="/register">Register as participant</FooterLink>
                  <FooterLink to="/login">Sign in</FooterLink>
                </>
              )}
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" aria-hidden="true" />
                <a href={`mailto:${ORGANIZER_EMAIL}`} className="text-brand-300 hover:text-brand-200 transition-colors">
                  Contact support
                </a>
              </li>
            </ul>
          </div>

          <div>
            <FooterHeading>Organizer Contact</FooterHeading>
            <ul className="stack gap-3 text-sm list-none p-0 m-0">
              <li className="flex items-start gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true">
                  <path d="M4 21V8l8-5 8 5v13M9 21v-6h6v6M4 21h16" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span><strong className="text-white font-semibold">Organizer:</strong> {ORGANIZER_NAME}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span><strong className="text-white font-semibold">Location:</strong> {ORGANIZER_LOCATION}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  <strong className="text-white font-semibold">Email:</strong>{" "}
                  <a href={`mailto:${ORGANIZER_EMAIL}`} className="text-brand-300 hover:text-brand-200 transition-colors">
                    {ORGANIZER_EMAIL}
                  </a>
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="shell-wrap py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <span>© {new Date().getFullYear()} EventMedia. All rights reserved.</span>
            <span>Every event, remembered.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
