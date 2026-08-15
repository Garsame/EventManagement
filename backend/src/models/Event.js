import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  location: { type: String, default: "" },
  startDateTime: { type: Date, required: true },
  endDateTime: { type: Date, required: true },
  visibility: { type: String, enum: ["public", "private"], default: "public" },
  published: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  // Photographers an admin has put on this event. Only these (and admins) may
  // upload or delete its media.
  photographers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now },
});

/** Admins work every event; photographers only the ones they are assigned to. */
export const canManageEventMedia = (event, user) => {
  if (!event || !user) return false;
  if (user.role === "admin") return true;
  if (user.role !== "photographer") return false;
  return (event.photographers || []).some((id) => String(id) === String(user.userId || user._id));
};

export default mongoose.model("Event", eventSchema);
