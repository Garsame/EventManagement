import express from "express";
import cors from "cors";
import helmet from "helmet";
import routes from "./routes/index.js";
import errorHandler from "./middleware/errorHandler.js";
import { storageDriver, uploadsDir } from "./config/storage.js";

const app = express();

// Rate limiters key off the client IP, which is the proxy's unless we trust it.
app.set("trust proxy", 1);

// Resource policy is relaxed because the frontend calls this API, and renders
// locally stored media, from a different origin (5173 -> 5099).
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

const corsOptions = {
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Locally stored media is served as static files. Filenames are 32 random hex
// characters, so URLs are unguessable but not themselves access-controlled -
// the same property the Cloudinary secure_url path had.
if (storageDriver === "local") {
  app.use(
    "/uploads",
    express.static(uploadsDir, {
      fallthrough: false,
      index: false,
      dotfiles: "deny",
      maxAge: "1h",
    })
  );
}

app.use("/api", routes);
app.use(errorHandler);

export default app;
