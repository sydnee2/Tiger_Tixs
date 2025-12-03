/**
 * adminModel.js
 * Purpose: Handles all database operations for the admin service.
 * Exports: insertEvent({ name, date, tickets })
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to the shared DB file
const dbPath = path.join(__dirname, '..', '..', 'shared-db', 'database.sqlite');

/**
 * Purpose: To insert a new event record into the SQLite database.
 * Input: 
 *   - eventData: an object containing 
 *       name (string), name of the event
 *       date (string), date of the event in 'YYYY-MM-DD' format
 *       tickets (number), number of available tickets
 * Output: 
 *   - Returns a Promise that resolves to an object with the inserted event’s
 *       id, name, date, and tickets.
 *   - If an error occurs during insertion, the Promise is rejected with an error.
 */
function insertEvent(eventData) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);

    const sql = `
      INSERT INTO events (name, date, tickets)
      VALUES (?, ?, ?)
    `;
    const params = [eventData.name, eventData.date, eventData.tickets];

    db.run(sql, params, function (err) {
      if (err) {
        db.close();
        return reject(err);
      }
      const inserted = {
        id: this.lastID,
        ...eventData
      };
      db.close();
      resolve(inserted);
    });
  });
}

/**
 * Purpose: To export the insertEvent function so other files (like the controller)
 *           can use it for database operations.
 * Input: None
 * Output: Exports an object containing the insertEvent function.
 */
module.exports = { insertEvent };
