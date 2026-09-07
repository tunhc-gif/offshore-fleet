# Offshore Fleet — AI proxy (Cloudflare Worker)

A tiny, provider-neutral proxy that lets the AI Agent use an LLM **without ever
shipping an API key** to the browser (the site is a static export). It runs on
Cloudflare Workers' free tier and works with **Gemini** or **Claude** — switch
with one variable.

## What it does — and the no-fabrication guarantee

The Worker exposes one route, `POST /ai`, with two modes:

- **`parse`** — turns a free-form question into a JSON filter chosen **only** from
  the schema the site sends (field names + allowed tokens). The site then
  re-validates every field/token and **drops anything unknown**, and reads all
  numbers from the real dataset. The model cannot inject a fabricated spec.
- **`summarize`** — writes a short assessment **only** from the vessel rows the
  site passes in. The authoritative cards/CSV always come from the data.

If the Worker is unreachable or errors, the site silently falls back to its
offline rule-based engine — the agent never breaks.

## Deploy (one time)

Prereqs: a free [Cloudflare](https://dash.cloudflare.com/sign-up) account and
Node 18+.

```bash
cd cf-worker
npm install

# 1) Pick the provider and lock CORS to your site — edit wrangler.toml:
#    PROVIDER = "gemini"  (or "claude")
#    ALLOWED_ORIGIN = "https://tunhc-gif.github.io"
#    GEMINI_MODEL / ANTHROPIC_MODEL = the exact model id your key can access

# 2) Add your API key as an encrypted secret (NOT in the file):
npx wrangler secret put GEMINI_API_KEY       # if PROVIDER=gemini
#   — or —
npx wrangler secret put ANTHROPIC_API_KEY    # if PROVIDER=claude

# 3) Deploy
npx wrangler deploy
```

`wrangler deploy` prints a URL like `https://offshore-fleet-ai.<you>.workers.dev`.

Get an API key from **Google AI Studio** (Gemini) or the **Anthropic Console**
(Claude). Set the matching `*_MODEL` in `wrangler.toml` to the exact id shown for
your key (e.g. the Gemini Flash-Lite id in your console).

## Wire it into the site

Set a build-time env var for the Next.js app to the Worker URL:

```
NEXT_PUBLIC_AI_PROXY_URL=https://offshore-fleet-ai.<you>.workers.dev
```

- Local: put it in `jub-platform/.env.local`.
- GitHub Pages Action: add it as a repo **secret/variable** and expose it to the
  build step as `NEXT_PUBLIC_AI_PROXY_URL`.

Leave it unset and the AI Agent stays 100% offline/rule-based (no change).

## Switch provider later

Edit `PROVIDER` in `wrangler.toml`, make sure the matching secret + `*_MODEL` are
set, and `npx wrangler deploy` again. No site change needed.

## Test

```bash
curl -s https://offshore-fleet-ai.<you>.workers.dev/ai \
  -H 'Content-Type: application/json' \
  -d '{"mode":"parse","locale":"vi","query":"AHTS bollard pull tren 120 tan va DP2",
       "schema":{"numericFields":[{"field":"bollardPullT"}],"operators":[">="],
       "typeTokens":[{"token":"ahts"}],"capabilityTokens":[],"regionTokens":[],
       "flagTokens":[],"dpDigits":["1","2","3"]}}'
```
