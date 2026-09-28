// NutriBot chat logic (vanilla JS only).
// Keeps a small conversation history so follow-up questions
// like "What foods contain it?" still make sense to the AI.

const chatBox = document.getElementById("chatBox");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");

const HISTORY_KEY = "nutribot_history"; // simple browser storage, no accounts
const MAX_HISTORY = 10;                 // recent messages sent to the API

// Conversation history: [{ role: "user"|"assistant", content: "..." }]
let conversation = loadHistory();
renderHistory();

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(conversation));
  } catch {
    // Storage full or unavailable - chat still works for this session.
  }
}

function addBubble(text, sender) {
  const row = document.createElement("div");
  row.className = "message " + sender;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  row.appendChild(bubble);
  chatBox.appendChild(row);
  chatBox.scrollTop = chatBox.scrollHeight; // auto-scroll
}

function renderHistory() {
  chatBox.innerHTML = "";
  for (const msg of conversation) {
    const sender = msg.role === "user" ? "user" : "bot";
    const prefix = sender === "user" ? "You: " : "NutriBot: ";
    addBubble(prefix + msg.content, sender);
  }
}

async function sendMessage(text) {
  const message = (text !== undefined ? text : userInput.value).trim();

  // 1. Empty check.
  if (!message) {
    addBubble("Please type a diet or nutrition question first.", "error");
    return;
  }

  // 2. Show user message + loading (no page reload).
  conversation.push({ role: "user", content: message });
  saveHistory();
  addBubble("You: " + message, "user");
  userInput.value = "";

  try {
    // 3. Send recent conversation to the Python serverless function.
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversation.slice(-MAX_HISTORY) }),
    });

    const data = await res.json();

    if (!res.ok || !data.response) {
      // Show the server's message when available (e.g. key not configured),
      // otherwise the generic fallback.
      addBubble(data.error || "Sorry, I couldn't get a response right now. Please try again.", "error");
      return;
    }

    // 4. Show NutriBot's answer.
    conversation.push({ role: "assistant", content: data.response });
    saveHistory();
    addBubble("NutriBot: " + data.response, "bot");
  } catch {
    addBubble("Sorry, I couldn't get a response right now. Please try again.", "error");
  }
  userInput.focus();
}

// Quick question buttons.
document.querySelectorAll(".quick-btn").forEach((btn) => {
  btn.addEventListener("click", () => sendMessage(btn.dataset.question));
});

sendBtn.addEventListener("click", () => sendMessage());

// Enter to send, Shift+Enter for a new line.
userInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

// Clear Chat: remove messages, history and stored data.
clearBtn.addEventListener("click", () => {
  conversation = [];
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // Ignore storage errors.
  }
  chatBox.innerHTML = "";
  userInput.value = "";
  userInput.focus();
});

userInput.focus();
