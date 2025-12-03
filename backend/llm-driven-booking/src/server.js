import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { parseController } from "./controllers/parseController.js";
import { confirmController } from "./controllers/confirmController.js";

dotenv.config();

const app = express();

// Configure CORS to support credentials and specific origins
const RAW_ALLOWED_ORIGINS = process.env.ALLOWED_ORIGIN || "http://localhost:3000,https://tiger-tixs.vercel.app";
const allowedOrigins = RAW_ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (origin.startsWith("http://localhost")) return callback(null, true);
      if (origin.startsWith("https://tiger-tixs.vercel.app")) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.log("[llm-driven-booking] Blocked CORS for origin:", origin, "Allowed:", allowedOrigins);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
  })
);
app.use(express.json());

// Health check endpoint for Render
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "llm-driven-booking" });
});

// LLM endpoints
app.post("/api/llm/parse", parseController);
app.post("/api/llm/confirm", confirmController);

/**
 * Purpose: Launches the LLM-driven booking microservice on the specified port
 * Input: None
 * Ouput: Active Express server and console confirmation message
 */
const PORT = parseInt(process.env.PORT, 10) || 6101;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`llm-driven-booking listening on ${PORT}`);
});
