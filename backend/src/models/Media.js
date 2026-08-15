import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["image", "video"], required: true },
  url: { type: String, required: true },
  thumbnailUrl: { type: String, required: true },
  publicId: { type: String, required: true },
  caption: { type: String, default: "" },
  width: { type: Number },
  height: { type: Number },
  createdAt: { type: Date, default: Date.now },
});

mediaSchema.index({ eventId: 1, createdAt: -1 });

export default mongoose.model("Media", mediaSchema);
