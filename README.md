# Anuj Jain — portfolio

Personal site for **Anuj Jain**, AI Solutions Engineer (Hyderabad, India).
React + TypeScript + Vite, with a Three.js hero, GSAP scroll animation, and a
serverless portfolio assistant on Vercel.

- `/` — about, work, career, stack, and contact
- `/myworks` — every production system, with its architecture
- Floating **LET'S TALK** assistant — available on every route

## Content

Public site and assistant facts live in
[`shared/publicProfile.ts`](shared/publicProfile.ts). Components continue to
import `src/config.ts`, which re-exports that canonical profile. Only facts that
are safe to publish belong there: client identities stay private unless a public
project has been explicitly approved for linking; salary, phone number, employer
stability, job-search details, and future claims remain private.

The server-only assistant rules live in `server/chatPolicy.ts`. The browser
never sends or controls the system prompt.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + Vite production build
npm run lint
npm run test:run
```

`npm run dev` mounts the same server-owned chat handler at `/api/chat`, so the
assistant works on Vite's selected local port. Production continues to use the
Vercel function in `api/chat.ts`; secrets are never injected into client code.

## Portfolio assistant

`api/chat.ts` accepts a maximum of 12 user/assistant messages, validates and
caps all text, applies a per-IP Upstash sliding-window limit, attaches the
server-owned profile and policy, and proxies the approved request to Gemini, falling back to Groq when Gemini is
rate-limited or unavailable. The
API returns the application-owned shape `{ "message": "..." }`; provider
responses are never exposed directly.

Conversation history is capped and stored only in the visitor's
`sessionStorage`. It survives navigation and refreshes in that tab, can be
cleared in the widget, and is never written to a transcript database. Analytics
record event names only, never questions or answers.

Required deployment variables:

```bash
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash         # optional override
GROQ_API_KEY=...                       # optional fallback
GROQ_MODEL=openai/gpt-oss-20b       # optional override
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

The application intentionally returns an offline state when neither provider or the
managed limiter is not configured. The rest of the site remains fully
functional. Also configure a provider-side usage/budget limit in each
provider project.

## Deploying

Deploy to Vercel. `vercel.json` passes `/api/*` to serverless functions and
rewrites the remaining paths to the SPA. Add the four environment variables
above before enabling the assistant publicly.

## Credits

Third-party notices are in [`LICENSES.md`](LICENSES.md).

- **3D model**: RobotExpressive from the three.js examples, by Tomás Laulhé and
  modified by Don McCurdy, CC0.
- **Chat avatar**: generated for this project from the visual direction of the
  CC0 robot mascot; stored at `public/robot-chat-avatar.png`.
