// The visitor's waiting page polls this. When the owner has decided, grant/deny here
// (the cookie must be set on the VISITOR's browser, which is the one calling this).
import { setCookie, setReadableCookie, makeToken } from "../_shared.js";

const OK_COOKIE = "wdt_ok";
const LVL_COOKIE = "wdt_lvl"; // readable UI hint: 'once' | 'forever'
const ONCE_TTL = 1 * 3600; // "allow once" token valid up to 1h AND dies when the tab closes
const FOREVER_TTL = 3650 * 24 * 3600; // ~10 years — effectively never re-ask on that browser

export async function onRequestGet({ request, env }) {
  const rid = new URL(request.url).searchParams.get("r") || "";
  const rec = rid ? await env.ACCESS_KV.get("req:" + rid, "json") : null;

  const json = (obj, extraHeaders) =>
    new Response(JSON.stringify(obj), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...(extraHeaders || {}) } });

  if (!rec) return json({ status: "expired" });
  if (rec.decision === "deny") return json({ status: "deny" });
  if (rec.decision === "once" || rec.decision === "forever") {
    const forever = rec.decision === "forever";
    const tokTtl = forever ? FOREVER_TTL : ONCE_TTL;
    const cMaxAge = forever ? FOREVER_TTL : null; // "once" = session cookie → dropped when the browser/tab closes
    const h = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
    h.append("Set-Cookie", setCookie(OK_COOKIE, await makeToken(env.SECRET, tokTtl), cMaxAge));
    h.append("Set-Cookie", setReadableCookie(LVL_COOKIE, rec.decision, cMaxAge));
    return new Response(JSON.stringify({ status: "granted" }), { headers: h });
  }
  return json({ status: "pending" });
}
