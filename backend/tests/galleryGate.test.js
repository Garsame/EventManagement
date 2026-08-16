import test, { before, after, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

// Media tests exercise the on-disk driver, never a remote account.
process.env.MEDIA_STORAGE = "local";

// Blank the SMTP settings so the suite never sends real email; the mailer then
// returns the code as devCode instead, which is what the OTP tests read.
// MANAGEMENT_EMAIL is blanked too so contact-form tests never trigger a real
// notification email either.
process.env.SMTP_HOST = "";
process.env.SMTP_USER = "";
process.env.SMTP_PASSWORD = "";
process.env.MANAGEMENT_EMAIL = "";

// The suite runs a lot of requests through auth-adjacent routes across many
// tests, all sharing one 15-minute rate-limit window. No test here asserts
// that a limiter actually fires, so leaving it on just made results depend
// on request order rather than correctness. See middleware/rateLimit.js.
process.env.DISABLE_RATE_LIMIT = "true";

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
const { uploadsDir } = await import("../src/config/storage.js");
const { default: Message } = await import("../src/models/Message.js");

// Registration requires a complete profile, so fixtures carry one unless a
// test is specifically exercising the incomplete case.
const COMPLETE_PROFILE = {
  phone: "+252 61 000 0000",
  location: "Mogadishu, Somalia",
  institution: "Test University",
  educationLevel: "bachelors",
  sex: "prefer-not-to-say",
};

const makeUser = async (role, email, overrides = {}) => {
  const user = await User.create({
    fullName: `Test ${role}`,
    email,
    // Tests mint tokens directly, so this never needs to verify.
    passwordHash: "not-used-in-tests",
    role,
    refreshTokens: [],
    ...COMPLETE_PROFILE,
    ...overrides,
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
let incomplete;
let unassignedPhotographer;
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
  incomplete = await makeUser("attendee", "incomplete@test.local", {
    phone: "",
    location: "",
    institution: "",
    educationLevel: "",
    sex: "",
  });

  unassignedPhotographer = await makeUser("photographer", "spare-photographer@test.local");

  event = await Event.create({
    title: "Gate Test Event",
    description: "Fixture",
    location: "Test Hall",
    startDateTime: new Date("2026-12-01T18:00:00Z"),
    endDateTime: new Date("2026-12-01T21:00:00Z"),
    visibility: "public",
    published: true,
    status: "registration-open",
    createdBy: admin.user._id,
    // Media routes now require assignment, so the fixture photographer is on it.
    photographers: [photographer.user._id],
  });
});

after(async () => {
  // Remove any files the media tests wrote for this fixture event.
  await fs.rm(path.join(uploadsDir, String(event._id)), { recursive: true, force: true });
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

describe("profile gate on registration", () => {
  test("blocks registration while required profile fields are missing", async () => {
    const res = await request(app)
      .post(`/api/events/${event._id}/register`)
      .set("Authorization", `Bearer ${incomplete.token}`)
      .expect(403);

    assert.equal(res.body.error.code, "PROFILE_INCOMPLETE");
    assert.deepEqual(res.body.error.missingProfileFields.sort(), [
      "educationLevel",
      "institution",
      "location",
      "phone",
      "sex",
    ]);
  });

  test("reports the profile as incomplete on /users/me", async () => {
    const res = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${incomplete.token}`)
      .expect(200);
    assert.equal(res.body.user.profileComplete, false);
    assert.equal(res.body.user.missingProfileFields.length, 5);
    // Initials back the avatar fallback when no image is uploaded.
    assert.ok(res.body.user.initials.length > 0);
  });

  test("rejects an invalid education level", async () => {
    await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${incomplete.token}`)
      .send({ educationLevel: "wizardry" })
      .expect(400);
  });

  test("never returns the password hash or refresh tokens", async () => {
    const res = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${attendee.token}`)
      .expect(200);
    assert.equal(res.body.user.passwordHash, undefined);
    assert.equal(res.body.user.refreshTokens, undefined);
  });

  test("allows registration once the profile is filled in", async () => {
    await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${incomplete.token}`)
      .send({
        phone: "+252 61 111 2222",
        location: "Hargeisa, Somalia",
        institution: "Another University",
        educationLevel: "diploma",
        sex: "female",
      })
      .expect(200);

    await request(app)
      .post(`/api/events/${event._id}/register`)
      .set("Authorization", `Bearer ${incomplete.token}`)
      .expect(201);
  });

  test("requires authentication for the profile endpoints", async () => {
    await request(app).get("/api/users/me").expect(401);
    await request(app).patch("/api/users/me").send({ phone: "1" }).expect(401);
    await request(app).get("/api/users/me/registrations").expect(401);
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

describe("admin bootstrap signup", () => {
  test("reports an admin already exists and refuses to create another", async () => {
    const exists = await request(app).get("/api/auth/admin/exists").expect(200);
    assert.equal(exists.body.exists, true, "fixture admin should already exist");

    const res = await request(app)
      .post("/api/auth/admin/signup")
      .send({ fullName: "Second Admin", email: "second-admin@test.local", password: "Second123" })
      .expect(403);
    assert.equal(res.body.error.code, "ADMIN_EXISTS");
    assert.equal(await User.countDocuments({ email: "second-admin@test.local" }), 0);
  });
});

describe("realm-scoped login", () => {
  test("an admin's correct password is rejected on the public login", async () => {
    await User.findByIdAndUpdate(admin.user._id, {
      passwordHash: await import("bcrypt").then((b) => b.default.hash("AdminPass123", 10)),
    });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: admin.user.email, password: "AdminPass123" })
      .expect(401);
    assert.equal(res.body.error.code, "INVALID_CREDENTIALS");
  });

  test("the admin door accepts an admin and rejects an attendee", async () => {
    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: admin.user.email, password: "AdminPass123" })
      .expect(200);

    await User.findByIdAndUpdate(attendee.user._id, {
      passwordHash: await import("bcrypt").then((b) => b.default.hash("AttendeePass123", 10)),
    });
    const res = await request(app)
      .post("/api/auth/admin/login")
      .send({ email: attendee.user.email, password: "AttendeePass123" })
      .expect(401);
    assert.equal(res.body.error.code, "INVALID_CREDENTIALS");
  });

  test("the photographer door accepts a photographer and rejects an admin", async () => {
    await User.findByIdAndUpdate(photographer.user._id, {
      passwordHash: await import("bcrypt").then((b) => b.default.hash("PhotoPass123", 10)),
    });
    await request(app)
      .post("/api/auth/photographer/login")
      .send({ email: photographer.user.email, password: "PhotoPass123" })
      .expect(200);

    const res = await request(app)
      .post("/api/auth/photographer/login")
      .send({ email: admin.user.email, password: "AdminPass123" })
      .expect(401);
    assert.equal(res.body.error.code, "INVALID_CREDENTIALS");
  });

  test("a deactivated account cannot sign in even with the right password", async () => {
    const deactivated = await makeUser("attendee", "deactivated@test.local");
    await User.findByIdAndUpdate(deactivated.user._id, {
      passwordHash: await import("bcrypt").then((b) => b.default.hash("Deact123", 10)),
      isActive: false,
    });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: deactivated.user.email, password: "Deact123" })
      .expect(403);
    assert.equal(res.body.error.code, "ACCOUNT_DEACTIVATED");
  });
});

