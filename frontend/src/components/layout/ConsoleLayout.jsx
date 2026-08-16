import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import Avatar from "../Avatar.jsx";
import ThemeToggle from "../ThemeToggle.jsx";

/**
 * Standalone application shell for a role's console (admin, photographer).
 * Deliberately has nothing in common with the public site's navbar or footer:
 * just the app logo, a sidebar of nav groups, and a topbar holding only the
 * account menu and theme toggle.
 */
export default function ConsoleLayout({
  brandLabel,
  navGroups,
  useAuth,
  loginPath,
  profilePath,
  title,
  subtitle,
  actions,
  children,
}) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate(loginPath, { replace: true });
  };

  const linkClass = ({ isActive }) => `console-link ${isActive ? "is-active" : ""}`;

  return (
    <div className="console-shell">
      {sidebarOpen && <div className="console-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`console-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="console-logo">
          <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <circle cx="16" cy="16" r="15" stroke="url(#consoleLogoGrad)" strokeWidth="2" />
            <path d="M16 6 L23 12 L23 20 L16 26 L9 20 L9 12 Z" stroke="url(#consoleLogoGrad)" strokeWidth="1.6" fill="none" />
            <circle cx="16" cy="16" r="4.5" fill="url(#consoleLogoGrad)" />
            <defs>
              <linearGradient id="consoleLogoGrad" x1="0" y1="0" x2="32" y2="32">
                <stop offset="0" stopColor="#818cf8" />
                <stop offset="1" stopColor="#6366f1" />
              </linearGradient>
            </defs>
          </svg>
          <span>EventMedia</span>
          {brandLabel && <span className="badge badge-info ml-auto">{brandLabel}</span>}
        </div>

        <nav className="console-nav">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="console-nav-group">{group.label}</div>
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={linkClass} onClick={() => setSidebarOpen(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    {item.icon}
                  </svg>
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="console-sidebar-footer">
          <NavLink to={profilePath} className={linkClass} onClick={() => setSidebarOpen(false)}>
            <Avatar user={user} size="sm" />
            <span className="truncate">{user?.fullName || "Profile"}</span>
          </NavLink>
        </div>
      </aside>

      <div className="console-main">
        <header className="console-topbar">
          <button
            type="button"
            className="lg:hidden w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>

          <div className="min-w-0 flex-1">
            {title && <h1 className="text-lg font-extrabold m-0 truncate">{title}</h1>}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                className={`avatar-button ${menuOpen ? "is-open" : ""}`}
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <Avatar user={user} size="sm" />
                <span className="hidden sm:flex flex-col items-start leading-tight max-w-[9rem]">
                  <span className="text-sm font-bold truncate w-full text-left">
                    {user?.firstName || user?.fullName || "Account"}
                  </span>
                  <span className="text-xs text-muted capitalize truncate w-full text-left">{user?.role}</span>
                </span>
              </button>
              {menuOpen && (
                <div className="menu" role="menu">
                  <div className="px-3 py-2">
                    <div className="font-bold truncate">{user?.fullName}</div>
                    <div className="text-muted text-xs truncate">{user?.email}</div>
                  </div>
                  <div className="menu-divider" />
                  <NavLink to={profilePath} onClick={() => setMenuOpen(false)} role="menuitem">
                    Profile &amp; password
                  </NavLink>
                  <div className="menu-divider" />
                  <button type="button" onClick={handleLogout} role="menuitem">Log out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="console-body">
          {(subtitle || actions) && (
            <div className="page-header mb-5">
              <p className="text-muted m-0">{subtitle}</p>
              {actions && <div className="header-actions">{actions}</div>}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
