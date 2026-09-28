"""
NUTRIBOT - Vercel Python serverless function.

Vercel exposes this file automatically as POST /api/chat.
No Flask, no Django, no app.run() - just a plain request handler class.

Flow:
  script.js -- POST /api/chat { "messages": [...] } -->
  handler.do_POST -- Groq API (LLM) -->
  handler -- { "response": "..." } --> script.js
"""

import json
import os
from http.server import BaseHTTPRequestHandler

from groq import Groq

# Model is configurable: set GROQ_MODEL in Vercel Environment Variables.
# Default verified working on 2026-09-28 (older Llama IDs now return 404).
GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-20b")

# How many recent messages are forwarded so follow-up
# questions like "What foods contain it?" keep their context.
MAX_HISTORY = 10

# Values that mean "no real key configured".
PLACEHOLDER_KEYS = {"", "your_api_key_here", "your_actual_groq_api_key_here"}

# Tells the LLM how to behave as NutriBot.
SYSTEM_PROMPT = """You are NutriBot, an AI diet and nutrition assistant.

Your purpose is to provide simple, clear and educational general
information about diet and nutrition.

You can answer questions about:
- balanced diets
- protein
- carbohydrates
- healthy fats
- fiber
- vitamins
- minerals
- hydration
- calories
- healthy foods
- meal ideas
- fitness nutrition

Use simple language. Keep normal answers concise.
Use bullet points when useful.

Do not diagnose diseases. Do not prescribe medicines.
Do not recommend dangerous or extreme diets.
Do not encourage starvation or unsafe calorie restriction.

For medical conditions, allergies, pregnancy, eating disorders,
or serious health concerns, advise the user to consult a
qualified healthcare professional.

You are an educational nutrition assistant, not a doctor or dietitian."""


def get_api_key():
    """Read GROQ_API_KEY from environment (Vercel sets it)."""
    key = (os.environ.get("GROQ_API_KEY") or "").strip().strip('"').strip("'")
    return "" if key in PLACEHOLDER_KEYS else key


def validate_messages(messages):
    """Check the conversation list. Returns (cleaned_list, error_string)."""
    if not isinstance(messages, list) or len(messages) == 0:
        return None, "Please type a diet or nutrition question first."
    cleaned = []
    for m in messages:
        if (
            not isinstance(m, dict)
            or m.get("role") not in ("user", "assistant")
            or not isinstance(m.get("content"), str)
            or not m["content"].strip()
        ):
            return None, "Invalid conversation format."
        cleaned.append({"role": m["role"], "content": m["content"].strip()})
    if not any(m["role"] == "user" for m in cleaned):
        return None, "Please type a diet or nutrition question first."
    return cleaned[-MAX_HISTORY:], ""


def ask_groq(api_key, messages):
    """Send system prompt + conversation to Groq, return the answer text."""
    client = Groq(api_key=api_key)
    completion = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "system", "content": SYSTEM_PROMPT}, *messages],
        temperature=0.6,
        max_tokens=500,
    )
    return completion.choices[0].message.content.strip()


class handler(BaseHTTPRequestHandler):
    """Vercel calls this class to handle each request."""

    def _send_json(self, status_code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        # 1. Read and parse the JSON body.
        try:
            length = int(self.headers.get("Content-Length", 0))
        except (TypeError, ValueError):
            length = 0
        try:
            raw = self.rfile.read(length).decode("utf-8") if length else "{}"
            data = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            return self._send_json(400, {"error": "Invalid request. Please try again."})

        # 2. Validate the conversation.
        messages, error = validate_messages(data.get("messages") if isinstance(data, dict) else None)
        if error:
            return self._send_json(400, {"error": error})

        # 3. Check the API key (never expose it to the browser).
        api_key = get_api_key()
        if not api_key:
            print("[NutriBot] GROQ_API_KEY is missing.")
            return self._send_json(500, {"error": "NutriBot is not configured yet. Please try again later."})

        # 4. Call Groq and map errors to friendly messages.
        try:
            answer = ask_groq(api_key, messages)
        except Exception as exc:  # show friendly msg, log real error server-side
            print(f"[NutriBot] Groq API error: {exc}")
            msg = str(exc).lower()
            if "401" in msg or "invalid api key" in msg or "unauthorized" in msg:
                return self._send_json(500, {"error": "NutriBot is not configured correctly. Please try again later."})
            if "429" in msg or "rate limit" in msg:
                return self._send_json(502, {"error": "NutriBot is busy right now. Please wait a moment and try again."})
            if "404" in msg or "model_not_found" in msg or "decommissioned" in msg or ("model" in msg and "not found" in msg):
                return self._send_json(502, {"error": "The configured AI model is unavailable. Please try again later."})
            return self._send_json(502, {"error": "Sorry, I couldn't get a response right now. Please try again."})

        if not answer:
            return self._send_json(502, {"error": "Sorry, I couldn't get a response right now. Please try again."})

        # 5. Return the AI answer.
        return self._send_json(200, {"response": answer})

    def do_GET(self):
        self._send_json(405, {"error": "Use POST /api/chat with a JSON body."})
