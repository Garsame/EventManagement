import { Navigate } from "react-router-dom";

/**
 * Same idea as the public ProtectedRoute, but for an isolated realm (admin,
 * photographer): it reads that realm's own auth hook rather than the shared
 * public one, and sends an unauthenticated visitor to that realm's own door.
 */
export default function RealmProtectedRoute({ useAuth, loginPath, children }) {
  const { isAuthed, loading, user } = useAuth();

  if (loading && !user) return null;
  if (!isAuthed) return <Navigate to={loginPath} replace />;

  return children;
}