describe("admin user management", () => {
  test("only an admin may reach it", async () => {
    await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${photographer.token}`)
      .expect(403);
  });

  test("creates a photographer without email verification and it can sign in immediately", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ fullName: "New Snapper", email: "new-snapper@test.local", role: "photographer", password: "SnapPass123" })
      .expect(201);

    assert.equal(res.body.user.role, "photographer");
    assert.equal(res.body.user.isActive, true);

    await request(app)
      .post("/api/auth/photographer/login")
      .send({ email: "new-snapper@test.local", password: "SnapPass123" })
      .expect(200);

    await User.deleteOne({ email: "new-snapper@test.local" });
  });

  test("rejects a duplicate email", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ fullName: "Dup", email: attendee.user.email, role: "attendee" })
      .expect(409);
    assert.equal(res.body.error.code, "EMAIL_EXISTS");
  });

  test("deactivating blocks sign-in and reactivating restores it", async () => {
    const target = await makeUser("attendee", "toggle@test.local");
    await User.findByIdAndUpdate(target.user._id, {
      passwordHash: await import("bcrypt").then((b) => b.default.hash("TogglePass1", 10)),
    });

    await request(app)
      .patch(`/api/admin/users/${target.user._id}/status`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ isActive: false })
      .expect(200);

    const blocked = await request(app)
      .post("/api/auth/login")
      .send({ email: "toggle@test.local", password: "TogglePass1" })
      .expect(403);
    assert.equal(blocked.body.error.code, "ACCOUNT_DEACTIVATED");

    await request(app)
      .patch(`/api/admin/users/${target.user._id}/status`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ isActive: true })
      .expect(200);

    await request(app)
      .post("/api/auth/login")
      .send({ email: "toggle@test.local", password: "TogglePass1" })
      .expect(200);

    await User.deleteOne({ email: "toggle@test.local" });
  });

  test("an admin cannot deactivate their own account", async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${admin.user._id}/status`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ isActive: false })
      .expect(400);
    assert.match(res.body.error.message, /cannot deactivate your own/i);
  });

  test("cannot deactivate the last remaining admin", async () => {
    // admin.user is the only admin in this fixture set.
    const count = await User.countDocuments({ role: "admin" });
    assert.equal(count, 1, "test assumes a single fixture admin");
  });

  test("resetting a password ends existing sessions", async () => {
    const target = await makeUser("attendee", "reset-me@test.local");
    const before = await User.findById(target.user._id).lean();
    assert.equal(before.refreshTokens.length, 0);

    // Simulate a live session by logging in for real.
    await User.findByIdAndUpdate(target.user._id, {
      passwordHash: await import("bcrypt").then((b) => b.default.hash("Orig123", 10)),
    });
    await request(app).post("/api/auth/login").send({ email: "reset-me@test.local", password: "Orig123" }).expect(200);

    const res = await request(app)
      .patch(`/api/admin/users/${target.user._id}/password`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({})
      .expect(200);
    assert.ok(res.body.generatedPassword);

    const after = await User.findById(target.user._id).lean();
    assert.equal(after.refreshTokens.length, 0);

    await User.deleteOne({ email: "reset-me@test.local" });
  });
});

