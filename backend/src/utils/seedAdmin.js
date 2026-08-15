import dotenv from "dotenv";
import bcrypt from "bcrypt";
import connectDB from "../config/db.js";
import User from "../models/User.js";

dotenv.config();

const seedUser = async ({ fullName, email, password, role }) => {
  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`${role} user already exists:`, email);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    fullName,
    email,
    passwordHash,
    role,
    refreshTokens: [],
  });
  console.log(`${role} user created:`, email);
};

const seed = async () => {
  await connectDB();

  await seedUser({
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

  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
