// Owner clicks a link from the approval email → records the decision for this knock.
import { linkSig, safeEq } from "../_shared.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const rid = url.searchParams.get("r") || "";
  const action = url.searchParams.get("a") || "";
  const k = url.searchParams.get("k") || "";

  if (!["deny", "once", "forever"].includes(action)) return page("Yêu cầu không hợp lệ.", "#c81812");
  if (!safeEq(k, await linkSig(env.SECRET, rid, action))) return page("Liên kết không hợp lệ hoặc đã bị sửa.", "#c81812");

  const rec = await env.ACCESS_KV.get("req:" + rid, "json");
  if (!rec) return page("Yêu cầu đã hết hạn (quá 15 phút). Nhờ người truy cập mở lại.", "#b45309");

  rec.decision = action;
  rec.decidedAt = Date.now();
  await env.ACCESS_KV.put("req:" + rid, JSON.stringify(rec), { expirationTtl: 900 });

  const msg = action === "deny" ? "Đã TỪ CHỐI ❌" : action === "forever" ? "Đã CHO PHÉP VĨNH VIỄN ⭐" : "Đã CHO PHÉP LẦN NÀY ✅";
  const color = action === "deny" ? "#c81812" : "#0d7a3a";
  return page(msg, color, "Người truy cập sẽ được vào (hoặc bị chặn) trong vài giây. Bạn có thể đóng trang này.");
}

function page(title, color, sub = "") {
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
  <style>body{margin:0;font-family:Arial,sans-serif;background:#f4f7fc;min-height:100vh;display:grid;place-items:center}
  .c{background:#fff;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.12);padding:30px;max-width:400px;text-align:center;margin:16px}
  h1{color:${color};font-size:20px;margin:0 0 8px} p{color:#667;font-size:14px}</style></head>
  <body><div class="c"><h1>${title}</h1><p>${sub}</p></div></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
