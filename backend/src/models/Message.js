import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  subject: { type: String, trim: true, default: "" },
  body: { type: String, required: true, trim: true },
  status: { type: String, enum: ["open", "replied"], default: "open" },
  reply: {
    body: { type: String, default: "" },
    repliedAt: { type: Date, default: null },
    repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  createdAt: { type: Date, default: Date.now },
});

messageSchema.index({ status: 1, createdAt: -1 });

export const toMessageDTO = (m) => ({
  id: m._id,
  name: m.name,
  email: m.email,
  subject: m.subject || "",
  body: m.body,
  status: m.status,
  reply: m.reply?.body
    ? { body: m.reply.body, repliedAt: m.reply.repliedAt, repliedBy: m.reply.repliedBy }
    : null,
  createdAt: m.createdAt,
});

export default mongoose.model("Message", messageSchema);
