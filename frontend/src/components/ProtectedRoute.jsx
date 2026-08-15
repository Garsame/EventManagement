import { Navigate, useLocation } from "react-router-dom";
import { getAccessToken } from "../api/tokenStore.js";
import { useAuth } from "../context/AuthContext.jsx";
import PublicLayout from "./layout/PublicLayout.jsx";
import Card from "./ui/Card.jsx";
import Alert from "./ui/Alert.jsx";
import Loading from "./ui/Loading.jsx";

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const hasToken = !!getAccessToken();

  if (!hasToken) {
    // Remember where they were headed so login can send them back.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // A token exists but the profile is still in flight; role checks would be
  // wrong if evaluated now.
  if (loading && !user) {
    return (
      <PublicLayout>
        <div className="shell-wrap page">
          <Loading />
        </div>
      </PublicLayout>
    );
  }

  if (roles && roles.length > 0 && (!user || !roles.includes(user.role))) {
    return (
      <PublicLayout>
        <div className="shell-wrap page">
          <Card>
            <Alert variant="error">Access restricted. You don't have permission to view this page.</Alert>
          </Card>
        </div>
      </PublicLayout>
    );
  }

  return children;
}
