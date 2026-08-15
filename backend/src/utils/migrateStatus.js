import "../loadEnv.js";
import mongoose from "mongoose";
import connectDB from "../config/db.js";

/**
 * One-off backfill for documents created before status and isActive existed.
 * Safe to re-run: it only touches documents still missing the field.
 */
const run = async () => {
  await connectDB();
  const db = mongoose.connection.db;

  const events = await db.collection("events").updateMany({ status: { $exists: false } }, [
    { $set: { status: { $cond: [{ $eq: ["$published", true] }, "registration-open", "draft"] } } },
  ]);
  console.log("events given a status:", events.modifiedCount);

  const users = await db
    .collection("users")
    .updateMany({ isActive: { $exists: false } }, { $set: { isActive: true } });
  console.log("users marked active:", users.modifiedCount);

  const breakdown = await db
    .collection("events")
    .aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }])
    .toArray();
  console.log("status breakdown:", breakdown);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
