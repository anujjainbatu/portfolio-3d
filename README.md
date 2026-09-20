# Anuj Jain — portfolio

Personal site for **Anuj Jain**, AI Solutions Engineer (Hyderabad, India).
React + TypeScript + Vite, with a Three.js hero, GSAP scroll animation, and a
serverless chat endpoint on Vercel.

- `/` — the site: about, what I do, career, recognition, systems in production, stack, contact
- `/myworks` — every system, with its architecture
- `/play` — chess against Stockfish, plus a chat that answers questions about the work

## Content

**All copy lives in [`src/config.ts`](src/config.ts).** Components read from it;
none of them hardcode text. Change a fact there and it changes everywhere.

That file is written under a set of rules, documented in its header and worth
repeating: real work only, no client names, no salary, no phone number, no
mention of job searching, dates as years only. Anything aspirational stays out.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build → dist/
npm run preview
```

## The chat on /play

`api/chat.js` is a Vercel serverless function that proxies to Groq, so the API
key is never exposed to the browser.

```bash
GROQ_API_KEY=...   # required, set in Vercel project settings
```

Without it the endpoint returns a 500 and the UI shows a "chat is offline"
state rather than failing silently. Everything else on the site works without
the key.

The bot's persona and its hard limits live in `SYSTEM_PROMPT` in
[`src/pages/Play.tsx`](src/pages/Play.tsx) — it is instructed never to name
clients, discuss compensation, or invent facts that are not in the prompt.

## Deploying

Vercel. `vercel.json` handles SPA rewrites and passes `/api/*` through to the
function. Set `GROQ_API_KEY` before the first deploy.

Once the domain is live, fill in the canonical and `og:url` tags in
`index.html` (marked with a TODO).

## Credits

Third-party notices are in [`LICENSES.md`](LICENSES.md).

- **Chess engine**: [stockfish.js](https://github.com/niklasf/stockfish.js) by
  Niklas Fiekas, **GPLv3**, shipped unmodified. Not my work.
- **3D model**: RobotExpressive, from the three.js examples — by Tomás Laulhé,
  modified by Don McCurdy. CC0.
