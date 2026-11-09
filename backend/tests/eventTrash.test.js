import test, { before, after, describe } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";

dotenv.config();

process.env.MEDIA_STORAGE = "local";
process.env.SMTP_HOST = "";
process.env.SMTP_USER = "";
process.env.SMTP_PASSWORD = "";
process.env.MANAGEMENT_EMAIL = "";
process.env.DISABLE_RATE_LIMIT = "true";

// Its own scratch database. `node --test` runs test files in separate processes
// at the same time, so a second suite sharing event_media_test would drop the
// fixtures out from under the first one.
process.env.MONGO_DB_NAME = "event_media_trash_test";

const { default: request } = await import("supertest");
const { default: mongoose } = await import("mongoose");
const { default: app } = await import("../src/app.js");
const { default: connectDB } = await import("../src/config/db.js");
const { default: User } = await import("../src/models/User.js");
const { default: Event, TRASH_RETENTION_DAYS } = await import("../src/models/Event.js");
const { default: EventRegistration } = await import("../src/models/EventRegistration.js");
const { default: Media } = await import("../src/models/Media.js");
const { default: ActivityLog } = await import("../src/models/ActivityLog.js");
const { signAccessToken } = await import("../src/utils/token.js");

const COMPLETE_PROFILE = {
  phone: "+252 61 000 0000",
  location: "Mogadishu, Somalia",
  institution: "Test University",
  educationLevel: "bachelors",
  sex: "prefer-not-to-say",
};

const makeUser = async (role, email) => {
  const user = await User.create({
    fullName: `Test ${role}`,
    email,
    passwordHash: "not-used-in-tests",
    role,
    refreshTokens: [],
    ...COMPLETE_PROFILE,
  });
  return { user, token: signAccessToken({ userId: user._id.toString(), role, email }) };
};

const makeEvent = (title, overrides = {}) =>
  Event.create({
    title,
    description: "Fixture",
    location: "Test Hall",
    startDateTime: new Date("2026-12-01T18:00:00Z"),
    endDateTime: new Date("2026-12-01T21:00:00Z"),
    visibility: "public",
    published: true,
    status: "registration-open",
    checkInOpen: true,
    createdBy: admin.user._id,
    photographers: [photographer.user._id],
    ...overrides,
  });

const asAdmin = (req) => req.set("Authorization", `Bearer ${admin.token}`);
const asAttendee = (req) => req.set("Authorization", `Bearer ${attendee.token}`);

/** Reads an event the way the database holds it, ignoring the trash filter. */
const readRaw = (eventId) => Event.findById(eventId).setOptions({ includeDeleted: true }).lean();

let admin;
let photographer;
let attendee;
let event;
let registration;

before(async () => {
  await connectDB();
  assert.equal(
    mongoose.connection.db.databaseName,
    "event_media_trash_test",
    "refusing to run against a database other than event_media_trash_test"
  );
  await Promise.all([
    User.deleteMany({}),
    Event.deleteMany({}),
    EventRegistration.deleteMany({}),
    Media.deleteMany({}),
    ActivityLog.deleteMany({}),
  ]);

  admin = await makeUser("admin", "admin@test.local");
  photographer = await makeUser("photographer", "photographer@test.local");
  attendee = await makeUser("attendee", "attendee@test.local");

  event = await makeEvent("Trash Test Event");

  await Media.create([
    { eventId: event._id, uploadedBy: photographer.user._id, type: "image", url: "/uploads/a.jpg", thumbnailUrl: "/uploads/a.jpg", publicId: "a.jpg" },
    { eventId: event._id, uploadedBy: photographer.user._id, type: "image", url: "/uploads/b.jpg", thumbnailUrl: "/uploads/b.jpg", publicId: "b.jpg" },
  ]);

  // A guest who has already been through the whole flow, so every surface the
  // trash is meant to close has something real behind it.
  registration = await EventRegistration.create({
    eventId: event._id,
    userId: attendee.user._id,
    approvalStatus: "approved",
    registrationCode: "EVT-ABC123",
    qrToken: "token-for-trash-test",
    attended: true,
    checkedInAt: new Date(),
    checkedInBy: admin.user._id,
  });
});

after(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});

