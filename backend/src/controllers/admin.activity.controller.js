import ActivityLog, { toActivityDTO } from "../models/ActivityLog.js";

// A hard ceiling rather than open-ended pagination - this is a recent-activity
// feed for a small admin team, not a full audit export.
const MAX_LIMIT = 300;

export const listActivity = async (req, res, next) => {
  try {
    const { action, q } = req.query;
    const limit = Math.min(Number(req.query.limit) || 100, MAX_LIMIT);

    const filter = {};
    if (action) filter.action = action;
    if (q) {
      const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ summary: rx }, { actorLabel: rx }, { targetLabel: rx }];
    }

    const entries = await ActivityLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    const actions = await ActivityLog.distinct("action");

    return res.json({
      activity: entries.map(toActivityDTO),
      actions: actions.sort(),
    });
  } catch (err) {
    return next(err);
  }
};

export default { listActivity };