describe("event lifecycle", () => {
  test("published is derived from status, not settable directly", async () => {
    // published is not an accepted field at all; a draft is always
    // unpublished no matter what the client sends for it.
    const created = await request(app)
      .post("/api/admin/events")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        title: "New Draft",
        startDateTime: "2027-05-01T10:00:00Z",
        endDateTime: "2027-05-01T12:00:00Z",
        status: "draft",
        published: true,
      })
      .expect(201);
    assert.equal(created.body.published, false);

    // Flipping status on update flips published to match - this is the bug
    // that motivated deriving it server-side: the console UI has no published
    // checkbox, only a status select, so update must keep them in sync too.
    const updated = await request(app)
      .patch(`/api/admin/events/${created.body._id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ status: "registration-open" })
      .expect(200);
    assert.equal(updated.body.published, true);

    await Event.findByIdAndDelete(created.body._id);
  });

  test("registration is blocked while the event is a draft", async () => {
    const draft = await Event.create({
      title: "Not Open Yet",
      startDateTime: new Date("2027-06-01T10:00:00Z"),
      endDateTime: new Date("2027-06-01T12:00:00Z"),
      status: "draft",
      published: false,
      createdBy: admin.user._id,
    });

    const res = await request(app)
      .post(`/api/events/${draft._id}/register`)
      .set("Authorization", `Bearer ${attendee.token}`)
      .expect(403);
    assert.equal(res.body.error.code, "REGISTRATION_CLOSED");

    await draft.deleteOne();
  });

  test("registration is blocked once an event is completed", async () => {
    const completed = await Event.create({
      title: "Already Done",
      startDateTime: new Date("2020-01-01T10:00:00Z"),
      endDateTime: new Date("2020-01-01T12:00:00Z"),
      status: "completed",
      published: true,
      visibility: "public",
      createdBy: admin.user._id,
    });

    const res = await request(app)
      .post(`/api/events/${completed._id}/register`)
      .set("Authorization", `Bearer ${attendee.token}`)
      .expect(403);
    assert.equal(res.body.error.code, "REGISTRATION_CLOSED");

    await completed.deleteOne();
  });

  test("public listing excludes drafts but includes completed public events", async () => {
    const completed = await Event.create({
      title: "Completed But Public",
      startDateTime: new Date("2020-02-01T10:00:00Z"),
      endDateTime: new Date("2020-02-01T12:00:00Z"),
      status: "completed",
      published: true,
      visibility: "public",
      createdBy: admin.user._id,
    });

    const res = await request(app).get("/api/events/public").expect(200);
    const titles = res.body.map((e) => e.title);
    assert.ok(titles.includes("Completed But Public"));

    await completed.deleteOne();
  });
});

describe("signup with an emailed code", () => {
  const EMAIL = "otp-signup@test.local";

  test("requesting a code does not create the account yet", async () => {
    const res = await request(app)
      .post("/api/auth/signup/request")
      .send({ fullName: "Code User", email: EMAIL, password: "Secret123" })
      .expect(201);

    assert.equal(res.body.email, EMAIL);
    assert.ok(res.body.devCode, "dev code expected while SMTP is off");
    assert.equal(await User.countDocuments({ email: EMAIL }), 0);
  });

  test("a wrong code is rejected and counts against the attempt limit", async () => {
    const res = await request(app)
      .post("/api/auth/signup/verify")
      .send({ email: EMAIL, code: "000000" })
      .expect(400);
    assert.equal(res.body.error.code, "OTP_INVALID");
    assert.ok(res.body.error.attemptsLeft < 5);
    assert.equal(await User.countDocuments({ email: EMAIL }), 0);
  });

  test("cancelling discards the pending signup", async () => {
    await request(app).post("/api/auth/signup/cancel").send({ email: EMAIL }).expect(200);
    await request(app)
      .post("/api/auth/signup/verify")
      .send({ email: EMAIL, code: "123456" })
      .expect(400);
    assert.equal(await User.countDocuments({ email: EMAIL }), 0);
  });

  test("the correct code creates the account and signs them in", async () => {
    const start = await request(app)
      .post("/api/auth/signup/request")
      .send({ fullName: "Code User", email: EMAIL, password: "Secret123" })
      .expect(201);

    const res = await request(app)
      .post("/api/auth/signup/verify")
      .send({ email: EMAIL, code: start.body.devCode })
      .expect(201);

    assert.ok(res.body.accessToken && res.body.refreshToken, "should be signed in immediately");
    assert.equal(res.body.user.email, EMAIL);
    assert.equal(res.body.user.profileComplete, false);
    assert.equal(await User.countDocuments({ email: EMAIL }), 1);

    // The code is single use.
    await request(app)
      .post("/api/auth/signup/verify")
      .send({ email: EMAIL, code: start.body.devCode })
      .expect(400);

    await User.deleteOne({ email: EMAIL });
  });

  test("refuses an address that is already registered", async () => {
    const res = await request(app)
      .post("/api/auth/signup/request")
      .send({ fullName: "Dup", email: "attendee@test.local", password: "Secret123" })
      .expect(409);
    assert.equal(res.body.error.code, "EMAIL_EXISTS");
  });
});

describe("password change by emailed code", () => {
  test("requires authentication", async () => {
    await request(app).post("/api/auth/password/request-otp").expect(401);
    await request(app).post("/api/auth/password/change").send({ code: "1", newPassword: "x" }).expect(401);
  });

  test("a wrong code does not change the password", async () => {
    await request(app)
      .post("/api/auth/password/request-otp")
      .set("Authorization", `Bearer ${outsider.token}`)
      .expect(200);

    const before = await User.findById(outsider.user._id).lean();
    const res = await request(app)
      .post("/api/auth/password/change")
      .set("Authorization", `Bearer ${outsider.token}`)
      .send({ code: "000000", newPassword: "BrandNew123" })
      .expect(400);

    assert.equal(res.body.error.code, "OTP_INVALID");
    const after = await User.findById(outsider.user._id).lean();
    assert.equal(before.passwordHash, after.passwordHash);
  });

  test("the correct code sets the new password and revokes old sessions", async () => {
    const start = await request(app)
      .post("/api/auth/password/request-otp")
      .set("Authorization", `Bearer ${outsider.token}`)
      .expect(200);

    const before = await User.findById(outsider.user._id).lean();

    const res = await request(app)
      .post("/api/auth/password/change")
      .set("Authorization", `Bearer ${outsider.token}`)
      .send({ code: start.body.devCode, newPassword: "BrandNew123" })
      .expect(200);

    assert.ok(res.body.accessToken, "a fresh session is returned");
    const after = await User.findById(outsider.user._id).lean();
    assert.notEqual(before.passwordHash, after.passwordHash);
    // Only the newly issued refresh token should survive the change.
    assert.equal(after.refreshTokens.length, 1);
  });

  test("rejects a password shorter than six characters", async () => {
    await request(app)
      .post("/api/auth/password/change")
      .set("Authorization", `Bearer ${outsider.token}`)
      .send({ code: "123456", newPassword: "abc" })
      .expect(400);
  });
});

describe("forgot password (no session required)", () => {
  test("requesting for an email that is not registered still returns 200 with no devCode", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password/request")
      .send({ email: "nobody-here@test.local" })
      .expect(200);
    assert.equal(res.body.devCode, undefined, "no code should be issued for an unregistered email");
  });

  test("requesting for a registered email returns a code (SMTP is off in tests)", async () => {
    const locked = await makeUser("attendee", "locked-out@test.local");
    const res = await request(app)
      .post("/api/auth/forgot-password/request")
      .send({ email: "locked-out@test.local" })
      .expect(200);
    assert.ok(res.body.devCode, "expected a devCode for a registered email");

    // Same response shape either way - this is the anti-enumeration property.
    const unregistered = await request(app)
      .post("/api/auth/forgot-password/request")
      .send({ email: "still-nobody@test.local" })
      .expect(200);
    assert.equal(Object.keys(unregistered.body).sort().join(","), "expiresInMinutes,message");
    void locked;
  });

  test("a wrong code is rejected without touching the password", async () => {
    const target = await makeUser("attendee", "wrong-code-target@test.local");
    await request(app).post("/api/auth/forgot-password/request").send({ email: target.user.email }).expect(200);

    const before = await User.findById(target.user._id).lean();
    const res = await request(app)
      .post("/api/auth/forgot-password/verify")
      .send({ email: target.user.email, code: "000000", newPassword: "WhateverNew123" })
      .expect(400);
    assert.equal(res.body.error.code, "OTP_INVALID");

    const after = await User.findById(target.user._id).lean();
    assert.equal(before.passwordHash, after.passwordHash);
  });

  test("the correct code resets the password, revokes sessions, and issues no tokens", async () => {
    const target = await makeUser("attendee", "reset-target@test.local");
    // Give the account a real refresh token first, as if they were logged in
    // on another device, so revocation can be checked.
    await User.updateOne({ _id: target.user._id }, { $push: { refreshTokens: "some-stale-refresh-token" } });

    const start = await request(app)
      .post("/api/auth/forgot-password/request")
      .send({ email: target.user.email })
      .expect(200);

    const res = await request(app)
      .post("/api/auth/forgot-password/verify")
      .send({ email: target.user.email, code: start.body.devCode, newPassword: "BrandNewReset123" })
      .expect(200);

    assert.deepEqual(res.body, { success: true }, "no session should be issued - the caller doesn't know which realm to log into");

    const after = await User.findById(target.user._id).lean();
    assert.equal(after.refreshTokens.length, 0, "existing sessions must be revoked");

    // The new password actually works at the real login endpoint.
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: target.user.email, password: "BrandNewReset123" })
      .expect(200);
    assert.ok(login.body.accessToken);
  });

  test("a used or expired code cannot be replayed", async () => {
    const target = await makeUser("attendee", "replay-target@test.local");
    const start = await request(app)
      .post("/api/auth/forgot-password/request")
      .send({ email: target.user.email })
      .expect(200);

    await request(app)
      .post("/api/auth/forgot-password/verify")
      .send({ email: target.user.email, code: start.body.devCode, newPassword: "FirstReset123" })
      .expect(200);

    await request(app)
      .post("/api/auth/forgot-password/verify")
      .send({ email: target.user.email, code: start.body.devCode, newPassword: "SecondReset123" })
      .expect(400);
  });

  test("rejects a new password shorter than six characters", async () => {
    const target = await makeUser("attendee", "short-pw-target@test.local");
    const start = await request(app)
      .post("/api/auth/forgot-password/request")
      .send({ email: target.user.email })
      .expect(200);
    await request(app)
      .post("/api/auth/forgot-password/verify")
      .send({ email: target.user.email, code: start.body.devCode, newPassword: "abc" })
      .expect(400);
  });
});

describe("photographer assignment", () => {
  test("an unassigned photographer cannot list media", async () => {
    const res = await request(app)
      .get(`/api/events/${event._id}/media`)
      .set("Authorization", `Bearer ${unassignedPhotographer.token}`)
      .expect(403);
    assert.equal(res.body.error.code, "NOT_ASSIGNED");
  });

  test("an unassigned photographer cannot upload", async () => {
    const res = await request(app)
      .post(`/api/events/${event._id}/media`)
      .set("Authorization", `Bearer ${unassignedPhotographer.token}`)
      .attach("file", Buffer.from("bytes"), "x.png")
      .expect(403);
    assert.equal(res.body.error.code, "NOT_ASSIGNED");
  });

  test("an assigned photographer can list media", async () => {
    await request(app)
      .get(`/api/events/${event._id}/media`)
      .set("Authorization", `Bearer ${photographer.token}`)
      .expect(200);
  });

  test("an admin can work any event without being assigned", async () => {
    await request(app)
      .get(`/api/events/${event._id}/media`)
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);
  });

  test("only an admin may change assignments", async () => {
    await request(app)
      .put(`/api/admin/events/${event._id}/photographers`)
      .set("Authorization", `Bearer ${photographer.token}`)
      .send({ photographerIds: [] })
      .expect(403);
  });

  test("assignments must reference photographer accounts", async () => {
    await request(app)
      .put(`/api/admin/events/${event._id}/photographers`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ photographerIds: [attendee.user._id.toString()] })
      .expect(400);
  });

  test("an admin can assign and unassign", async () => {
    const add = await request(app)
      .put(`/api/admin/events/${event._id}/photographers`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ photographerIds: [photographer.user._id.toString(), unassignedPhotographer.user._id.toString()] })
      .expect(200);
    assert.equal(add.body.photographers.length, 2);

    // Put the fixture back so later tests see the original assignment.
    const back = await request(app)
      .put(`/api/admin/events/${event._id}/photographers`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ photographerIds: [photographer.user._id.toString()] })
      .expect(200);
    assert.equal(back.body.photographers.length, 1);
  });
});

describe("admin event management", () => {
  test("lists every event with counts, including drafts", async () => {
    const draft = await Event.create({
      title: "Hidden Draft",
      startDateTime: new Date("2027-01-01T10:00:00Z"),
      endDateTime: new Date("2027-01-01T12:00:00Z"),
      published: false,
      visibility: "private",
      createdBy: admin.user._id,
    });

    const res = await request(app)
      .get("/api/admin/events")
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);

    const titles = res.body.events.map((e) => e.title);
    assert.ok(titles.includes("Hidden Draft"), "drafts must appear for admins");

    const fixture = res.body.events.find((e) => e.title === "Gate Test Event");
    assert.equal(typeof fixture.registrationCount, "number");
    assert.equal(typeof fixture.mediaCount, "number");

    await draft.deleteOne();
  });

  test("rejects an end date before the start date", async () => {
    await request(app)
      .post("/api/admin/events")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        title: "Backwards",
        startDateTime: "2027-02-05T10:00:00Z",
        endDateTime: "2027-02-01T10:00:00Z",
      })
      .expect(400);
  });

  test("deleting an event removes its registrations and media rows", async () => {
    const doomed = await Event.create({
      title: "Doomed Event",
      startDateTime: new Date("2027-03-01T10:00:00Z"),
      endDateTime: new Date("2027-03-01T12:00:00Z"),
      published: true,
      visibility: "public",
      status: "registration-open",
      createdBy: admin.user._id,
      photographers: [photographer.user._id],
    });

    await request(app)
      .post(`/api/events/${doomed._id}/register`)
      .set("Authorization", `Bearer ${attendee.token}`)
      .expect(201);

    const res = await request(app)
      .delete(`/api/admin/events/${doomed._id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);

    assert.equal(res.body.deleted.registrations, 1);
    assert.equal(await EventRegistration.countDocuments({ eventId: doomed._id }), 0);
    assert.equal(await Event.countDocuments({ _id: doomed._id }), 0);
  });

  test("a photographer cannot delete an event", async () => {
    await request(app)
      .delete(`/api/admin/events/${event._id}`)
      .set("Authorization", `Bearer ${photographer.token}`)
      .expect(403);
  });
});

