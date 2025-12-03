import React, { useEffect, useState, useRef } from "react";
import "./App.css";

function App() {
  // Auth state - separate for login and register so inputs don't mirror each other
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [authToken, setAuthToken] = useState(null);

  // Backend bases (use env vars in production, fallback to localhost for dev)
  const AUTH_BASE = process.env.REACT_APP_AUTH_BASE || 'http://localhost:4000';
  const CLIENT_BASE = process.env.REACT_APP_CLIENT_BASE || 'http://localhost:6001';
  const LLM_BASE = process.env.REACT_APP_LLM_BASE || 'http://localhost:6101';
  const ADMIN_BASE = process.env.REACT_APP_ADMIN_BASE || 'http://localhost:5001';

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const eventsRef = useRef([]);
  const [pendingBooking, setPendingBooking] = useState(null);
  const bookingRef = useRef(pendingBooking);

  // Admin form state
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminEventName, setAdminEventName] = useState('');
  const [adminEventDate, setAdminEventDate] = useState('');
  const [adminEventTickets, setAdminEventTickets] = useState('');

useEffect(() => {
  bookingRef.current = pendingBooking;
}, [pendingBooking]);

// On mount, check session
useEffect(() => {
  const checkSession = async () => {
    try {
      const res = await fetch(`${AUTH_BASE}/me`, { credentials: 'include' });
      if (!res.ok) {
        setIsAuthenticated(false);
        setUserEmail(null);
        setAuthToken(null);
        return;
      }
      const data = await res.json();
      if (data.authenticated) {
        setIsAuthenticated(true);
        setUserEmail(data.email);
        // Note: token will be set on login, not available from /me endpoint
      } else {
        setIsAuthenticated(false);
        setUserEmail(null);
        setAuthToken(null);
      }
    } catch (err) {
      console.error('Session check failed', err);
      setIsAuthenticated(false);
      setUserEmail(null);
      setAuthToken(null);
    }
  };
  checkSession();
}, []);

/**
 * Purpose: Fetches and displays event data from the backend when the component loads
 * Input: setEvent - updates the list of event in state
 *        eventRef - keeps a persistent reference to the latest event data
 *        setLoading - toggles loading status for the UI.
 *        HTTP request - sents a request to the backend for the events
 * Ouput: Updates events state, logs data, and stops the loading spinner
 */
  useEffect(() => {
    fetch(`${CLIENT_BASE}/api/events`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch events");
        return res.json();
      })
      .then((data) => {
        setEvents(data);
        eventsRef.current = data;

        console.log("Events fetched from backend:", data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching events:", err);
        setLoading(false);
      });
  }, []);

