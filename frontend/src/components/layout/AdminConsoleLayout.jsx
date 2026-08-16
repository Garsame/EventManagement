import ConsoleLayout from "./ConsoleLayout.jsx";
import { useAdminAuth } from "../../context/AdminAuthContext.jsx";

const ICONS = {
  dashboard: <path d="M4 13h6V4H4v9Zm10 7h6V4h-6v16ZM4 20h6v-5H4v5Z" strokeLinecap="round" strokeLinejoin="round" />,
  events: <path d="M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" strokeLinecap="round" strokeLinejoin="round" />,
  checkin: <path d="M4 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />,
  attendee: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />,
  camera: <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" strokeLinecap="round" strokeLinejoin="round" />,
  shield: <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3Z" strokeLinecap="round" strokeLinejoin="round" />,
  messages: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" strokeLinecap="round" strokeLinejoin="round" />,
  profile: <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" strokeLinecap="round" strokeLinejoin="round" />,
  reports: <path d="M9 17V9m3 8V5m3 12v-6M5 21h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2Z" strokeLinecap="round" strokeLinejoin="round" />,
  premium: <path d="M12 2.5l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6-4.4-4.2 6-.8Z" strokeLinecap="round" strokeLinejoin="round" />,
};

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { to: "/maamul/dashboard", end: true, label: "Dashboard", icon: ICONS.dashboard },
      { to: "/maamul/profile", label: "Profile", icon: ICONS.profile },
    ],
  },
  {
    label: "Content",
    items: [
      { to: "/maamul/events", label: "Events", icon: ICONS.events },
      { to: "/maamul/premium-events", label: "Premium Events", icon: ICONS.premium },
      { to: "/maamul/checkin", label: "Check-in", icon: ICONS.checkin },
    ],
  },
  {
    label: "Support",
    items: [
      { to: "/maamul/messages", label: "Messages", icon: ICONS.messages },
      { to: "/maamul/reports", label: "Reports", icon: ICONS.reports },
    ],
  },
  {
    label: "Users",
    items: [
      { to: "/maamul/users/attendees", label: "Attendees", icon: ICONS.attendee },
      { to: "/maamul/users/photographers", label: "Photographers", icon: ICONS.camera },
      { to: "/maamul/users/admins", label: "Admins", icon: ICONS.shield },
    ],
  },
];

export default function AdminConsoleLayout(props) {
  return (
    <ConsoleLayout
      brandLabel="Admin"
      navGroups={NAV_GROUPS}
      useAuth={useAdminAuth}
      loginPath="/maamul/login"
      profilePath="/maamul/profile"
      {...props}
    />
  );
}
