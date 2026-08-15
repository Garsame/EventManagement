const formatError = (code, message) => ({ error: { code, message } });

export default function requireRole(...roles) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json(formatError("AUTH_REQUIRED", "Authentication required"));
    }
    if (!roles.includes(user.role)) {
      return res.status(403).json(formatError("FORBIDDEN", "Insufficient permissions"));
    }
    return next();
  };
}
