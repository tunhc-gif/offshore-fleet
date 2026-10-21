// Shared helpers for the Weather-Downtime access gate (Cloudflare Pages Functions).
// Underscore-prefixed → not exposed as a route, only imported.

const enc = new TextEncoder();

/** URL-safe base64 of bytes. */
function b64url(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** HMAC-SHA256(secret, msg) → url-safe base64 string. */
export async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return b64url(sig);
}

/** Constant-time-ish string compare. */
export function safeEq(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Parse a Cookie header into an object. */
export function cookies(request) {
  const out = {};
  const h = request.headers.get("Cookie") || "";
  for (const part of h.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/** Build a Set-Cookie value. maxAge in seconds; omit for a session cookie. */
export function setCookie(name, value, maxAge) {
  let c = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax`;
  if (maxAge != null) c += `; Max-Age=${maxAge}`;
  return c;
}

/** Like setCookie but WITHOUT HttpOnly, so client JS can read it (for a non-secret UI hint). */
export function setReadableCookie(name, value, maxAge) {
  let c = `${name}=${encodeURIComponent(value)}; Path=/; Secure; SameSite=Lax`;
  if (maxAge != null) c += `; Max-Age=${maxAge}`;
  return c;
}

/** Signed access token = "<exp>.<sig>"; valid while sig matches and exp in the future. */
export async function makeToken(secret, ttlSeconds) {
  const exp = Date.now() + ttlSeconds * 1000;
  return `${exp}.${await hmac(secret, "ok:" + exp)}`;
}
export async function tokenValid(secret, token) {
  if (!token || token.indexOf(".") < 0) return false;
  const [exp, sig] = token.split(".");
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return safeEq(sig, await hmac(secret, "ok:" + exp));
}

/** Signature that authorizes one decision link (only links we emailed work). */
export const linkSig = (secret, rid, action) => hmac(secret, `decide:${rid}:${action}`);