/**
 * Purpose: Purchases one ticket for a selected event and updates the UI
 * Input: id - int, The unique ID of the event to purchase a ticket for
 *        name - String, The event name, used for the success alert message
 * Ouput: Success or error alert + updated event list in state
 */
  const buyTicket = async (id, name) => {
    try {
      const res = await fetch(
        `${CLIENT_BASE}/api/events/${id}/purchase`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({ quantity: 1 }),
          credentials: 'include',
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const errorMsg = errorData?.error || errorData?.message || "Purchase failed";
        // If auth error, clear token and prompt re-login
        if (res.status === 401) {
          setAuthToken(null);
          setIsAuthenticated(false);
          throw new Error("Session expired. Please log in again.");
        }
        throw new Error(errorMsg);
      }

      alert(`Ticket purchased for: ${name}`);
      setEvents((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, tickets: (e.tickets ?? 0) - 1 } : e
        )
      );
    } catch (err) {
      console.error("Error purchasing ticket:", err);
      alert(`${err.message}`);
    }
  };

  // Auth actions
  const register = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${AUTH_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registerEmail, password: registerPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Register failed');
      // clear register fields on success
      setRegisterPassword('');
      setRegisterEmail('');
      alert('Registered. You can now log in.');
    } catch (err) {
      console.error('Register error', err);
      alert(err.message);
    }
  };

  const login = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${AUTH_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      setIsAuthenticated(true);
      setUserEmail(data.email);
      if (data.token) setAuthToken(data.token);
      setLoginPassword('');
      alert('Logged in');
    } catch (err) {
      console.error('Login error', err);
      alert(err.message);
    }
  };

  const logout = async () => {
    try {
      const res = await fetch(`${AUTH_BASE}/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Logout failed');
      setIsAuthenticated(false);
      setUserEmail(null);
      setProfileData(null);
      setAuthToken(null);
      alert('Logged out');
    } catch (err) {
      console.error('Logout error', err);
      alert(err.message || 'Logout error');
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${AUTH_BASE}/profile`, { credentials: 'include' });
      if (!res.ok) {
        // token might be expired
        setIsAuthenticated(false);
        setUserEmail(null);
        setProfileData(null);
        setAuthToken(null);
        alert('Session expired. Please log in again.');
        return;
      }
      const data = await res.json();
      setProfileData(data);
    } catch (err) {
      console.error('Profile fetch error', err);
      alert('Could not fetch profile');
    }
  };

  // Admin: Create new event
  const createEvent = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${ADMIN_BASE}/api/admin/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: adminEventName,
          date: adminEventDate,
          tickets: parseInt(adminEventTickets, 10)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create event');
      alert(`Event "${data.event.name}" created!`);
      // Refresh events list
      const refreshRes = await fetch(`${CLIENT_BASE}/api/events`);
      const refreshData = await refreshRes.json();
      setEvents(refreshData);
      eventsRef.current = refreshData;
      // Clear form
      setAdminEventName('');
      setAdminEventDate('');
      setAdminEventTickets('');
      setShowAdminForm(false);
    } catch (err) {
      console.error('Create event error', err);
      alert(err.message);
    }
  };

/**
 * Purpose: Enables speech-to-text interaction for booking and event queries
 * Input: Microphone click + spoken words
 * Ouput: Recognized text sent to LLM service and displayed in chat
 */
useEffect(() => {
  const initVoiceAssistant = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (process.env.NODE_ENV !== 'test') {
        alert("Speech Recognition not supported in this browser.");
      }
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    const micBtn = document.getElementById("mic-btn");
    const beep = document.getElementById("beep-sound");
    const chatWindow = document.getElementById("chat-window");

    if (!micBtn || !chatWindow) {
      console.warn("Voice elements not found yet — retrying...");
      setTimeout(initVoiceAssistant, 300);
      return;
    }

    micBtn.addEventListener("click", () => {
      if (beep) {
        beep.currentTime = 0;
        beep.play().catch(() => console.warn("Beep sound failed to play."));
      }
      setTimeout(() => recognition.start(), 400);
    });

    recognition.addEventListener("result", async (event) => {
      const text = event.results[0][0].transcript;

      const msg = document.createElement("div");
      msg.className = "user-msg";
      msg.textContent = text;
      chatWindow.appendChild(msg);

      await sendToLLM(text, chatWindow);
    });

    recognition.addEventListener("speechend", () => recognition.stop());
    recognition.addEventListener("error", (e) =>
      console.error("Speech error:", e.error)
    );
  };

  // Run setup after short delay to ensure DOM loaded
  setTimeout(initVoiceAssistant, 500);
}, []);


/**
 * Purpose: Handles both normal and confirmation interactions with the LLM service
 * Input: text - string, The text recognized from the user’s speech
 * Ouput: Chat and voice responses, booking confirmations, or fallback errors
 */