describe("moving an event to the trash", () => {
  test("keeps the media rows and registrations in the database", async () => {
    const res = await asAdmin(request(app).delete(`/api/admin/events/${event._id}`)).expect(200);

    assert.equal(res.body.trashed, true);
    assert.deepEqual(res.body.retained, { media: 2, registrations: 1 });

    const raw = await readRaw(event._id);
    assert.ok(raw.deletedAt, "expected deletedAt to be set");
    assert.equal(await Media.countDocuments({ eventId: event._id }), 2);
    assert.equal(await EventRegistration.countDocuments({ eventId: event._id }), 1);
  });

  test("records it in the activity log", async () => {
    const entry = await ActivityLog.findOne({ action: "event.trashed", targetId: event._id }).lean();
    assert.ok(entry, "expected an event.trashed activity entry");
    assert.match(entry.summary, /Trash Test Event/);
  });

  test("removes it from the public list", async () => {
    const res = await request(app).get("/api/events/public").expect(200);
    assert.deepEqual(res.body.map((e) => e.title), []);
  });

  test("returns 404 on the details page", async () => {
    await request(app).get(`/api/events/${event._id}`).expect(404);
  });

  test("refuses a new registration", async () => {
    const res = await asAttendee(request(app).post(`/api/events/${event._id}/register`)).expect(404);
    assert.equal(res.body.error.code, "NOT_FOUND");
  });

  test("closes the gallery to a guest who already attended", async () => {
    await asAttendee(request(app).get(`/api/events/${event._id}/gallery`)).expect(404);
  });

  test("refuses check-in at the door", async () => {
    await asAdmin(request(app).post(`/api/events/${event._id}/checkin`).send({ registrationCode: "EVT-ABC123" })).expect(404);
  });

  test("drops it from the admin event table", async () => {
    const res = await asAdmin(request(app).get("/api/admin/events")).expect(200);
    assert.deepEqual(res.body.events.map((e) => e.title), []);
  });

  test("drops it from the photographer console", async () => {
    const res = await request(app)
      .get("/api/photographer/dashboard")
      .set("Authorization", `Bearer ${photographer.token}`)
      .expect(200);
    assert.equal(res.body.events.length, 0);
  });

  test("hides the guest's own registration while it is trashed", async () => {
    const res = await asAttendee(request(app).get("/api/users/me/registrations")).expect(200);
    assert.equal(res.body.registrations.length, 0);
    assert.equal(res.body.stats.total, 0);
  });

  test("refuses to trash it a second time", async () => {
    const res = await asAdmin(request(app).delete(`/api/admin/events/${event._id}`)).expect(409);
    assert.equal(res.body.error.code, "ALREADY_TRASHED");
  });

  test("lists it in the trash with what is still attached", async () => {
    const res = await asAdmin(request(app).get("/api/admin/events/trash")).expect(200);
    assert.equal(res.body.retentionDays, TRASH_RETENTION_DAYS);
    assert.equal(res.body.events.length, 1);
    const row = res.body.events[0];
    assert.equal(row.title, "Trash Test Event");
    assert.equal(row.mediaCount, 2);
    assert.equal(row.registrationCount, 1);
    assert.equal(row.daysLeft, TRASH_RETENTION_DAYS);
    assert.equal(new Date(row.autoDeleteAt) > new Date(), true);
  });

  test("keeps the trash admin-only", async () => {
    await request(app)
      .get("/api/admin/events/trash")
      .set("Authorization", `Bearer ${photographer.token}`)
      .expect(403);
    await request(app).delete(`/api/admin/events/${event._id}`).expect(401);
  });
});

