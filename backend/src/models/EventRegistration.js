import mongoose from "mongoose";

const registrationSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  registeredAt: { type: Date, default: Date.now },
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
registrationSchema.index({ registrationCode: 1 });
registrationSchema.index({ qrToken: 1 });

export default mongoose.model("EventRegistration", registrationSchema);