describe("local media storage", () => {
  let uploaded;

  test("stores an upload on disk and returns a URL for it", async () => {
    const res = await request(app)
      .post(`/api/events/${event._id}/media`)
      .set("Authorization", `Bearer ${photographer.token}`)
      .attach("file", Buffer.from("pretend-png-bytes"), "shot.png")
      .expect(201);

    uploaded = res.body;
    assert.equal(uploaded.type, "image");
    assert.match(uploaded.url, /\/uploads\/.+\.png$/);

    // publicId is not on the DTO, so locate the file through the URL.
    const relative = uploaded.url.split("/uploads/")[1];
    const stat = await fs.stat(path.join(uploadsDir, relative));
    assert.ok(stat.size > 0, "expected the stored file to be non-empty");
  });

  test("rejects a file type that is not an image or video", async () => {
    await request(app)
      .post(`/api/events/${event._id}/media`)
      .set("Authorization", `Bearer ${photographer.token}`)
      .attach("file", Buffer.from("#!/bin/sh"), { filename: "x.sh", contentType: "application/x-sh" })
      .expect(400);
  });

  test("does not expose media through the gate to an unregistered guest", async () => {
    const res = await request(app)
      .get(`/api/events/${event._id}/gallery`)
      .set("Authorization", `Bearer ${outsider.token}`)
      .expect(403);
    assert.equal(res.body.error.code, "NOT_REGISTERED");
  });

  test("serves the media to the checked-in guest", async () => {
    const res = await request(app)
      .get(`/api/events/${event._id}/gallery`)
      .set("Authorization", `Bearer ${attendee.token}`)
      .expect(200);
    assert.equal(res.body.media.length, 1);
    assert.equal(res.body.media[0].url, uploaded.url);
  });

  test("deleting removes both the record and the file", async () => {
    await request(app)
      .delete(`/api/events/${event._id}/media/${uploaded.id}`)
      .set("Authorization", `Bearer ${photographer.token}`)
      .expect(200);

    const relative = uploaded.url.split("/uploads/")[1];
    await assert.rejects(fs.stat(path.join(uploadsDir, relative)), /ENOENT/);

    const res = await request(app)
      .get(`/api/events/${event._id}/gallery`)
      .set("Authorization", `Bearer ${attendee.token}`)
      .expect(200);
    assert.equal(res.body.media.length, 0);
  });
});

