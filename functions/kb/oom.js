// GET /kb/oom — decrypted Saudi Aramco OOM knowledge base for the AI Agent.
//
// Reached only through functions/_middleware.js, which returns 401 unless the
// visitor holds a valid access cookie (same permission as Weather Downtime).
// The repo is public, so the KB is stored ENCRYPTED (public/kb/oom-rev3.enc =
// 12-byte IV || AES-256-GCM ciphertext of gzipped JSON). The key is derived with
// HKDF-SHA256 from env.SECRET — see scripts/build_oom_kb.py (same salt/info).
const SALT = new TextEncoder().encode("offshore-fleet-kb");
const INFO = new TextEncoder().encode("oom-rev3");

async function aesKey(secret) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: SALT, info: INFO },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

export async function decryptKb(secret, blob) {
  const bytes = new Uint8Array(blob);
  const iv = bytes.slice(0, 12);
  const data = bytes.slice(12);
  const gz = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await aesKey(secret), data);
  return new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"));
}

export async function onRequestGet({ request, env }) {
  if (!env.SECRET) return new Response(JSON.stringify({ error: "config" }), { status: 503, headers: { "Content-Type": "application/json" } });
  const asset = await env.ASSETS.fetch(new URL("/kb/oom-rev3.enc", request.url));
  if (!asset.ok) return new Response(JSON.stringify({ error: "missing" }), { status: 404, headers: { "Content-Type": "application/json" } });
  try {
    const body = await decryptKb(env.SECRET, await asset.arrayBuffer());
    return new Response(body, {
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store" },
    });
  } catch {
    // Wrong key (SECRET rotated without re-running the build script) or corrupt file.
    return new Response(JSON.stringify({ error: "decrypt" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
