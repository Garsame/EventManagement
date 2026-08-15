import mongoose from "mongoose";

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is not defined in environment variables");
  }

  try {
    // The database name comes from MONGO_URI (see .env.example). MONGO_DB_NAME
    // overrides it, which is what lets the seed target a scratch database.
    const options = process.env.MONGO_DB_NAME
      ? { dbName: process.env.MONGO_DB_NAME }
      : {};
    await mongoose.connect(uri, options);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error", error);
    throw error;
  }
};

export default connectDB;
