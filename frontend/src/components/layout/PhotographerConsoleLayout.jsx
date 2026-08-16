import ConsoleLayout from "./ConsoleLayout.jsx";
import { usePhotographerAuth } from "../../context/PhotographerAuthContext.jsx";

const NAV_GROUPS = [
  {
    label: "Work",
    items: [
      {
        to: "/photographer/dashboard",
        end: true,
        label: "Dashboard",
        icon: <path d="M4 13h6V4H4v9Zm10 7h6V4h-6v16ZM4 20h6v-5H4v5Z" strokeLinecap="round" strokeLinejoin="round" />,
      },
      {
        to: "/photographer/events",
        end: true,
        label: "My events",
        icon: <path d="M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" strokeLinecap="round" strokeLinejoin="round" />,
      },
      {
        to: "/photographer/profile",
        label: "Profile",
        icon: <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" strokeLinecap="round" strokeLinejoin="round" />,
      },
    ],
  },
];

export default function PhotographerConsoleLayout(props) {
  return (
    <ConsoleLayout
      brandLabel="Photographer"
      navGroups={NAV_GROUPS}
      useAuth={usePhotographerAuth}
      loginPath="/photographer/login"
      profilePath="/photographer/profile"
      {...props}
    />
  );
}
