import jwt from "jsonwebtoken";

const formatError = (code, message) => ({ error: { code, message } });

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json(formatError("AUTH_REQUIRED", "Authorization token missing"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      userId: decoded.sub,
      role: decoded.role,
      email: decoded.email,
    };
    return next();
  } catch (err) {
    return res.status(401).json(formatError("INVALID_TOKEN", "Invalid or expired token"));
  }
}

export default requireAuth;
