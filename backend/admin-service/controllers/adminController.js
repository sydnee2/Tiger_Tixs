/**
 * adminController.js
 * Purpose: Validate input and call model for DB writes. Sends proper HTTP responses.
 */
const { insertEvent } = require('../models/adminModel');

/**
 * Purpose: To handle POST requests sent to the admin service for creating new ticketed events.
 * Input: 
 *   - req: contains body with fields: string name, string date, number tickets
 *   - res: used to send success or error responses
 *   - next: used to pass errors to the global error handler
 * Output: 
 *   - Returns an HTTP response with:
 *     Status 201 and a JSON object containing the newly created event if successful
 *     Status 400 or 500 and an error message if validation fails or an internal error occurs
 */
async function createEvent(req, res, next) {
  try {
    const { name, date, tickets } = req.body;

    // validation (accepts/validates JSON input)
    if (typeof name !== 'string' || name.trim().length === 0) {
      const e = new Error('Invalid "name": non-empty string required');
      e.statusCode = 400;
      throw e;
    }

    // YYYY-MM-DD formating check
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const e = new Error('Invalid "date": expected YYYY-MM-DD');
      e.statusCode = 400;
      throw e;
    }

    const ticketsNum = Number(tickets);
    if (!Number.isInteger(ticketsNum) || ticketsNum < 0) {
      const e = new Error('Invalid "tickets": non-negative integer required');
      e.statusCode = 400;
      throw e;
    }

    // Handles DB
    const inserted = await insertEvent({ name: name.trim(), date, tickets: ticketsNum });

    // Success
    return res.status(201).json({
      message: 'Event created',
      event: inserted
    });
  } catch (err) {
    // 400 for validation, 500 otherwise
    if (!err.statusCode) err.statusCode = 500;
    return next(err);
  }
}

/**
 * Purpose: To export the createEvent function so it can be used by the admin routes file.
 * Input: None
 * Output: Exports an object containing the createEvent function
 */
module.exports = { createEvent };
