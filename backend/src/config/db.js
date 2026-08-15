import mongoose from "mongoose";

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is not defined in environment variables");
  }

  try {
    await mongoose.connect(uri, {
      dbName: "event_media_system",
    });
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error", error);
    throw error;
  }
};

export default connectDB;
