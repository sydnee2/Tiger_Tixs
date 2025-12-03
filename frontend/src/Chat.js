// src/Chat.js
import React, { useState, useRef } from "react";

function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const recognitionRef = useRef(null);

  // Start speech recognition
  const handleVoiceInput = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech Recognition not supported in this browser.");
      return;
    }

    // play short beep
    const beep = new Audio("/beep.mp3");
    beep.play();

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      sendToLLM(transcript);
    };

    recognition.onerror = (err) => console.error("Speech error:", err);
    recognition.start();
    recognitionRef.current = recognition;
  };

  //Send recognized text to LLM backend
  const sendToLLM = async (text) => {
    setMessages((prev) => [...prev, { sender: "user", text }]);

    try {
      const res = await fetch("http://localhost:6101/api/llm/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();
      const reply = `I found the event "${data.event}" with ${data.tickets} tickets. Would you like to confirm the booking?`;

      setMessages((prev) => [...prev, { sender: "llm", text: reply }]);
      speakResponse(reply);
    } catch (err) {
      console.error("LLM Error:", err);
    }
  };

  //Speak the LLM's response
  const speakResponse = (text) => {
    const synth = window.speechSynthesis;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = 0.95;
    synth.speak(utter);
  };

  return (
    <div className="chat-container">
      <h2>TigerTix Voice Assistant</h2>

      <div className="chat-window">
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.sender}`}>
            {m.text}
          </div>
        ))}
      </div>

      <div className="chat-controls">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type or speak your request..."
        />
        <button onClick={() => sendToLLM(input)}>Send</button>
        <button onClick={handleVoiceInput}></button>
      </div>
    </div>
  );
}

export default Chat;
