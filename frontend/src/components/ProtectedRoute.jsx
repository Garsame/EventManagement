import { Navigate } from "react-router-dom";
import { getAccessToken } from "../api/tokenStore.js";
import Card from "./ui/Card.jsx";
import Alert from "./ui/Alert.jsx";

const parseUser = () => {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem("ems_user");
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (e) {
    return null;
  }
};

export default function ProtectedRoute({ children, roles }) {
  const isAuthed = !!getAccessToken();
  if (!isAuthed) {
    return <Navigate to="/login" replace />;
  }

  if (roles && roles.length > 0) {
    const user = parseUser();
    if (!user || !roles.includes(user.role)) {
      return (
        <div className="container page">
          <Card>
            <Alert variant="error">Access restricted. You don't have permission to view this page.</Alert>
          </Card>
        </div>
      );
    }
  }

  return children;
}
