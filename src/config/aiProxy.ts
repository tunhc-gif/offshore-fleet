// AI proxy configuration.
//
// The AI Agent works fully offline with the deterministic rule-based engine.
// When (and only when) a proxy URL is configured, an LLM layer is added on top
// to (a) understand free-form / fuzzy questions the rules miss and (b) write a
// grounded natural-language summary. The proxy holds the provider API key — the
// browser never sees it — because the site is a static export (no backend).
//
// To enable: deploy the Cloudflare Worker in `cf-worker/` and set
//   NEXT_PUBLIC_AI_PROXY_URL="https://<your-worker>.workers.dev"
// in the build environment (e.g. a repo secret / .env.local). Empty = disabled.

export const AI_PROXY_URL = (process.env.NEXT_PUBLIC_AI_PROXY_URL || "").trim();

export const AI_PROXY_ENABLED = AI_PROXY_URL.length > 0;

// Client-side guardrails so a slow/broken proxy never blocks the UI.
export const AI_PROXY_TIMEOUT_MS = 12000;
