import express from "express";
import cors from "cors";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const sharedDbPath = path.join(__dirname, "..", "shared-db", "database.sqlite");
const initSqlPath = path.join(__dirname, "..", "shared-db", "init.sql");

/**
 * Purpose: Open the SQLite daatabase and create tables or seed data
 * Input: dbPath - String, The file path of the database
 *        initPath - String, The file path to an .sql script for 
 *                   updating the database
 * Output: returns a console log
 */
async function runSetup(dbPath, initPath) {
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  const sql = fs.readFileSync(initPath, "utf8");
  await db.exec(sql);
  console.log("Admin database initialized.");
  return db;
}

let db;
runSetup(sharedDbPath, initSqlPath).then((database) => (db = database));

/**
 * Purpose: Create new event record in the database through the admin 
 *          service backend
 * Input: JSON object which includes the name, dte amd number of tickets
 * Ouput: return a success or failure message
 */
app.post("/api/admin/events", async (req, res, next) => {
  try {
    const { name, date, tickets } = req.body;

    // Validate inputs
    if (typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: 'Invalid "name": non-empty string required' });
    }
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid "date": expected YYYY-MM-DD' });
    }
    const ticketsNum = Number(tickets);
    if (!Number.isInteger(ticketsNum) || ticketsNum < 0) {
      return res.status(400).json({ error: 'Invalid "tickets": non-negative integer required' });
    }

    const result = await db.run(
      "INSERT INTO events (name, date, tickets) VALUES (?, ?, ?)",
      [name.trim(), date, ticketsNum]
    );

    const inserted = { id: result.lastID, name: name.trim(), date, tickets: ticketsNum };
    return res.status(201).json({ message: "Event created", event: inserted });
  } catch (err) {
    next(err);
  }
});

/**
 * Purpose: Retrieve all events (admin view / debugging)
 * Input: none
 * Output: JSON array of events or error
 */
app.get("/api/admin/events", async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not ready" });
    const events = await db.all("SELECT * FROM events ORDER BY id ASC");
    return res.json(events);
  } catch (err) {
    next(err);
  }
});

/**
 * Purpose: Update an existing event in the database
 * Input: id - int, the ID of the event to update
 *        JSON object which includes the name, dte amd number of tickets
 * Ouput: return a success or failure message
 */
app.put("/api/admin/events/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid event id" });
    }

    const { name, date, tickets } = req.body;

    if (typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: 'Invalid "name": non-empty string required' });
    }
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid "date": expected YYYY-MM-DD' });
    }
    const ticketsNum = Number(tickets);
    if (!Number.isInteger(ticketsNum) || ticketsNum < 0) {
      return res.status(400).json({ error: 'Invalid "tickets": non-negative integer required' });
    }

    const result = await db.run(
      "UPDATE events SET name = ?, date = ?, tickets = ? WHERE id = ?",
      [name.trim(), date, ticketsNum, id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    return res.status(200).json({
      message: "Event updated",
      event: { id, name: name.trim(), date, tickets: ticketsNum }
    });
  } catch (err) {
    next(err);
  }
});


/**
 * Purpose: catches and handles any errors that occur during request processing 
 *          in the admin-service API
 * Input: Error object - The error passed from any route
 *        req - The Express request object that triggered the error
 *        res - The Express request object that triggered the error
 *        next - The next middleware function
 * Ouput: A clear error message and appropriate HTTP status code returned to the client
 */
app.use((err, req, res, next) => {
  console.error("Admin service error:", err);
  const status = err.statusCode || 500;
  res.status(status).json({ error: err.message || "Internal Server Error" });
});

/**
 * Purpose: starts the Express server for the admin-service and listening on a 
 *          specified port.
 * Input: app - Express Application, The configured Express instance containing 
 *        all routes and middleware.
 * Ouput: Prints success message and the express app begins
 */
const PORT = parseInt(process.env.PORT, 10) || 5001;
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Admin service listening on ${PORT}`);
  });
}

export default app;
