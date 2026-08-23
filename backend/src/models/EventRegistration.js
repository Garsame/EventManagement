import mongoose from "mongoose";

const registrationSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  registeredAt: { type: Date, default: Date.now },

  // An admin decides who actually attends. A place is only a request until
  // then, which is why the codes below are issued on approval rather than
  // here - an unapproved guest has nothing to present at the door.
  approvalStatus: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  decidedAt: { type: Date },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  // Optional note from the admin, included in the email either way.
  decisionNote: { type: String, default: "" },

  // Issued at approval, cleared on rejection. Absent means "nothing to scan".
  registrationCode: { type: String },
  qrToken: { type: String },

  attended: { type: Boolean, default: false },
  checkedInAt: { type: Date },
  checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  // Only set for registrations against a premium event - the plan chosen is
  // snapshotted here (name/price/currency) rather than looked up live, so it
  // stays accurate even if the event's plans are edited afterwards.
  planId: { type: mongoose.Schema.Types.ObjectId },
  planName: { type: String },
  amountDue: { type: Number },
  currency: { type: String },
  paymentStatus: { type: String, enum: ["pending", "paid", "refunded"], default: "pending" },
  // "manual" today (admin confirms in the console); a future gateway
  // integration can set its own value here without a schema change.
  paymentMethod: { type: String, default: "manual" },
  paymentReference: { type: String, default: "" },
  paymentConfirmedAt: { type: Date },
  paymentConfirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

registrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });
// Sparse: unapproved registrations hold no code, and a non-sparse index would
// treat every one of those missing values as the same key.
registrationSchema.index({ registrationCode: 1 }, { sparse: true });
registrationSchema.index({ qrToken: 1 }, { sparse: true });
registrationSchema.index({ eventId: 1, approvalStatus: 1 });

/**
 * Whether this registration may be scanned at the door right now. Approval is
 * the gate; `attended` is what spends the code, so a used one never passes a
 * second time.
 */
export const canCheckIn = (registration) =>
  !!registration && registration.approvalStatus === "approved" && registration.attended !== true;

export default mongoose.model("EventRegistration", registrationSchema);
