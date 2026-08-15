import { NavLink } from "react-router-dom";
import PublicLayout from "./PublicLayout.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import Avatar from "../Avatar.jsx";

const NAV = [
  {
    to: "/dashboard",
    end: true,
    label: "Overview",
    icon: <path d="M4 13h6V4H4v9Zm10 7h6V4h-6v16ZM4 20h6v-5H4v5Z" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    to: "/dashboard/events",
    label: "Your events",
    icon: <path d="M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    to: "/dashboard/profile",
    label: "Profile",
    icon: <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" strokeLinecap="round" strokeLinejoin="round" />,
  },
];

/**
 * Dashboard shell: fixed left rail, content on the right. Both live inside the
 * shared .container so they line up with the navbar logo rather than running
 * to the edge of the window.
 */
export default function DashboardLayout({ title, subtitle, actions, children }) {
  const { user } = useAuth();

  return (
    <PublicLayout>
      <div className="shell-wrap page">
        <div className="dash-shell">
          <aside className="dash-rail">
            <div className="dash-rail-user">
              <Avatar user={user} size="md" />
              <div className="min-w-0">
                <div className="font-bold truncate">{user?.firstName || "Account"}</div>
                <div className="text-muted text-xs truncate">{user?.email}</div>
              </div>
            </div>

            <nav className="dash-rail-nav">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `dash-link ${isActive ? "is-active" : ""}`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    {item.icon}
                  </svg>
                  <span className="truncate">{item.label}</span>
                  {item.to === "/dashboard/profile" && !user?.profileComplete && (
                    <span className="dash-dot" title="Profile incomplete" />
                  )}
                </NavLink>
              ))}
            </nav>
          </aside>

          <section className="dash-main">
            {(title || actions) && (
              <div className="page-header mb-5">
                <div className="min-w-0">
                  <h1 className="text-2xl font-extrabold m-0 truncate">{title}</h1>
                  {subtitle && <p className="text-muted m-0 mt-1">{subtitle}</p>}
                </div>
                {actions && <div className="header-actions">{actions}</div>}
              </div>
            )}

            {!user?.profileComplete && (
              <div className="alert alert-warn mb-5">
                Your profile is incomplete, so you cannot register for events yet.{" "}
                <NavLink to="/dashboard/profile" className="underline font-bold">
                  Complete it now
                </NavLink>
                .
              </div>
            )}

            {children}
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
