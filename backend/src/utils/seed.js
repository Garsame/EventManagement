import dotenv from "dotenv";
import bcrypt from "bcrypt";
import connectDB from "../config/db.js";
import User from "../models/User.js";
import Event from "../models/Event.js";

dotenv.config();

const seedUser = async ({ fullName, email, password, role }) => {
  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`${role} user already exists:`, email);
    return existing;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    fullName,
    email,
    passwordHash,
    role,
    refreshTokens: [],
  });
  console.log(`${role} user created:`, email);
  return user;
};

// Demo events for the public Events page. Keyed by title so re-running is safe.
const demoEvents = [
  {
    title: "Northside Product Launch",
    description:
      "An evening product reveal with live demos, a keynote from the founding team, and a hosted reception afterward.",
    location: "Bluepoint Hall, Downtown",
    startDateTime: "2026-09-12T18:00:00.000Z",
    endDateTime: "2026-09-12T21:30:00.000Z",
  },
  {
    title: "Studio 12 Album Release Party",
    description:
      "An intimate listening party and live acoustic set to celebrate the new record, with photography by the in-house team.",
    location: "Studio 12, Arts District",
    startDateTime: "2026-09-19T20:00:00.000Z",
    endDateTime: "2026-09-20T00:00:00.000Z",
  },
  {
    title: "Community Night Market",
    description:
      "Local vendors, live music, and family activities. Come hungry and bring the whole crew.",
    location: "Fifth Avenue Plaza",
    startDateTime: "2026-09-27T16:00:00.000Z",
    endDateTime: "2026-09-27T22:00:00.000Z",
  },
  {
    title: "Amara & Jordan's Wedding Reception",
    description:
      "Join us in celebrating with dinner, dancing, and an open-bar reception. Photo booth on-site all evening.",
    location: "Willow Creek Gardens",
    startDateTime: "2026-10-04T17:00:00.000Z",
    endDateTime: "2026-10-04T23:00:00.000Z",
  },
  {
    title: "Riverside Tech Summit 2026",
    description:
      "A full-day conference with three stage tracks covering AI, platform engineering, and design systems, plus a networking lounge.",
    location: "Riverside Convention Center",
    startDateTime: "2026-11-02T09:00:00.000Z",
    endDateTime: "2026-11-02T18:00:00.000Z",
  },
];

const seedEvents = async (createdBy) => {
  for (const event of demoEvents) {
    const existing = await Event.findOne({ title: event.title });
    if (existing) {
      console.log("event already exists:", event.title);
      continue;
    }

    await Event.create({
      ...event,
      startDateTime: new Date(event.startDateTime),
      endDateTime: new Date(event.endDateTime),
      visibility: "public",
      published: true,
      status: "registration-open",
      createdBy,
    });
    console.log("event created:", event.title);
  }
};

const seed = async () => {
  await connectDB();

  const admin = await seedUser({
    fullName: "System Admin",
    email: "admin@example.com",
    password: "Admin123!",
    role: "admin",
  });

  await seedUser({
    fullName: "Test Photographer",
    email: "photographer@example.com",
    password: "Photo123!",
    role: "photographer",
  });

  // Deliberately left unregistered so the register -> check-in -> gallery
  // flow can be demonstrated from the beginning.
  await seedUser({
    fullName: "Demo Attendee",
    email: "attendee@example.com",
    password: "Attend123!",
    role: "attendee",
  });

  await seedEvents(admin._id);

  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
