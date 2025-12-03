import { getAllEvents, purchaseTicket } from "../models/clientModel.js";

/**
* Purpose: Retrieves all events from the database and returns
*          them as a JSON response.
* Input: _req, object, representing the incoming request,and
*        res, object, used to send the HTTP response.
* Output: Sends a JSON response containing all events or an
*         error message if the request fails.
*/
export async function listEvents(_req, res) {
  try {
    // Fetch all the rows in the database
    const events = await getAllEvents();
    return res.status(200).json({ events });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}

/**
* Purpose: Handles ticket purchase requests by validating the 
*          event ID and processing the transaction through 
*          the model.
* Input: req, object, containing the event ID, and res, 
*        object, used to send HTTP responses.
* Output: Sends a JSON response indicating whether the
*         purchase was successful or not.
*/
export async function purchase(req, res) {
  // Reads the id from the URL parameter
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid event id" });
  }
  try {
    // Calls the model function to decrement the ticket count
    const result = await purchaseTicket(id);
    if (!result.ok) {
        return res.status(result.code).json({ error: result.error });
    }
    return res.status(200).json({ message: "Purchase successful", event: result.event });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
