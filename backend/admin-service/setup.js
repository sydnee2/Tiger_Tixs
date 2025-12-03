/**
 * setup.js
 * Purpose: Initializes the shared SQLite database using init.sql (idempotent).
 */
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

/**
 * Purpose: To read the SQL setup file and execute its commands to ensure
 *          all required tables exist in the shared SQLite database.
 * Input: 
 *   - dbFilePath: string, file path to the SQLite database file
 *   - initSqlPath: string, file path to the SQL initialization script (init.sql)
 * Output: 
 *   - Executes the SQL commands to create/verify database tables.
 *   - Logs a success message if complete, or an error message if a failure occurs.
 */
module.exports = function runSetup(dbFilePath, initSqlPath) {
  const sql = fs.readFileSync(initSqlPath, 'utf8');
  const db = new sqlite3.Database(dbFilePath);

  db.serialize(() => {
    db.exec(sql, (err) => {
      if (err) {
        console.error('DB setup error:', err);
      } else {
        console.log('DB setup complete / verified.');
      }
    });
  });

  db.close();
};
