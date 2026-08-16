import Message, { toMessageDTO } from "../models/Message.js";
import { sendContactNotificationEmail, sendContactReplyEmail } from "../config/mailer.js";
import { logActivity } from "../utils/activityLog.js";

const formatError = (code, message) => ({ error: { code, message } });

const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email);

/** Public: anyone can send a message, no account required. */
export const submitMessage = async (req, res, next) => {
  try {
    const { name, subject, message } = req.body || {};
    const email = String(req.body?.email || "").toLowerCase().trim();

    if (!name || !email || !message) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "name, email, and message are required"));
    }
    if (!isValidEmail(email)) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "Invalid email format"));
    }
    if (String(message).length > 4000) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "Message is too long"));
    }

    const doc = await Message.create({
      name: String(name).trim(),
      email,
      subject: subject ? String(subject).trim() : "",
      body: String(message).trim(),
    });

    let delivered = false;
    try {
      const result = await sendContactNotificationEmail({
        name: doc.name,
        email: doc.email,
        subject: doc.subject,
        body: doc.body,
      });
      delivered = result.delivered;
    } catch (err) {
      // The message is already saved and visible in the admin console even
      // if the notification email fails to send.
      console.warn("Could not send contact notification email:", err.message);
    }

    return res.status(201).json({ message: toMessageDTO(doc), notified: delivered });
  } catch (err) {
    return next(err);
  }
};

/** Admin: every message, newest first. */
export const listMessages = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status === "open" || status === "replied") filter.status = status;

    const messages = await Message.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({
      messages: messages.map(toMessageDTO),
      counts: {
        total: await Message.countDocuments({}),
        open: await Message.countDocuments({ status: "open" }),
      },
    });
  } catch (err) {
    return next(err);
  }
};

/** Admin: reply to one message. The reply is emailed to the original sender. */
export const replyToMessage = async (req, res, next) => {
  try {
    const { reply } = req.body || {};
    if (!reply || !String(reply).trim()) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "reply is required"));
    }

    const doc = await Message.findById(req.params.messageId);
    if (!doc) return res.status(404).json(formatError("NOT_FOUND", "Message not found"));

    const result = await sendContactReplyEmail({
      to: doc.email,
      name: doc.name,
      originalSubject: doc.subject,
      originalBody: doc.body,
      reply: String(reply).trim(),
    });

    doc.status = "replied";
    doc.reply = { body: String(reply).trim(), repliedAt: new Date(), repliedBy: req.user.userId };
    await doc.save();

    await logActivity({
      actor: req.user,
      action: "message.replied",
      summary: `Replied to ${doc.name} (${doc.email})`,
      targetType: "message",
      targetId: doc._id,
      targetLabel: doc.subject || doc.name,
    });

    return res.json({ message: toMessageDTO(doc), delivered: result.delivered });
  } catch (err) {
    return next(err);
  }
};

export default { submitMessage, listMessages, replyToMessage };