describe("contact form and admin messages", () => {
  test("rejects a missing field", async () => {
    const res = await request(app)
      .post("/api/contact")
      .send({ name: "Test", email: "test@example.com" })
      .expect(400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });

  test("rejects an invalid email", async () => {
    await request(app)
      .post("/api/contact")
      .send({ name: "Test", email: "not-an-email", message: "hello" })
      .expect(400);
  });

  test("anyone can submit without an account, and it lands in the admin list", async () => {
    const res = await request(app)
      .post("/api/contact")
      .send({ name: "Curious Guest", email: "guest-contact@test.local", subject: "Question", message: "How do I register?" })
      .expect(201);
    assert.equal(res.body.message.status, "open");

    await request(app)
      .get("/api/admin/messages")
      .set("Authorization", `Bearer ${photographer.token}`)
      .expect(403);

    const list = await request(app)
      .get("/api/admin/messages")
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);
    assert.ok(list.body.messages.some((m) => m.email === "guest-contact@test.local"));
    assert.ok(list.body.counts.open >= 1);
  });

  test("admin reply marks it replied and is emailed to the sender", async () => {
    const created = await request(app)
      .post("/api/contact")
      .send({ name: "Reply Target", email: "reply-target@test.local", message: "Can I bring a plus one?" })
      .expect(201);

    const replied = await request(app)
      .post(`/api/admin/messages/${created.body.message.id}/reply`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ reply: "Yes, one guest is fine as long as they also register." })
      .expect(200);

    assert.equal(replied.body.message.status, "replied");
    assert.equal(replied.body.message.reply.body, "Yes, one guest is fine as long as they also register.");

    const stored = await Message.findById(created.body.message.id).lean();
    assert.equal(stored.status, "replied");
    assert.equal(String(stored.reply.repliedBy), admin.user._id.toString());
  });

  test("a photographer cannot reply", async () => {
    const created = await request(app)
      .post("/api/contact")
      .send({ name: "X", email: "photog-blocked@test.local", message: "hi" })
      .expect(201);
    await request(app)
      .post(`/api/admin/messages/${created.body.message.id}/reply`)
      .set("Authorization", `Bearer ${photographer.token}`)
      .send({ reply: "nope" })
      .expect(403);
  });

  test("replying requires a non-empty reply", async () => {
    const created = await request(app)
      .post("/api/contact")
      .send({ name: "X", email: "empty-reply@test.local", message: "hi" })
      .expect(201);
    await request(app)
      .post(`/api/admin/messages/${created.body.message.id}/reply`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ reply: "   " })
      .expect(400);
  });
});

