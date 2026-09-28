# NUTRIBOT – AI Diet & Nutrition Assistant

MCA mini-project (Generative AI / NLP): a simple web chatbot that answers
diet and nutrition questions using an LLM through the **Groq API**.

Python backend (Vercel serverless) + plain HTML/CSS/JS frontend. No Flask,
no database, no login — just a chatbot.

## Folder structure

```text
NutriBot/
├── index.html      # single-page chat UI
├── style.css       # all styling (responsive)
├── script.js       # chat logic, history, fetch to /api/chat
├── api/
│   └── chat.py     # Vercel Python serverless function (Groq call)
├── local_server.py # easy local testing: python local_server.py
├── requirements.txt
├── .env.example    # local testing template (never a real key)
└── .gitignore
```

## How to run locally (easy way, no Vercel CLI needed)

1. Install Python 3.10+.
2. `pip install -r requirements.txt` (only needs `groq`).
3. Copy `.env.example` to `.env` and put your real Groq key in it
   (free key: https://console.groq.com → API Keys → Create API Key).
4. Run:
   ```bash
   python local_server.py
   ```
5. Open http://localhost:8000 in your browser and chat.

(`local_server.py` is only for your computer. Vercel ignores it and
uses `api/chat.py` directly.)

## Deploy on Vercel yourself (GitHub method, no CLI needed)

1. Create a GitHub account (if needed) at https://github.com.
2. Create a NEW repository, e.g. `nutribot` (do NOT upload the `venv/`
   folder — it is big and unnecessary; `.gitignore` already excludes it).
3. Upload these files to the repository: `index.html`, `style.css`,
   `script.js`, `api/chat.py`, `local_server.py`, `requirements.txt`,
   `.env.example`, `.gitignore`, `README.md`.
   (Never upload `.env` — it may contain your real API key.)
4. Go to https://vercel.com → Add New → Project → Import `nutribot`.
5. When asked for Environment Variables, add:
   - Name: `GROQ_API_KEY`, Value: your real key.
6. Click Deploy. Open the given URL — done.

## Viva notes

- **NLU:** the LLM understands natural-language diet questions; the recent
  conversation (`messages`) is sent along so follow-ups like "What foods
  contain it?" resolve correctly.
- **NLG:** Groq-hosted LLM generates the answer from `SYSTEM_PROMPT` +
  conversation in `api/chat.py`.
- **Chatbot:** `script.js` renders bubbles, loading state, quick questions,
  Clear Chat, and `localStorage` history — no page reload.
- **Safety:** system prompt bans diagnosis/prescriptions/extreme diets and
  redirects medical issues to professionals. Key stays server-side in
  `GROQ_API_KEY`; errors never leak keys or tracebacks.

## Future scope (not implemented)

Meal planner, calorie tracker, BMI calculator, voice input, regional
languages, food-image recognition.
