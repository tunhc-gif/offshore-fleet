// Offshore Fleet — AI proxy (Cloudflare Worker)
// ---------------------------------------------------------------------------
// A tiny, provider-neutral proxy that holds the LLM API key server-side (the
// website is a static export and must never ship a key). It exposes ONE route:
//
//   POST /ai   { mode: "parse" | "summarize", ... }
//
// GROUNDING: the model is used only to (a) map a question onto the caller's
// fixed schema of conditions, or (b) summarise vessel rows the caller supplies.
// It is never asked for vessel specs, and the client re-validates everything.
//
// Configure with `wrangler` (see README):
//   vars:    PROVIDER = "gemini" | "claude"
//            ALLOWED_ORIGIN = "https://<user>.github.io"   (comma-separated ok)
//            GEMINI_MODEL / ANTHROPIC_MODEL (optional overrides)
//   secrets: GEMINI_API_KEY  and/or  ANTHROPIC_API_KEY

export interface Env {
  PROVIDER?: string;
  ALLOWED_ORIGIN?: string;
  GEMINI_MODEL?: string;
  ANTHROPIC_MODEL?: string;
  GEMINI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
}

const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash-lite";
const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allow = (env.ALLOWED_ORIGIN || "*").split(",").map((s) => s.trim());
  const ok = allow.includes("*") ? "*" : origin && allow.includes(origin) ? origin : allow[0] || "*";
  return {
    "Access-Control-Allow-Origin": ok,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...cors } });
}

// Pull the first JSON object/array out of a model's text (handles code fences).
function extractJson(text: string): any | null {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, "```").replace(/```/g, "");
  const start = cleaned.search(/[{[]/);
  if (start < 0) return null;
  for (let end = cleaned.length; end > start; end--) {
    const slice = cleaned.slice(start, end);
    try {
      return JSON.parse(slice);
    } catch {
      /* keep shrinking */
    }
  }
  return null;
}

// ---- Prompts --------------------------------------------------------------

function parseSystemPrompt(schema: any, locale: string): string {
  return [
    "You convert a user's natural-language question about an offshore-vessel fleet into a STRICT JSON filter.",
    "You do NOT know any vessel data and must NOT invent vessels, numbers, or attributes.",
    "Use ONLY the field names and tokens from this schema (JSON):",
    JSON.stringify(schema),
    "",
    "Return ONLY a JSON object with this shape (no prose, no code fence):",
    `{"intent":"filter"|"advice"|"unknown",`,
    `"conditions":[`,
    ` {"kind":"numeric","field":<numericFields.field>,"operator":">"|">="|"<"|"<="|"=","value":<number>}`,
    ` |{"kind":"range","field":<numericFields.field>,"min":<number>,"max":<number>}`,
    ` |{"kind":"dp","digit":"1"|"2"|"3"}`,
    ` |{"kind":"type","token":<typeTokens.token>}`,
    ` |{"kind":"capability","token":<capabilityTokens.token>}`,
    ` |{"kind":"region","token":<regionTokens.token>}`,
    ` |{"kind":"flag","token":<flagTokens.token>} ],`,
    `"sort":{"field":<numericFields.field>,"dir":"asc"|"desc"}|null,`,
    `"canonicalVi":<short restatement in Vietnamese>,"canonicalEn":<short restatement in English>}`,
    "",
    "Rules:",
    "- A bare capability/spec target like 'crane 100t' means at least (>=).",
    "- 'strongest/largest/newest…' → set sort desc on the relevant field; 'smallest/oldest…' → asc.",
    "- Only reference fields/tokens that exist in the schema; drop anything else.",
    "- If the question is not about selecting vessels by these attributes (e.g. asks about class/drydock status, live position, price), set intent='unknown' and conditions=[].",
    `- Keep canonical* short. User locale is '${locale}'.`,
  ].join("\n");
}

function summarizeSystemPrompt(locale: string): string {
  const vi = locale === "vi";
  return [
    vi
      ? "Bạn là trợ lý kỹ thuật đội tàu offshore. Viết một nhận định NGẮN (tối đa ~120 từ) bằng tiếng Việt."
      : "You are an offshore-fleet technical assistant. Write a SHORT assessment (max ~120 words) in English.",
    "You are given a user question, the applied filter, and a JSON list of vessels with ONLY their stored fields.",
    "STRICT: use only the numbers/text provided. Never invent or estimate specs. If a field is null, treat it as unknown and do not guess.",
    vi
      ? "Nếu dữ liệu được cung cấp KHÔNG đủ để trả lời, hãy nói thẳng là bạn không biết / không đủ dữ liệu — tuyệt đối không bịa."
      : "If the provided data is NOT enough to answer, say plainly that you don't know / lack the data — never fabricate.",
    vi
      ? "Nêu bật vài tàu tiêu biểu (tên + lý do khớp), lưu ý nếu dữ liệu còn thiếu. Không lặp lại toàn bộ danh sách."
      : "Highlight a few notable vessels (name + why they fit) and note if data is sparse. Do not repeat the whole list.",
    'Return ONLY JSON: {"summary": "<text>"}.',
  ].join("\n");
}

// ---- Providers ------------------------------------------------------------

async function callGemini(env: Env, system: string, user: string, wantJson: boolean): Promise<string> {
  const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: { temperature: 0.2, ...(wantJson ? { responseMimeType: "application/json" } : {}) },
  };
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
}

async function callClaude(env: Env, system: string, user: string): Promise<string> {
  const model = env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      temperature: 0.2,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`claude ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  return (data?.content || []).map((b: any) => b.text || "").join("");
}

async function complete(env: Env, system: string, user: string, wantJson: boolean): Promise<string> {
  const provider = (env.PROVIDER || "gemini").toLowerCase();
  if (provider === "claude") {
    if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
    return callClaude(env, system, user);
  }
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");
  return callGemini(env, system, user, wantJson);
}

// ---- Handler --------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/ai") return json({ error: "not found" }, 404, cors);

    let payload: any;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "bad json" }, 400, cors);
    }

    const mode = payload?.mode;
    const locale = payload?.locale === "en" ? "en" : "vi";

    try {
      if (mode === "parse") {
        const query = String(payload?.query || "").slice(0, 2000);
        const schema = payload?.schema ?? {};
        const raw = await complete(env, parseSystemPrompt(schema, locale), query, true);
        const parsed = extractJson(raw) ?? { intent: "unknown", conditions: [], sort: null };
        return json(parsed, 200, cors);
      }
      if (mode === "summarize") {
        const query = String(payload?.query || "").slice(0, 2000);
        const conditionText = String(payload?.conditionText || "");
        const total = Number(payload?.total || 0);
        const vessels = Array.isArray(payload?.vessels) ? payload.vessels.slice(0, 20) : [];
        const user = JSON.stringify({ question: query, filter: conditionText, totalMatches: total, vessels });
        const raw = await complete(env, summarizeSystemPrompt(locale), user, true);
        const parsed = extractJson(raw);
        const summary = typeof parsed?.summary === "string" ? parsed.summary : raw.trim();
        return json({ summary }, 200, cors);
      }
      return json({ error: "unknown mode" }, 400, cors);
    } catch (err: any) {
      return json({ error: String(err?.message || err) }, 502, cors);
    }
  },
};
