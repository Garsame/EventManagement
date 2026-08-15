import { NavLink } from "react-router-dom";
import PublicLayout from "./PublicLayout.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import Avatar from "../Avatar.jsx";

const TABS = [
  { to: "/dashboard", end: true, label: "Overview" },
  { to: "/dashboard/events", label: "Your events" },
  { to: "/dashboard/profile", label: "Profile" },
];

/**
 * Wraps the dashboard in the same shell the public pages use, so the navbar,
 * footer and theme are shared rather than duplicated.
 */
export default function DashboardLayout({ title, subtitle, actions, children }) {
  const { user } = useAuth();

  return (
    <PublicLayout>
      <div className="container page">
        <div className="page-header mb-6">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar user={user} size="md" className="hidden sm:inline-flex" />
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold m-0 truncate">{title}</h1>
              {subtitle && <p className="text-muted m-0 mt-1">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="header-actions">{actions}</div>}
        </div>

        {!user?.profileComplete && (
          <div className="alert alert-warn mb-6">
            Your profile is incomplete, so you cannot register for events yet.{" "}
            <NavLink to="/dashboard/profile" className="underline font-bold">
              Complete it now
            </NavLink>
            .
          </div>
        )}

        <nav className="dash-tabs mb-6">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => `dash-tab ${isActive ? "is-active" : ""}`}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        {children}
      </div>
    </PublicLayout>
  );
}
