import rateLimit from "express-rate-limit";

// Matches the { error: { code, message } } shape used by the controllers.
const limitHandler = (code, message) => (req, res) =>
  res.status(429).json({ error: { code, message } });

// Brute-force protection on credential endpoints. Deliberately generous enough
// that a live demo with repeated logins will not trip it.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler(
    "TOO_MANY_ATTEMPTS",
    "Too many authentication attempts. Please try again in a few minutes."
  ),
});

// Check-in is staff-only but sits on the door at a live event, so it needs a
// higher ceiling than auth while still blocking code-guessing at scale.
export const checkInLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler(
    "TOO_MANY_ATTEMPTS",
    "Too many check-in attempts. Please slow down and try again shortly."
  ),
});

// The public contact form has no auth to lean on, so it gets its own tight
// limit against being used to spam an inbox.
export const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler(
    "TOO_MANY_ATTEMPTS",
    "Too many messages sent. Please try again in a few minutes."
  ),
});
