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

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineFormat(s) {
  // `code` first, then **bold** (escaped text is safe to inject tags into).
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return s;
}

// Minimal structured renderer: headings, bullet/numbered lists,
// paragraphs. No external library - easy for viva explanation.
function formatBotText(raw) {
  const lines = escapeHtml(raw).split(/\r?\n/);
  let html = "";
  let listOpen = ""; // "" | "ul" | "ol"

  function closeList() {
    if (listOpen) {
      html += listOpen === "ul" ? "</ul>" : "</ol>";
      listOpen = "";
    }
  }

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }

    // Headings: # Title, ## Title, ### Title
    const h = trimmed.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      closeList();
      html += "<h4>" + inlineFormat(h[2]) + "</h4>";
      continue;
    }

    // Bullet: - item, * item, • item
    const bullet = trimmed.match(/^([-*•])\s+(.*)/);
    if (bullet) {
      if (listOpen !== "ul") {
        closeList();
        html += "<ul>";
        listOpen = "ul";
      }
      html += "<li>" + inlineFormat(bullet[2]) + "</li>";
      continue;
    }

    // Numbered: 1. item, 1) item
    const num = trimmed.match(/^(\d+)[.)]\s+(.*)/);
    if (num) {
      if (listOpen !== "ol") {
        closeList();
        html += "<ol>";
        listOpen = "ol";
      }
      html += "<li>" + inlineFormat(num[2]) + "</li>";
      continue;
    }

    // Normal paragraph line.
    closeList();
    html += "<p>" + inlineFormat(trimmed) + "</p>";
  }
  closeList();
  return html || "<p></p>";
}

function addBubble(text, sender) {
  const row = document.createElement("div");
  row.className = "message " + sender;

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (sender === "bot") {
    const label = document.createElement("span");
    label.className = "sender-label";
    label.textContent = "NutriBot";
    bubble.appendChild(label);

    const body = document.createElement("div");
    body.className = "formatted";
    body.innerHTML = formatBotText(text);
    bubble.appendChild(body);
  } else if (sender === "user") {
    const label = document.createElement("span");
    label.className = "sender-label";
    label.textContent = "You";
    bubble.appendChild(label);

    const body = document.createElement("div");
    body.className = "plain";
    body.textContent = text;
    bubble.appendChild(body);
  } else {
    bubble.textContent = text;
  }

  row.appendChild(bubble);
  chatBox.appendChild(row);
  chatBox.scrollTop = chatBox.scrollHeight; // auto-scroll
}

function renderHistory() {
  chatBox.innerHTML = "";
  for (const msg of conversation) {
    const sender = msg.role === "user" ? "user" : "bot";
    addBubble(msg.content, sender);
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
  addBubble(message, "user");
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
    addBubble(data.response, "bot");
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
