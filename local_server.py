"""
NUTRIBOT - easy local runner (for testing on your own computer only).

Runs the SAME Python logic as the Vercel deployment (api/chat.py)
plus serves index.html / style.css / script.js - with ONE command:

    python local_server.py

Then open: http://localhost:8000

Deployment on Vercel does NOT use this file. Vercel uses api/chat.py
directly. This file exists only so you can test locally WITHOUT
installing the Vercel CLI or linking any project.
"""

import importlib.util
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def load_local_env():
    """Read KEY=VALUE lines from .env (if present) into environment."""
    env_path = os.path.join(BASE_DIR, ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


# Load .env BEFORE importing api/chat.py (it reads the model name at import).
load_local_env()

spec = importlib.util.spec_from_file_location(
    "nutribot_chat", os.path.join(BASE_DIR, "api", "chat.py"))
chat = importlib.util.module_from_spec(spec)
spec.loader.exec_module(chat)

# Static files served from the project root.
STATIC_FILES = {
    "/": ("index.html", "text/html"),
    "/index.html": ("index.html", "text/html"),
    "/style.css": ("style.css", "text/css"),
    "/script.js": ("script.js", "application/javascript"),
}


class LocalHandler(chat.handler):
    """Same chat logic as Vercel, plus static-file serving for local use."""

    def do_GET(self):
        if self.path.split("?")[0] in STATIC_FILES:
            filename, content_type = STATIC_FILES[self.path.split("?")[0]]
            filepath = os.path.join(BASE_DIR, filename)
            with open(filepath, "rb") as f:
                body = f.read()
            self.send_response(200)
            self.send_header("Content-Type", content_type + "; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            # Same behaviour as the Vercel function for GET /api/chat.
            self._send_json(405, {"error": "Use POST /api/chat with a JSON body."})

    def log_message(self, *args):
        # Short one-line logs instead of default noisy output.
        print(f"[{self.command} {self.path} -> {args[1]}]")


if __name__ == "__main__":
    if not chat.get_api_key():
        print("NOTE: GROQ_API_KEY is not set.")
        print("  Copy .env.example to .env and add your key to get real answers.")
    print(f"NutriBot running locally at http://localhost:{PORT}")
    print("Press CTRL+C to stop.")
    HTTPServer(("127.0.0.1", PORT), LocalHandler).serve_forever()
