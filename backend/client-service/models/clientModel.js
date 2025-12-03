import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, "../../shared-db/database.sqlite");

/**
 *  Purpose: Opens th SQL datbase and retuens an active connection
 *  Input: None
 *  Output: returns the connection object used for operations on 
 *          the SQL database
 */
async function openDB() {
  // Opens the database and returns the connection
  return open({ filename: DB_PATH, driver: sqlite3.Database });
}

/**
 *  Purpose: Retrieves all the events rcords from the SQL database and returns 
 *           them as an array of objects
 *  Input: None
 *  Output: An array of event objects containing ID, name, date and count 
 *          ticket
 */
export async function getAllEvents() {
  // Open a connection to the database
  const db = await openDB();
  try {
    // Query to select all events ordered by id
    return await db.all("SELECT id, name, date, tickets FROM events ORDER BY id;");
  } finally {
    // Close the database connection when done
    await db.close();
  }
}

/**
* Purpose: Handles the ticket purchase process by decrementing the available
*          ticket count for a specific event in the SQL database.
* Input: id, an integer representing the unique ID of the event to purchase
*        from.
* Output: Returns a status indicating whether the purchase was successful
*         and updates the event details accordingly.
*/
export async function purchaseTicket(id) {
    // Open a connection to the database
    const db = await openDB();
  try {
    // Start a transaction to ensure atomicity of the purchase operation
    await db.exec("BEGIN IMMEDIATE;");

    //  Fetches the current ticket count for the event
    const row = await db.get("SELECT tickets FROM events WHERE id = ?", [id]);
    if (!row) {
      await db.exec("ROLLBACK;");
      return { ok: false, code: 404, error: "Event not found" };
    }

    // Decrement the ticket count if tickets are available
    const upd = await db.run(
      "UPDATE events SET tickets = tickets - 1 WHERE id = ? AND tickets > 0;",
      [id]
    );
    if (upd.changes === 0) {
      await db.exec("ROLLBACK;");
      return { ok: false, code: 409, error: "Sold out" };
    }
    // Fetch the updated event details
    const updated = await db.get(
      "SELECT id, name, date, tickets FROM events WHERE id = ?",
      [id]
    );
    await db.exec("COMMIT;");
    return { ok: true, event: updated };
  } catch (e) {
    await db.exec("ROLLBACK;");
    throw e;
  } finally {
    await db.close();
  }
}