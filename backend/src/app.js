import express from "express";
import cors from "cors";
import helmet from "helmet";
import routes from "./routes/index.js";
import errorHandler from "./middleware/errorHandler.js";

const app = express();

// Rate limiters key off the client IP, which is the proxy's unless we trust it.
app.set("trust proxy", 1);

// This app only ever serves JSON, so the CSP that helmet applies by default
// costs nothing. Resource policy is relaxed because the frontend calls this
// API from a different origin (5173 -> 5099).
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

app.use("/api", routes);
app.use(errorHandler);

export default app;