describe("activity log", () => {
  test("a photographer cannot read the activity feed", async () => {
    await request(app)
      .get("/api/admin/activity")
      .set("Authorization", `Bearer ${photographer.token}`)
      .expect(403);
  });

  test("creating a user is recorded and readable by an admin", async () => {
    const created = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ fullName: "Logged User", email: "logged-user@test.local", role: "attendee", sendEmail: false })
      .expect(201);

    const feed = await request(app)
      .get("/api/admin/activity")
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);

    const entry = feed.body.activity.find((a) => a.action === "user.created" && a.targetLabel === "Logged User");
    assert.ok(entry, "expected a user.created entry for the new account");
    assert.match(entry.summary, /Logged User/);
    assert.equal(entry.actorRole, "admin");
    assert.ok(feed.body.actions.includes("user.created"));

    await User.deleteOne({ _id: created.body.user.id });
  });

  test("checking a guest in is recorded with the guest and event named", async () => {
    const checkinAttendee = await makeUser("attendee", "logged-checkin@test.local");
    const reg = await request(app)
      .post(`/api/events/${event._id}/register`)
      .set("Authorization", `Bearer ${checkinAttendee.token}`)
      .expect(201);

    await request(app)
      .post(`/api/events/${event._id}/checkin`)
      .set("Authorization", `Bearer ${photographer.token}`)
      .send({ registrationCode: reg.body.registration.registrationCode })
      .expect(200);

    const feed = await request(app)
      .get("/api/admin/activity")
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);

    const entry = feed.body.activity.find(
      (a) => a.action === "registration.checked_in" && a.summary.includes("logged-checkin@test.local")
    );
    assert.ok(entry, "expected a registration.checked_in entry naming the guest");
    assert.match(entry.summary, /Gate Test Event/);
  });

  test("q filters by summary, actor, or target text", async () => {
    const feed = await request(app)
      .get("/api/admin/activity")
      .set("Authorization", `Bearer ${admin.token}`)
      .query({ q: "logged-checkin@test.local" })
      .expect(200);
    assert.ok(feed.body.activity.length >= 1);
    assert.ok(feed.body.activity.every((a) => JSON.stringify(a).includes("logged-checkin")));
  });
});