describe("restoring an event", () => {
  test("puts it back with its media and registrations intact", async () => {
    const res = await asAdmin(request(app).patch(`/api/admin/events/${event._id}/restore`)).expect(200);
    assert.equal(res.body.event.title, "Trash Test Event");

    const raw = await readRaw(event._id);
    assert.equal(raw.deletedAt, null);

    const publicList = await request(app).get("/api/events/public").expect(200);
    assert.deepEqual(publicList.body.map((e) => e.title), ["Trash Test Event"]);

    assert.equal(await Media.countDocuments({ eventId: event._id }), 2);
    assert.equal(await EventRegistration.countDocuments({ eventId: event._id }), 1);

    const guestList = await asAttendee(request(app).get("/api/users/me/registrations")).expect(200);
    assert.equal(guestList.body.registrations.length, 1);
  });

  test("logs the restore", async () => {
    const entry = await ActivityLog.findOne({ action: "event.restored", targetId: event._id }).lean();
    assert.ok(entry, "expected an event.restored activity entry");
  });

  test("refuses to restore an event that is not in the trash", async () => {
    const res = await asAdmin(request(app).patch(`/api/admin/events/${event._id}/restore`)).expect(409);
    assert.equal(res.body.error.code, "NOT_IN_TRASH");
  });

  test("leaves a trashed event out of the public list again", async () => {
    await asAdmin(request(app).delete(`/api/admin/events/${event._id}`)).expect(200);
    const res = await request(app).get("/api/events/public").expect(200);
    assert.equal(res.body.length, 0);
    await asAdmin(request(app).patch(`/api/admin/events/${event._id}/restore`)).expect(200);
  });
});

describe("permanent deletion", () => {
  test("destroys the event, its media rows and its registrations", async () => {
    const doomed = await makeEvent("Doomed Event");
    await Media.create({
      eventId: doomed._id,
      uploadedBy: photographer.user._id,
      type: "image",
      url: "/uploads/c.jpg",
      thumbnailUrl: "/uploads/c.jpg",
      publicId: "c.jpg",
    });
    await EventRegistration.create({ eventId: doomed._id, userId: attendee.user._id, approvalStatus: "approved" });

    const res = await asAdmin(request(app).delete(`/api/admin/events/${doomed._id}/permanent`)).expect(200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.deleted, { media: 1, registrations: 1 });

    assert.equal(await readRaw(doomed._id), null);
    assert.equal(await Media.countDocuments({ eventId: doomed._id }), 0);
    assert.equal(await EventRegistration.countDocuments({ eventId: doomed._id }), 0);
  });

  test("can be used straight from the live list, without trashing first", async () => {
    const doomed = await makeEvent("Purged Without Trash");
    await asAdmin(request(app).delete(`/api/admin/events/${doomed._id}/permanent`)).expect(200);
    assert.equal(await readRaw(doomed._id), null);
  });

  test("offers nothing to restore afterwards", async () => {
    const res = await asAdmin(request(app).patch("/api/admin/events/000000000000000000000000/restore")).expect(404);
    assert.equal(res.body.error.code, "NOT_FOUND");
  });

  test("refuses a photographer purging an event", async () => {
    const live = await makeEvent("Photographer Cannot Purge");
    await request(app)
      .delete(`/api/admin/events/${live._id}/permanent`)
      .set("Authorization", `Bearer ${photographer.token}`)
      .expect(403);
    await asAdmin(request(app).delete(`/api/admin/events/${live._id}/permanent`)).expect(200);
  });
});

describe("the retention window", () => {
  test("destroys trashed events once the window has closed", async () => {
    const stale = await makeEvent("Expired In Trash");
    const thirtyOneDaysAgo = new Date(Date.now() - (TRASH_RETENTION_DAYS + 1) * 86400000);
    // Straight to the collection: this is setting up a state the app itself
    // cannot produce yet, and it must not go through the trash filter.
    await Event.collection.updateOne({ _id: stale._id }, { $set: { deletedAt: thirtyOneDaysAgo } });

    const res = await asAdmin(request(app).get("/api/admin/events/trash")).expect(200);
    assert.equal(
      res.body.events.some((e) => e.title === "Expired In Trash"),
      false,
      "expected the expired event to be swept out of the trash"
    );
    assert.equal(await readRaw(stale._id), null, "expected the expired event to be gone from the database");
    assert.ok(
      await ActivityLog.findOne({ action: "event.expired", targetId: stale._id }).lean(),
      "expected the sweep to be logged"
    );
  });

  test("leaves an event that still has time left", async () => {
    const fresh = await makeEvent("Still In Time");
    await asAdmin(request(app).delete(`/api/admin/events/${fresh._id}`)).expect(200);

    const res = await asAdmin(request(app).get("/api/admin/events/trash")).expect(200);
    const row = res.body.events.find((e) => e.title === "Still In Time");
    assert.ok(row, "expected the recently trashed event to still be restorable");
    assert.equal(row.daysLeft, TRASH_RETENTION_DAYS);

    await asAdmin(request(app).delete(`/api/admin/events/${fresh._id}/permanent`)).expect(200);
  });
});