const sendToLLM = async (text, chatWindow) => {
  try {
    // Handle confirmation keywords first
    if (bookingRef.current) {
      const response = text.toLowerCase();
      const current = bookingRef.current; // latest booking info

      console.log("DEBUG - current bookingRef:", bookingRef.current);
      console.log("DEBUG - all events fetched from DB:", eventsRef.current);

      if (response.includes("yes")) {
        const normalize = (str) =>
          str
            .toLowerCase()
            .replace(/[^a-z0-9 ]/g, "")
            .replace(/\s+/g, " ")
            .trim();

        const normalizedTarget = normalize(current.event);
        console.log("🔎 Normalized target:", normalizedTarget);

        console.log("Available events:");
        eventsRef.current.forEach((e, i) =>
          console.log(`  [${i}] ${normalize(e.name)}`)
        );

        // Find best match among current events
        let bestMatch = null;
        let highestScore = 0;

        for (const e of eventsRef.current) {
          const normalizedEvent = normalize(e.name);
          const targetWords = new Set(normalizedTarget.split(" "));
          const eventWords = new Set(normalizedEvent.split(" "));
          const intersection = [...targetWords].filter((w) =>
            eventWords.has(w)
          ).length;
          const union = new Set([...targetWords, ...eventWords]).size;
          const score = intersection / union;

          if (score > highestScore) {
            highestScore = score;
            bestMatch = e;
          }
        }

        console.log("Best match:", bestMatch?.name, "score:", highestScore);

        if (!bestMatch || highestScore < 0.25) {
          speakResponse(
            "Sorry, I couldn’t find that event to complete the booking."
          );
          const failMsg = document.createElement("div");
          failMsg.className = "bot-msg";
          failMsg.textContent = "Could not find the event. Please try again.";
          chatWindow.appendChild(failMsg);
          setPendingBooking(null);
          return;
        }

        // Proceed with booking
        const res = await fetch(
          `${CLIENT_BASE}/api/events/${bestMatch.id}/purchase`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
            body: JSON.stringify({ quantity: current.tickets }),
          }
        );

        if (res.ok) {
          speakResponse(`Your tickets for ${bestMatch.name} have been booked.`);
          const successMsg = document.createElement("div");
          successMsg.className = "bot-msg";
          successMsg.textContent = `Successfully booked ${current.tickets} ticket(s) for ${bestMatch.name}!`;
          chatWindow.appendChild(successMsg);

          setEvents((prev) =>
            prev.map((e) =>
              e.id === bestMatch.id
                ? { ...e, tickets: (e.tickets ?? 0) - current.tickets }
                : e
            )
          );
        } else {
          // Handle auth errors
          if (res.status === 401) {
            setAuthToken(null);
            setIsAuthenticated(false);
            speakResponse("Your session expired. Please log in again.");
          } else {
            speakResponse("Sorry, I couldn't complete the booking.");
          }
        }

        setPendingBooking(null);
        return;
      }
    }

    // Normal LLM request (no confirmation yet)
    const res = await fetch(`${LLM_BASE}/api/llm/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) throw new Error("LLM backend not responding");
    const data = await res.json();

    const reply = document.createElement("div");
    reply.className = "bot-msg";

    if (data.intent === "propose_booking") {
      reply.textContent = `I found ${data.event} with ${data.tickets} ticket(s). Would you like to confirm this booking?`;
      chatWindow.appendChild(reply);
      speakResponse(reply.textContent);
      setPendingBooking({ event: data.event, tickets: data.tickets }); // store booking info
    } else if (data.intent === "show_events") {
      reply.textContent = "Here are the available events on campus.";
      chatWindow.appendChild(reply);
      speakResponse(reply.textContent);
    } else {
      reply.textContent = `You said: "${text}"`;
      chatWindow.appendChild(reply);
      speakResponse(`You said ${text}`);
    }
  } catch (err) {
    console.error("LLM error:", err);
    const failMsg = document.createElement("div");
    failMsg.className = "bot-msg";
    failMsg.textContent = "Sorry, I could not reach the LLM service.";
    chatWindow.appendChild(failMsg);
    speakResponse(failMsg.textContent);
  }
};


/**
 * Purpose: Provides clear spoken feedback for chatbot responses
 * Input: text - String, The message the chatbot should vocalize
 * Ouput: Audible speech via the system’s default voice
 */
  const speakResponse = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  // Always render the main UI; show loading/empty states within the events section

/**
 * Purpose: Displays the full TigerTix frontend with event listings and a
 *          voice-enabled chatbot interface
 * Input: Event data from backend and speech/text commands
 * Ouput: Accessible, interactive user interface for booking tickets by voice or button click
 */
  return (
    <main className="App">
      <h1 tabIndex="0">Clemson Campus Events</h1>

      {/* Admin panel toggle */}
      <section style={{ padding: 12, marginBottom: 12, textAlign: 'center' }}>
        <button onClick={() => setShowAdminForm(!showAdminForm)} style={{ marginBottom: 8 }}>
          {showAdminForm ? 'Hide Admin Panel' : 'Show Admin Panel'}
        </button>
        {showAdminForm && (
          <form onSubmit={createEvent} style={{ padding: 12, border: '1px solid #ccc', borderRadius: 4, maxWidth: 400, margin: '0 auto' }}>
            <h3 style={{ marginTop: 0 }}>Create New Event</h3>
            <div style={{ marginBottom: 8 }}>
              <input
                id="admin-event-name"
                placeholder="Event Name"
                value={adminEventName}
                onChange={e => setAdminEventName(e.target.value)}
                required
                style={{ width: '100%', padding: 6 }}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <input
                id="admin-event-date"
                type="date"
                value={adminEventDate}
                onChange={e => setAdminEventDate(e.target.value)}
                required
                style={{ width: '100%', padding: 6 }}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <input
                id="admin-event-tickets"
                type="number"
                placeholder="Number of Tickets"
                value={adminEventTickets}
                onChange={e => setAdminEventTickets(e.target.value)}
                required
                min="0"
                style={{ width: '100%', padding: 6 }}
              />
            </div>
            <button type="submit" style={{ width: '100%', padding: 8 }}>Create Event</button>
          </form>
        )}
      </section>

      {/* Simple auth area */}
      <section style={{ padding: 12, marginBottom: 12, alignItems: 'center', display: 'flex', flexDirection: 'column' }}>
        {isAuthenticated ? (
          <div>
            {!profileData && (
              <strong>Logged in as {userEmail}</strong>
            )}
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <button id="logout-button" className="logout-button" onClick={logout}>Logout</button>
              <button id="view-profile-button" className="view-profile-button" onClick={fetchProfile}>View Profile</button>
            </div>
            {profileData && (
              <div style={{ marginTop: 12, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
                <h3 style={{ marginTop: 0 }}>Profile Information</h3>
                <p><strong>Email:</strong> {profileData.email}</p>
                <p><strong>User ID:</strong> {profileData.id}</p>
                <button id="close-profile-button" className="close-profile-button" onClick={() => setProfileData(null)} style={{ marginTop: 8 }}>Close Profile</button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <form onSubmit={login} style={{ display: 'inline-block', marginRight: 8 }}>
              <input id="login-email" className="login-email" placeholder="login email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
              <input id="login-password" className="login-password" placeholder="login password" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
              <button type="submit" id="login-button" className="login-button">Login</button>
            </form>

            <form onSubmit={register} style={{ display: 'inline-block' }}>
              <input id="register-email" className="register-email" placeholder="Register Email" value={registerEmail} onChange={e => setRegisterEmail(e.target.value)} />
              <input id="register-password" className="register-password" placeholder="Register Password" type="password" value={registerPassword} onChange={e => setRegisterPassword(e.target.value)} />
              <button type="submit" id="register-button" className="register-button">Register</button>
            </form>
          </div>
        )}
      </section>

      {/* Voice Interface Section */}
      <div id="voice-interface">
        <h3>Voice Assistant</h3>
        <div id="chat-window" aria-live="polite"></div>
        <button id="mic-btn" className="mic-btn">
          🎤 Speak
        </button>
        <audio id="beep-sound" src="beep.mp3" preload="auto"></audio>
      </div>

      {/* Event list */}
      {loading ? (
        <h2>Loading...</h2>
      ) : !events.length ? (
        <h2>No events found.</h2>
      ) : (
        <ul>
          {events.map((event) => {
            const available = event.tickets ?? 0;
            return (
              <li key={event.id}>
                <article aria-label={`Event: ${event.name}`} tabIndex="0">
                  <h2>{event.name}</h2>
                  <p>Date: {event.date}</p>
                  <p>Tickets available: {available}</p>
                  <button
                    onClick={() => buyTicket(event.id, event.name)}
                    disabled={available <= 0}
                    aria-disabled={available <= 0}
                    aria-label={
                      available > 0
                        ? `Buy ticket for ${event.name}`
                        : `${event.name} is sold out`
                    }
                    style={{
                      outline:
                        available > 0 ? "2px solid orange" : "2px solid purple",
                    }}
                  >
                    {available > 0
                      ? `Buy Ticket for ${event.name}`
                      : "Sold Out"}
                  </button>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

export default App;
