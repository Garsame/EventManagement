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
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Event", eventSchema);
