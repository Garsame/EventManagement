import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema({
  // Denormalized actor identity, so the log still reads correctly even if
  // the account that did something is later edited or deleted.
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  actorLabel: { type: String, default: "System" },
  actorRole: { type: String, default: "" },

  action: { type: String, required: true },
  summary: { type: String, required: true },

  targetType: { type: String, default: "" },
  targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
  targetLabel: { type: String, default: "" },

  createdAt: { type: Date, default: Date.now },
});

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });

export const toActivityDTO = (a) => ({
  id: a._id,
  actorLabel: a.actorLabel,
  actorRole: a.actorRole,
  action: a.action,
  summary: a.summary,
  targetType: a.targetType,
  targetId: a.targetId,
  targetLabel: a.targetLabel,
  createdAt: a.createdAt,
});

export default mongoose.model("ActivityLog", activityLogSchema);
