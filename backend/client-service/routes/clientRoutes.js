const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const router = express.Router();

/**
 * Purpose: Provide a connection to share the SQLite database
 * Input: None
 * Ouput: Returns a live SQLite database connection object
 */
function getDb() {
  const dbPath = path.join(__dirname, '..', '..', 'shared-db', 'database.sqlite');
  return new sqlite3.Database(dbPath);
}

/**
 * Purpose: Returns a list of all events from the database
 * Input: None
 * Ouput: JSON array of events or error message if the query fails
 */
router.get('/events', (req, res) => {
  const db = getDb();
  db.all('SELECT id, name, date, tickets FROM events ORDER BY id;', [], (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ error: 'Failed to retrieve events.' });
    res.status(200).json(rows);
  });
});

/**
 * Purpose: Decreases ticket count by 1 for a specific event
 * Input: id - int, the ID of the event to purchase a ticket for
 *        database - read and update data in the events table
 * Ouput: JSON message confirming success or descriptive error message
 */
router.post('/events/:id/purchase', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const db = getDb();

  db.get('SELECT tickets FROM events WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error.' });
    if (!row) return res.status(404).json({ message: 'Event not found.' });
    if (row.tickets <= 0) return res.status(400).json({ message: 'Sold out.' });

    db.run('UPDATE events SET tickets = tickets - 1 WHERE id = ?', [id], (err2) => {
      db.close();
      if (err2) return res.status(500).json({ error: 'Failed to purchase ticket.' });
      res.json({ message: 'Purchase successful.' });
    });
  });
});

/**
 * Purpose: Uses an LLM to extract booking intent and event details from 
 *          natural-language input.
 * Input: JSON { text: "user’s natural language message" }.
 * Ouput: Structured JSON { event, tickets, intent } or a fallback object on error.
 */
router.post('/llm/parse', async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Missing "text" in request body.' });
  }

  try {
    console.log(`Parsing user text: ${text}`);

    // Send to Ollama (Llama 3)
    const response = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3',
        messages: [
          {
            role: 'system',
            content:
              'You are an intent parser that ONLY outputs JSON. Never include explanations or extra text.'
          },
          {
            role: 'user',
            content: `Extract structured data about an event booking. The JSON must include these fields: 
{ "event": string, "tickets": number, "intent": "book" | "cancel" | "query" }.
User text: "${text}". Reply ONLY with valid JSON, no prose or commentary.`
          }
        ],
        stream: false
      })
    });

    const data = await response.json();

    // Ollama sometimes wraps the text in data.message.content or in message[].content
    const messageContent =
      data?.message?.content ||
      data?.messages?.[0]?.content ||
      data?.output?.content ||
      JSON.stringify(data);

    let parsed;
    try {
      // Extract the first {...} JSON block if extra text sneaks in
      const match = messageContent.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    } catch (jsonErr) {
      console.warn('JSON parse failed. Content was:', messageContent);
      parsed = null;
    }

    if (!parsed) {
      return res.status(500).json({
        error: 'Failed to parse LLM response.',
        fallback: { event: 'Unknown Event', tickets: 1, intent: 'book' },
        raw: messageContent
      });
    }

    return res.json(parsed);
  } catch (err) {
    console.error('Ollama API error:', err);
    return res.status(500).json({
      error: 'Ollama call failed',
      fallback: { event: 'Unknown Event', tickets: 1, intent: 'book' },
      details: err.message
    });
  }
});

module.exports = router;