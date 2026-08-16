import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  location: { type: String, default: "" },
  startDateTime: { type: Date, required: true },
  endDateTime: { type: Date, required: true },
  visibility: { type: String, enum: ["public", "private"], default: "public" },
  published: { type: Boolean, default: true },
  // Lifecycle, separate from visibility. Registration only opens in one stage.
  status: {
    type: String,
    enum: ["draft", "registration-open", "completed"],
    default: "draft",
  },
  // The door, not the guest list: an admin flips this on the day of the
  // event to let check-in actually happen. Independent of `status` so
  // registration can stay open before/after the check-in window.
  checkInOpen: { type: Boolean, default: false },
  coverImageUrl: { type: String, default: "" },
  coverImagePublicId: { type: String, default: "" },
  // Premium events require a paid plan to register. isPremium is set only at
  // creation (the two admin console pages never cross-send it), plans stay
  // editable afterwards but a plan already chosen by a registrant is
  // snapshotted onto the registration, so editing/removing a plan here never
  // retroactively changes what someone already registered and paid for.
  isPremium: { type: Boolean, default: false },
  currency: { type: String, default: "USD", trim: true },
  plans: [{
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, default: "" },
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  // Photographers an admin has put on this event. Only these (and admins) may
  // upload or delete its media.
  photographers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now },
});

export const EVENT_STATUSES = ["draft", "registration-open", "completed"];

/** A guest may only take a place while the event is published and open. */
export const canRegisterFor = (event) =>
  !!event && event.published === true && event.status === "registration-open";

/** Admins work every event; photographers only the ones they are assigned to. */
export const canManageEventMedia = (event, user) => {
  if (!event || !user) return false;
  if (user.role === "admin") return true;
  if (user.role !== "photographer") return false;
  return (event.photographers || []).some((id) => String(id) === String(user.userId || user._id));
};

export default mongoose.model("Event", eventSchema);
