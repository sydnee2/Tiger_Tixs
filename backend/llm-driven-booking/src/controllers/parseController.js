import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const CLIENT_BASE = process.env.CLIENT_BASE || "http://localhost:6001";
const OLLAMA_HOST = process.env.OLLAMA_HOST || process.env.OLLAMA_API_URL || "http://localhost:11434";
const LLM_PROVIDER = (process.env.LLM_PROVIDER || "ollama").toLowerCase();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

/**
 * Purpose: Finds the closest-matching event name from a list based on user text
 * Input: UserEvent - string, The event name
 *        eventList - Array of String, a list of vaild event names
 * Ouput: Closest matching event name or "Unknown Event"
 */
function findClosestEvent(userEvent, eventList) {
  if (!userEvent || !eventList.length) return "Unknown Event";

  // normalize: lowercase, remove punctuation and parentheses
  const normalize = (str) =>
    str.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

  const user = normalize(userEvent);

  let bestMatch = "Unknown Event";
  let highestScore = 0;

  for (const event of eventList) {
    const candidate = normalize(event);

    // token overlap score
    const userWords = user.split(/\s+/);
    const candWords = candidate.split(/\s+/);

    const matches = userWords.filter((w) => candWords.includes(w)).length;
    const score = matches / Math.max(userWords.length, candWords.length);

    if (score > highestScore) {
      highestScore = score;
      bestMatch = event;
    }
  }

  // if at least 1 keyword overlaps or 40% similarity, consider it matched
  return highestScore >= 0.4 ? bestMatch : "Unknown Event";
}

/**
 * Purpose: Converts user text into structured booking intent using Llama 3.1
 * Input: JSON object, user message
 * Ouput: JSON object with { intent, event, tickets } or a safe fallback on failure.
 */
export const parseController = async (req, res) => {
  try {
    const { text } = req.body;

    // 1 Fetch events dynamically
    const eventRes = await fetch(`${CLIENT_BASE}/api/events`);
    const eventData = await eventRes.json();
    const eventNames = eventData.map((e) => e.name);

    // 2 Build LLM prompt
    const prompt = `
You are a natural language parser for the Clemson University ticket booking chatbot.

Available events:
${eventNames.map((e) => `- ${e}`).join("\n")}

Extract user intent ("propose_booking", "show_events", or "other"),
event name (if possible), and number of tickets (default 1).

Respond with **only JSON**, for example:
{
  "intent": "propose_booking",
  "event": "Clemson Football Hate Watch",
  "tickets": 2
}

User: ${text}
`;

    // 3 Query LLM provider
    let responseText = "";
    if (LLM_PROVIDER === "openai") {
      if (!OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER=openai");
      }
      const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1/chat/completions";
      const result = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [
            { role: "system", content: "You extract booking intents and must respond ONLY with strict JSON object containing keys: intent, event, tickets. No markdown, no extra text." },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          response_format: { type: "json_object" }
        }),
      });
      const data = await result.json();
      responseText = data?.choices?.[0]?.message?.content?.trim() || "";
      console.log("LLM(OpenAI) raw output:", responseText);
    } else {
      const result = await fetch(`${OLLAMA_HOST}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || "llama3.1:latest",
          prompt,
          stream: false,
        }),
      });
      const data = await result.json();
      responseText = data.response?.trim() || "";
      console.log("LLM(Ollama) raw output:", responseText);
    }

  
    // 4 Extract valid JSON from model output
    // Clean response text: remove comments, trailing commas, etc.
    let cleaned = responseText
      .replace(/\/\/.*$/gm, "")
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    let parsed;

    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (err) {
        console.error("JSON parse failed:", err);
        console.warn("Raw (cleaned) text was:", cleaned);
        parsed = { intent: "other", event: "Unknown Event", tickets: 1 };
      }
    } else {
      console.warn("No JSON found in LLM output:", cleaned);
      parsed = { intent: "other", event: "Unknown Event", tickets: 1 };
    }

    // Heuristic fallback if model didn't classify
    if (!parsed.intent || parsed.intent === "other") {
      const lower = (text || "").toLowerCase();
      const wantsBooking = /(buy|purchase|book|reserve)/.test(lower);
      const wantsList = /(show|list|what|which).*events|events\??/.test(lower);
      const numMatch = lower.match(/(\d{1,2})\s*(tickets|tix|seats)?/);
      const tickets = numMatch ? parseInt(numMatch[1], 10) : 1;
      const bestEvent = findClosestEvent(text, eventNames);
      if (wantsList && !wantsBooking) {
        parsed = { intent: "show_events", event: "Unknown Event", tickets: 1 };
      } else if (wantsBooking) {
        parsed = { intent: "propose_booking", event: bestEvent, tickets: Math.max(1, tickets) };
      }
    }

    // 5 Apply fuzzy matching to correct event name
    if (parsed.event === "Unknown Event" || !eventNames.includes(parsed.event)) {
      const corrected = findClosestEvent(parsed.event || text, eventNames);
      parsed.event = corrected;
    }

    // 6 Ensure tickets default to 1
    if (!parsed.tickets || parsed.tickets <= 0) parsed.tickets = 1;

    return res.json(parsed);
  } catch (err) {
    console.error("Parse error:", err);
    return res
      .status(500)
      .json({ error: "Failed to parse natural language input." });
  }
};
