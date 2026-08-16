import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Avatar from "./Avatar.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

function Logo() {
  return (
    <Link to="/" className="nav-brand">
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <circle cx="16" cy="16" r="15" stroke="url(#navLogoGrad)" strokeWidth="2" />
        <path d="M16 6 L23 12 L23 20 L16 26 L9 20 L9 12 Z" stroke="url(#navLogoGrad)" strokeWidth="1.6" fill="none" />
        <circle cx="16" cy="16" r="4.5" fill="url(#navLogoGrad)" />
        <defs>
          <linearGradient id="navLogoGrad" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0" stopColor="#6366f1" />
            <stop offset="1" stopColor="#4338ca" />
          </linearGradient>
        </defs>
      </svg>
      <span>EventMedia</span>
    </Link>
  );
}

const linkClass = ({ isActive }) => (isActive ? "is-active" : undefined);

// .nav-links a.is-active only styles links that are direct children of
// .nav-links, so the mobile panel (a separate <nav>, stacked instead of
// inline) needs its own version of the same weight/colour treatment.
const mobileLinkClass = ({ isActive }) =>
  `block py-3 text-base font-bold ${
    isActive ? "text-brand-600 dark:text-brand-300" : "text-slate-700 dark:text-slate-200"
  }`;

export default function Navbar() {
  const navigate = useNavigate();
  // The public realm only ever authenticates attendees now - admin and
  // photographer sign in through their own separate realms entirely - so
  // there is no staff branch to render here.
  const { user, isAuthed, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the account menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  // .nav-links is hidden below md with no other way to reach it, so the
  // mobile panel needs its own Escape handler and must close on route change
  // (handled by the NavLink onClick below) rather than relying on the
  // account menu's outside-click logic, which is scoped to a different ref.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    setMobileOpen(false);
    await logout();
    navigate("/login");
  };

  return (
    <div className="navbar">
      <div className="navbar-inner">
        <Logo />

        <nav className="nav-links">
          <NavLink to="/" end className={linkClass}>Home</NavLink>
          <NavLink to="/how-it-works" className={linkClass}>How it works</NavLink>
          <NavLink to="/events" className={linkClass}>Events</NavLink>
          {/* Dashboard only exists for signed-in users. */}
          {isAuthed && <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="md:hidden w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileOpen ? (
                <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              )}
            </svg>
          </button>

          <ThemeToggle />

          {isAuthed ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                className={`avatar-button ${menuOpen ? "is-open" : ""}`}
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <Avatar user={user} size="sm" />
                {/* Name sits beside the avatar only when there is room for it. */}
                <span className="hidden sm:inline text-sm font-semibold max-w-[9rem] truncate">
                  {user?.firstName || user?.email}
                </span>
              </button>

              {menuOpen && (
                <div className="menu" role="menu">
                  <div className="px-3 py-2">
                    <div className="font-bold truncate">{user?.fullName}</div>
                    <div className="text-muted text-xs truncate">{user?.email}</div>
                    <span className="badge badge-neutral mt-2 capitalize">{user?.role}</span>
                  </div>
                  <div className="menu-divider" />
                  <Link to="/dashboard" onClick={() => setMenuOpen(false)} role="menuitem">Dashboard</Link>
                  <Link to="/dashboard/events" onClick={() => setMenuOpen(false)} role="menuitem">Your events</Link>
                  <Link to="/dashboard/profile" onClick={() => setMenuOpen(false)} role="menuitem">
                    Profile
                    {!user?.profileComplete && (
                      <span className="badge badge-warn ml-auto">Incomplete</span>
                    )}
                  </Link>
                  <div className="menu-divider" />
                  <button type="button" onClick={handleLogout} role="menuitem">Log out</button>
                </div>
              )}
            </div>
          ) : (
            // Hidden below md - cramming these in beside the hamburger and
            // theme toggle overflowed at narrow widths (measured 47px at
            // 375px signed out). They reappear in the mobile drawer instead,
            // the same way nav-links already does.
            <div className="hidden md:flex items-center gap-2">
              <Link to="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white px-2">
                Log in
              </Link>
              <Link to="/register" className="btn btn-primary">Register</Link>
            </div>
          )}
        </div>
      </div>

      {mobileOpen && (
        <nav className="md:hidden border-t border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-950" aria-label="Mobile">
          <div className="shell-wrap py-2 flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            <NavLink to="/" end className={mobileLinkClass} onClick={() => setMobileOpen(false)}>
              Home
            </NavLink>
            <NavLink to="/how-it-works" className={mobileLinkClass} onClick={() => setMobileOpen(false)}>
              How it works
            </NavLink>
            <NavLink to="/events" className={mobileLinkClass} onClick={() => setMobileOpen(false)}>
              Events
            </NavLink>
            {isAuthed && (
              <NavLink to="/dashboard" className={mobileLinkClass} onClick={() => setMobileOpen(false)}>
                Dashboard
              </NavLink>
            )}
            {!isAuthed && (
              <>
                <NavLink to="/login" className={mobileLinkClass} onClick={() => setMobileOpen(false)}>
                  Log in
                </NavLink>
                <Link
                  to="/register"
                  onClick={() => setMobileOpen(false)}
                  className="btn btn-primary mt-3 mb-1"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
