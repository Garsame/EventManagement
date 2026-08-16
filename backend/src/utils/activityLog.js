import ActivityLog from "../models/ActivityLog.js";

/**
 * Records one line in the admin activity feed. Never throws - a logging
 * failure must not break the action it is describing, so any error here is
 * swallowed after a console warning.
 *
 * `actor` is normally req.user (the JWT payload: { userId, role, email }).
 * Email is used as the label rather than fetching fullName, since every
 * write path already has req.user for free and an extra lookup per action
 * just to log it is not worth the cost.
 */
export const logActivity = async ({ actor, action, summary, targetType = "", targetId = null, targetLabel = "" }) => {
  try {
    await ActivityLog.create({
      actorId: actor?.userId || null,
      actorLabel: actor?.email || "System",
      actorRole: actor?.role || "",
      action,
      summary,
      targetType,
      targetId,
      targetLabel,
    });
  } catch (err) {
    console.warn("Could not write activity log entry:", err.message);
  }
};

export default logActivity;
