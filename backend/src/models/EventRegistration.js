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
});

registrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });
registrationSchema.index({ registrationCode: 1 });
registrationSchema.index({ qrToken: 1 });

export default mongoose.model("EventRegistration", registrationSchema);
