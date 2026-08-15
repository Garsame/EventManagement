const SIZES = { sm: "avatar-sm", md: "avatar-md", lg: "avatar-lg" };

/**
 * Shows the uploaded image when there is one, otherwise the user's initials.
 * Falls back to a dash so the circle never renders empty.
 */
export default function Avatar({ user, size = "sm", className = "" }) {
  const initials = user?.initials || "";
  const label = user?.fullName || user?.email || "Account";

  return (
    <span className={`avatar ${SIZES[size] || SIZES.sm} ${className}`} title={label}>
      {user?.avatarUrl ? (
        <img src={user.avatarUrl} alt={label} />
      ) : (
        <span aria-hidden="true">{initials || "–"}</span>
      )}
    </span>
  );
}
