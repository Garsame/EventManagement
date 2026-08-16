import mongoose from "mongoose";
import Event from "../models/Event.js";
import Media from "../models/Media.js";

/**
 * A photographer's own activity across every event they are assigned to:
 * how much they have shot, where, and most recently - the numbers the
 * per-event "Manage media" screen never rolls up on its own.
 */
export const getDashboard = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const uploaderId = new mongoose.Types.ObjectId(userId);

    const events = await Event.find({ photographers: userId })
      .select("title status startDateTime endDateTime location")
      .sort({ startDateTime: -1 })
      .lean();

    const [byEvent, byType, recent] = await Promise.all([
      Media.aggregate([
        { $match: { uploadedBy: uploaderId } },
        { $group: { _id: "$eventId", count: { $sum: 1 }, lastUpload: { $max: "$createdAt" } } },
      ]),
      Media.aggregate([
        { $match: { uploadedBy: uploaderId } },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
      Media.find({ uploadedBy: userId })
        .sort({ createdAt: -1 })
        .limit(8)
        .populate("eventId", "title")
        .lean(),
    ]);

    const byEventMap = new Map(byEvent.map((r) => [String(r._id), r]));
    const typeCounts = { image: 0, video: 0 };
    byType.forEach((r) => { typeCounts[r._id] = r.count; });
    const mediaUploaded = typeCounts.image + typeCounts.video;

    const eventBreakdown = events.map((e) => ({
      id: e._id,
      title: e.title,
      status: e.status,
      startDateTime: e.startDateTime,
      location: e.location,
      mediaCount: byEventMap.get(String(e._id))?.count || 0,
      lastUpload: byEventMap.get(String(e._id))?.lastUpload || null,
    }));

    // The event this photographer has contributed the most media to - only
    // worth surfacing once they have actually uploaded something.
    const mostActiveEvent = eventBreakdown.reduce(
      (best, e) => (e.mediaCount > (best?.mediaCount || 0) ? e : best),
      null
    );

    const now = new Date();
    const upcomingEvents = events.filter((e) => new Date(e.endDateTime) >= now && e.status !== "draft").length;
    const completedEvents = events.filter((e) => e.status === "completed").length;

    return res.json({
      totals: {
        eventsAssigned: events.length,
        upcomingEvents,
        completedEvents,
        mediaUploaded,
        images: typeCounts.image,
        videos: typeCounts.video,
      },
      mostActiveEvent: mostActiveEvent && mostActiveEvent.mediaCount > 0
        ? { id: mostActiveEvent.id, title: mostActiveEvent.title, mediaCount: mostActiveEvent.mediaCount }
        : null,
      events: eventBreakdown,
      recentUploads: recent.map((m) => ({
        id: m._id,
        type: m.type,
        url: m.url,
        thumbnailUrl: m.thumbnailUrl,
        caption: m.caption,
        createdAt: m.createdAt,
        event: m.eventId ? { id: m.eventId._id, title: m.eventId.title } : null,
      })),
    });
  } catch (err) {
    return next(err);
  }
};

export default { getDashboard };
