import { Link, useLocation } from "react-router-dom";

const links = [
  {
    to: "/admin/dashboard",
    label: "Dashboard",
    icon: <path d="M4 13h6V4H4v9Zm10 7h6V4h-6v16ZM4 20h6v-5H4v5Z" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    to: "/admin/checkin",
    label: "Check-in",
    icon: <path d="M4 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />,
  },
];

export default function AdminSidebar() {
  const { pathname } = useLocation();

  return (
    <div className="flex flex-col h-full">
      <Link to="/" className="nav-brand mb-8 px-1">
        <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <circle cx="16" cy="16" r="15" stroke="#4f46e5" strokeWidth="2" />
          <circle cx="16" cy="16" r="4.5" fill="#4f46e5" />
        </svg>
        <span>EventMedia</span>
      </Link>

      <nav className="stack flex-1">
        {links.map((link) => {
          const active = pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg font-medium transition-colors ${
                active ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {link.icon}
              </svg>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <Link to="/" className="text-sm text-muted hover:text-slate-900 px-3 py-2">
        ← Back to site
      </Link>
    </div>
  );
}
