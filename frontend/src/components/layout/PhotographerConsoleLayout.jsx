import ConsoleLayout from "./ConsoleLayout.jsx";
import { usePhotographerAuth } from "../../context/PhotographerAuthContext.jsx";

const NAV_GROUPS = [
  {
    label: "Work",
    items: [
      {
        to: "/photographer/events",
        end: true,
        label: "My events",
        icon: <path d="M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" strokeLinecap="round" strokeLinejoin="round" />,
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
