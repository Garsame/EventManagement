import test, { before, after, describe } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";

dotenv.config();

// Point at a throwaway database before anything opens a connection. config/db.js
// honours MONGO_DB_NAME, so the developer's real data is never touched.
process.env.MONGO_DB_NAME = "event_media_test";

// app.js pulls in config/cloudinary.js, which reads credentials at import time,
// so it has to be imported after the environment above is in place.
const { default: request } = await import("supertest");
const { default: mongoose } = await import("mongoose");
const { default: app } = await import("../src/app.js");
const { default: connectDB } = await import("../src/config/db.js");
const { default: User } = await import("../src/models/User.js");
const { default: Event } = await import("../src/models/Event.js");
const { default: EventRegistration } = await import("../src/models/EventRegistration.js");
const { signAccessToken } = await import("../src/utils/token.js");

const makeUser = async (role, email) => {
  const user = await User.create({
    fullName: `Test ${role}`,
    email,
    // Tests mint tokens directly, so this never needs to verify.
    passwordHash: "not-used-in-tests",
    role,
    refreshTokens: [],
  });
  return {
    user,
    token: signAccessToken({ userId: user._id.toString(), role, email }),
  };
};

let admin;
let photographer;
let attendee;
let outsider;
let event;

before(async () => {
  await connectDB();
  assert.equal(
    mongoose.connection.db.databaseName,
    "event_media_test",
    "refusing to run against a database other than event_media_test"
  );
  await Promise.all([
    User.deleteMany({}),
    Event.deleteMany({}),
    EventRegistration.deleteMany({}),
  ]);

  admin = await makeUser("admin", "admin@test.local");
  photographer = await makeUser("photographer", "photographer@test.local");
  attendee = await makeUser("attendee", "attendee@test.local");
  outsider = await makeUser("attendee", "outsider@test.local");

  event = await Event.create({
    title: "Gate Test Event",
    description: "Fixture",
    location: "Test Hall",
    startDateTime: new Date("2026-12-01T18:00:00Z"),
    endDateTime: new Date("2026-12-01T21:00:00Z"),
    visibility: "public",
    published: true,
    createdBy: admin.user._id,
  });
});

after(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});

describe("public event listing", () => {
  test("returns published public events without a token", async () => {
    const res = await request(app).get("/api/events/public").expect(200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].title, "Gate Test Event");
  });

  test("hides unpublished events", async () => {
    const hidden = await Event.create({
      title: "Draft Event",
      startDateTime: new Date("2026-12-02T18:00:00Z"),
      endDateTime: new Date("2026-12-02T21:00:00Z"),
      published: false,
      createdBy: admin.user._id,
    });

    const res = await request(app).get("/api/events/public").expect(200);
    assert.deepEqual(
      res.body.map((e) => e.title),
      ["Gate Test Event"]
    );

    await hidden.deleteOne();
  });
});

describe("role enforcement", () => {
  test("rejects an unauthenticated event create", async () => {
    const res = await request(app).post("/api/admin/events").send({ title: "x" }).expect(401);
    assert.equal(res.body.error.code, "AUTH_REQUIRED");
  });

  test("rejects a photographer creating an event", async () => {
    await request(app)
      .post("/api/admin/events")
      .set("Authorization", `Bearer ${photographer.token}`)
      .send({ title: "x" })
      .expect(403);
  });

  test("rejects an attendee performing check-in", async () => {
    await request(app)
      .post(`/api/events/${event._id}/checkin`)
      .set("Authorization", `Bearer ${attendee.token}`)
      .send({ registrationCode: "EVT-000000" })
      .expect(403);
  });

  test("rejects a garbage token", async () => {
    const res = await request(app)
      .get(`/api/events/${event._id}/gallery`)
      .set("Authorization", "Bearer not-a-real-token")
      .expect(401);
    assert.equal(res.body.error.code, "INVALID_TOKEN");
  });
});

describe("gallery gate", () => {
  let registrationCode;
  let qrToken;

  test("blocks an unauthenticated visitor", async () => {
    await request(app).get(`/api/events/${event._id}/gallery`).expect(401);
  });

  test("blocks a signed-in guest who never registered", async () => {
    const res = await request(app)
      .get(`/api/events/${event._id}/gallery`)
      .set("Authorization", `Bearer ${attendee.token}`)
      .expect(403);
    assert.equal(res.body.error.code, "NOT_REGISTERED");
  });

  test("registering issues a code and a QR token", async () => {
    const res = await request(app)
      .post(`/api/events/${event._id}/register`)
      .set("Authorization", `Bearer ${attendee.token}`)
      .expect(201);

    registrationCode = res.body.registration.registrationCode;
    qrToken = res.body.registration.qrToken;

    assert.match(registrationCode, /^EVT-[0-9A-F]{6}$/);
    assert.equal(qrToken.length, 64);
    assert.equal(res.body.registration.attended, false);
  });

  test("registering twice reuses the existing registration", async () => {
    const res = await request(app)
      .post(`/api/events/${event._id}/register`)
      .set("Authorization", `Bearer ${attendee.token}`)
      .expect(200);
    assert.equal(res.body.registration.registrationCode, registrationCode);
  });

  test("still blocks after registering but before check-in", async () => {
    const res = await request(app)
      .get(`/api/events/${event._id}/gallery`)
      .set("Authorization", `Bearer ${attendee.token}`)
      .expect(403);
    assert.equal(res.body.error.code, "NOT_ATTENDED");
  });

  test("staff can check the guest in with the QR token", async () => {
    const res = await request(app)
      .post(`/api/events/${event._id}/checkin`)
      .set("Authorization", `Bearer ${photographer.token}`)
      .send({ qrToken })
      .expect(200);
    assert.equal(res.body.registration.attended, true);
    assert.ok(res.body.registration.checkedInAt);
  });

  test("unlocks the gallery once the guest has attended", async () => {
    const res = await request(app)
      .get(`/api/events/${event._id}/gallery`)
      .set("Authorization", `Bearer ${attendee.token}`)
      .expect(200);
    assert.ok(Array.isArray(res.body.media));
  });

  test("does not unlock the gallery for a different guest", async () => {
    const res = await request(app)
      .get(`/api/events/${event._id}/gallery`)
      .set("Authorization", `Bearer ${outsider.token}`)
      .expect(403);
    assert.equal(res.body.error.code, "NOT_REGISTERED");
  });

  test("rejects check-in with a code from no registration", async () => {
    const res = await request(app)
      .post(`/api/events/${event._id}/checkin`)
      .set("Authorization", `Bearer ${photographer.token}`)
      .send({ registrationCode: "EVT-FFFFFF" })
      .expect(404);
    assert.equal(res.body.error.code, "NOT_REGISTERED");
  });

  test("requires a code or token to check in", async () => {
    const res = await request(app)
      .post(`/api/events/${event._id}/checkin`)
      .set("Authorization", `Bearer ${photographer.token}`)
      .send({})
      .expect(400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });
});

describe("media storage guard", () => {
  test("reports unconfigured storage instead of a raw 500", async () => {
    const res = await request(app)
      .post(`/api/events/${event._id}/media`)
      .set("Authorization", `Bearer ${photographer.token}`)
      .attach("file", Buffer.from("not-a-real-image"), "test.png")
      .expect(503);
    assert.equal(res.body.error.code, "MEDIA_STORAGE_UNCONFIGURED");
  });
});
