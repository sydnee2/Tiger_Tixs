import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

/**
 * Purpose: Allows requests only from localhost and blocks external origins.
 * Input: Incoming request’s Origin header and allowed HTTP methods.
 * Ouput: CORS headers for valid requests or an error for disallowed origins.
 */
// Support comma-separated list of allowed origins (e.g. https://app.vercel.app,https://other.site)
const RAW_ALLOWED_ORIGINS = process.env.ALLOWED_ORIGIN || 'http://localhost:3000,https://clemson-ticketing-system.vercel.app,http://150.136.222.183:3000';
const allowedOrigins = RAW_ALLOWED_ORIGINS.split(",").map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // non-browser or same-origin
    if (origin.startsWith("http://localhost")) return callback(null, true);
    if (origin.startsWith("https://clemson-ticketing-system.vercel.app")) return callback(null, true);
    if (origin.startsWith("http://150.136.222.183:3000")) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.log("[client-service] Blocked CORS for origin:", origin, "Allowed:", allowedOrigins);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
}));
app.use(express.json()); 
app.use(cookieParser());

// Health check endpoint for Render
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "client-service" });
});

// Use absolute database path
const dbPath = path.join(__dirname, "..", "shared-db", "database.sqlite");
const initSqlPath = path.join(__dirname, "..", "shared-db", "init.sql");
console.log("Using DB at:", dbPath);

let db;
(async () => {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  // Run init.sql to create tables and seed data
  const sql = fs.readFileSync(initSqlPath, "utf8");
  await db.exec(sql);

  console.log("Database initialized and ready.");
})();

// Simple health endpoint for deployment diagnostics
app.get('/health', (req, res) => {
  res.json({ status: 'ok', dbReady: !!db });
});

/**
 * Purpose: Retrieve and return all events from the database
 * Input: None
 * Ouput: JSON array of all events or a JSON error message on failure
 */
app.get("/api/events", async (req, res) => {
  try {
    const events = await db.all("SELECT * FROM events");
    res.json(events);
  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

/**
 * Purpose: Safely processes a ticket purchase using SQLite transactions
 * Input: id - int/string, The unique event ID for which tickets are being purchased
 *        JSON object, number of tickets
 * Ouput: Success confirmation or error message with rollback protection
 */
// JWT auth middleware: accepts token from cookie 'token' or Authorization header
function authenticateToken(req, res, next) {
  const token = req.cookies?.token || req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const JWT_SECRET = process.env.JWT_SECRET || 'replace_with_a_strong_secret';
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = { id: payload.id, email: payload.email };
    next();
  });
}

app.post("/api/events/:id/purchase", authenticateToken, async (req, res) => {
  const eventId = req.params.id;
  const { quantity } = req.body;

  if (!quantity || quantity <= 0) {
    return res.status(400).json({ error: "Invalid ticket quantity" });
  }

  try {
    await db.exec("BEGIN TRANSACTION");

    const event = await db.get("SELECT * FROM events WHERE id = ?", [eventId]);
    if (!event) {
      await db.exec("ROLLBACK");
      return res.status(404).json({ error: "Event not found" });
    }

    if (event.tickets < quantity) {
      await db.exec("ROLLBACK");
      return res.status(409).json({ error: "Not enough tickets available" });
    }

    const remaining = event.tickets - quantity;
    await db.run("UPDATE events SET tickets = ? WHERE id = ?", [
      remaining,
      eventId,
    ]);

    await db.exec("COMMIT");

    console.log(`Purchased ${quantity} ticket(s) for ${event.name}`);
    res.json({
      success: true,
      eventId,
      purchased: quantity,
      remainingTickets: remaining,
    });
  } catch (err) {
    await db.exec("ROLLBACK");
    console.error("Ticket purchase error:", err);
    res.status(500).json({ error: err.message });
  }
});


/**
 * Purpose: Starts the Express server for the client-service
 * Input: Environment variables PORT and NODE_ENV
 * Ouput: Console log confirmation and a running HTTP server instance
 */
const PORT = parseInt(process.env.PORT, 10) || 6001;
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Client service listening on ${PORT}`);
  });
}

export default app;

