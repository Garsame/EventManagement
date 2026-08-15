import { useLocation } from "react-router-dom";
import PublicLayout from "./PublicLayout.jsx";
import DashboardLayout from "./DashboardLayout.jsx";

/** True while anywhere under /dashboard. */
export const useInDashboard = () => useLocation().pathname.startsWith("/dashboard");

/**
 * Base path for event links. Inside the dashboard we stay in the dashboard
 * rather than throwing the user back out to the public event pages.
 */
export const useEventBase = () => (useInDashboard() ? "/dashboard/events" : "/events");

/**
 * Renders a page inside whichever shell matches the current section, so the
 * same event / gallery / registration page works in both places.
 */
export default function SectionLayout({ title, subtitle, actions, children }) {
  const inDashboard = useInDashboard();

  if (inDashboard) {
    return (
      <DashboardLayout title={title} subtitle={subtitle} actions={actions}>
        {children}
      </DashboardLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="shell-wrap page">
        {title && (
          <div className="page-header mb-6">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold m-0">{title}</h1>
              {subtitle && <p className="text-muted m-0 mt-1">{subtitle}</p>}
            </div>
            {actions && <div className="header-actions">{actions}</div>}
          </div>
        )}
        {children}
      </div>
    </PublicLayout>
  );
}
