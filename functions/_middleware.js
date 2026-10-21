// Access gate for the Weather Downtime tool ONLY.
// Vessel and Offshore Area stay fully public — this middleware returns next()
// for every path except /weather-downtime (and the /access/ approval API).
//
// When an unapproved visitor opens Weather Downtime they identify themselves, the
// owner is emailed 3 links (Deny / Allow once / Allow forever), and approval grants
// a signed cookie to that visitor's browser.
import { cookies, setCookie, setReadableCookie, tokenValid, makeToken, linkSig, safeEq } from "./_shared.js";

const GATED_PREFIX = "/weather-downtime"; // the only protected route
const OK_COOKIE = "wdt_ok"; // signed access token (once = session, forever = ~10y)
const LVL_COOKIE = "wdt_lvl"; // readable UI hint: 'once' | 'forever'
const REQ_COOKIE = "wdt_req"; // pending request id, so repeat requests don't re-email
const ONCE_TTL = 1 * 3600; // "allow once" token valid up to 1h AND dies when the tab closes (session cookie)
const FOREVER_TTL = 3650 * 24 * 3600; // "allow forever" ≈ 10-year cookie (effectively never re-ask on that browser)
const PENDING_TTL = 900; // seconds a knock stays open for approval
// ASN/ISP of data centers (where most bots/scanners originate). Internal staff don't come
// through these, so block them before emailing the owner for access.
const DATACENTER = /microsoft|azure|amazon|aws|google|cloudflare|digitalocean|ovh|hetzner|linode|akamai|oracle|alibaba|tencent|huawei cloud|leaseweb|contabo|vultr|scaleway|datacamp|m247|censys|shodan|internet-?census|scan/i;

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // The approval API must always be reachable (no cookie needed).
  if (path.startsWith("/access/")) return next();

  // Everything that is NOT the Weather Downtime tool is public — pass straight through.
  if (!path.startsWith(GATED_PREFIX)) return next();

  // ---- From here down we are gating /weather-downtime only. ----

  // Intentional emergency open (owner-set): unlocks the tool for everyone.
  if (env.GATE_DISABLED === "1") return next();

  // Fail CLOSED: if the gate isn't configured on this deployment, block the tool
  // (rather than serving it ungated). Public pages are unaffected (handled above).
  if (!env.SECRET || !env.ACCESS_KV) {
    return htmlResponse(
      shell(
        "Tính năng tạm khóa",
        '<h1>Tính năng tạm khóa</h1><p>Mục Weather Downtime chưa được cấu hình cổng truy cập trên bản triển khai này. Vui lòng dùng địa chỉ chính thức của nền tảng.</p>'
      ),
      503
    );
  }

  // Owner self-authorize: /weather-downtime?admin=<ADMIN_KEY> grants a ~10-year cookie on
  // THIS browser immediately (no form, no email). Bookmark once per device. The key is
  // stripped from the URL via a redirect so it isn't left in history or the address bar.
  const adminKey = url.searchParams.get("admin");
  if (adminKey && env.ADMIN_KEY && safeEq(adminKey, env.ADMIN_KEY)) {
    const h = new Headers({ Location: path, "Cache-Control": "no-store" });
    h.append("Set-Cookie", setCookie(OK_COOKIE, await makeToken(env.SECRET, FOREVER_TTL), FOREVER_TTL));
    h.append("Set-Cookie", setReadableCookie(LVL_COOKIE, "forever", FOREVER_TTL));
    return new Response(null, { status: 303, headers: h });
  }

  const c = cookies(request);

  // Already approved on this device/browser?
  if (await tokenValid(env.SECRET, c[OK_COOKIE])) return next();

  // Reuse an in-flight knock so navigating around doesn't spam emails.
  let rid = c[REQ_COOKIE];
  let rec = rid ? await env.ACCESS_KV.get("req:" + rid, "json") : null;

  // If the owner already decided this knock, act on it now.
  if (rec && rec.decision === "deny") return htmlResponse(deniedPage(), 403);
  if (rec && (rec.decision === "once" || rec.decision === "forever")) {
    const forever = rec.decision === "forever";
    const tokTtl = forever ? FOREVER_TTL : ONCE_TTL;
    const cMaxAge = forever ? FOREVER_TTL : null; // "once" = session cookie → dies when the web is closed
    const headers = new Headers({ Location: path + url.search });
    headers.append("Set-Cookie", setCookie(OK_COOKIE, await makeToken(env.SECRET, tokTtl), cMaxAge));
    headers.append("Set-Cookie", setReadableCookie(LVL_COOKIE, rec.decision, cMaxAge));
    return new Response(null, { status: 303, headers });
  }

  // No pending knock yet: ask the visitor to identify themselves first, THEN email the owner.
  if (!rid || !rec) {
    if (request.method === "POST") {
      let name = "";
      try {
        const f = await request.formData();
        name = String(f.get("wdtk") || "").trim().slice(0, 80);
      } catch {
        /* ignore */
      }
      const ip = request.headers.get("CF-Connecting-IP") || "?";
      const ua = request.headers.get("User-Agent") || "?";
      const geo = request.cf ? `${request.cf.city || ""} ${request.cf.country || ""}`.trim() : "";
      const isp = request.cf ? request.cf.asOrganization || "" : "";
      if (name.length < 2) {
        return htmlResponse(nameForm(path, "Vui lòng nhập Họ tên / Bộ phận để gửi yêu cầu."), 200);
      }
      if (DATACENTER.test(isp)) {
        return htmlResponse(
          shell("Truy cập bị hạn chế", "<h1>Truy cập bị hạn chế</h1><p>Yêu cầu đến từ máy chủ/trung tâm dữ liệu không được chấp nhận. Vui lòng mở bằng thiết bị cá nhân qua mạng thông thường.</p>"),
          403
        );
      }
      rid = crypto.randomUUID();
      await env.ACCESS_KV.put("req:" + rid, JSON.stringify({ status: "pending", name, ip, ua, geo, isp, ts: Date.now() }), { expirationTtl: PENDING_TTL });
      try {
        await sendEmail(env, url, rid, { name, ip, ua, geo, isp });
      } catch (e) {
        /* don't block the waiting page if email fails */
      }
      return new Response(waitingPage(rid), {
        status: 202,
        headers: { "Content-Type": "text/html; charset=utf-8", "Set-Cookie": setCookie(REQ_COOKIE, rid, PENDING_TTL), "Cache-Control": "no-store" },
      });
    }
    // First visit (GET) — show the identify form (no email until they submit a name).
    return htmlResponse(nameForm(path), 200);
  }

  return new Response(waitingPage(rid), {
    status: 202,
    headers: { "Content-Type": "text/html; charset=utf-8", "Set-Cookie": setCookie(REQ_COOKIE, rid, PENDING_TTL), "Cache-Control": "no-store" },
  });
}

function htmlResponse(html, status) {
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

async function sendEmail(env, url, rid, info) {
  const base = url.origin;
  const [kDeny, kOnce, kFor] = await Promise.all([
    linkSig(env.SECRET, rid, "deny"),
    linkSig(env.SECRET, rid, "once"),
    linkSig(env.SECRET, rid, "forever"),
  ]);
  const url2 = (a, k) => `${base}/access/decide?r=${rid}&a=${a}&k=${encodeURIComponent(k)}`;
  const from = env.FROM_EMAIL || "onboarding@resend.dev";
  const to = env.OWNER_EMAIL;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px">
      <h2 style="color:#17285e;margin:0 0 4px">Yêu cầu truy cập — Weather Downtime</h2>
      <p style="color:#555;margin:0 0 12px">Có người muốn mở công cụ tính Weather Downtime (Offshore Fleet). Bạn muốn xử lý thế nào?</p>
      <table style="font-size:13px;color:#333;border-collapse:collapse;margin-bottom:16px">
        <tr><td style="padding:2px 8px;color:#888">Người gửi</td><td style="font-weight:700;color:#17285e">${escapeHtml(info.name || "(không nhập tên)")}</td></tr>
        <tr><td style="padding:2px 8px;color:#888">Thời gian</td><td>${new Date().toLocaleString("vi-VN")}</td></tr>
        <tr><td style="padding:2px 8px;color:#888">IP</td><td>${info.ip}</td></tr>
        <tr><td style="padding:2px 8px;color:#888">Vị trí</td><td>${info.geo || "?"}</td></tr>
        <tr><td style="padding:2px 8px;color:#888">Nhà mạng</td><td>${escapeHtml(info.isp || "?")}</td></tr>
        <tr><td style="padding:2px 8px;color:#888">Thiết bị</td><td style="font-size:11px;color:#777">${escapeHtml(info.ua).slice(0, 120)}</td></tr>
      </table>
      <div>
        <a href="${url2("once", kOnce)}" style="display:inline-block;background:#17285e;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;margin:0 6px 8px 0">✅ Cho phép lần này</a>
        <a href="${url2("forever", kFor)}" style="display:inline-block;background:#0d7a3a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;margin:0 6px 8px 0">⭐ Cho phép vĩnh viễn</a>
        <a href="${url2("deny", kDeny)}" style="display:inline-block;background:#c81812;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;margin:0 6px 8px 0">❌ Từ chối</a>
      </div>
      <p style="color:#999;font-size:11px;margin-top:14px">Liên kết hết hạn sau ${Math.round(PENDING_TTL / 60)} phút.</p>
    </div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `Offshore Fleet <${from}>`, to: [to], subject: "🔔 Yêu cầu truy cập Weather Downtime", html }),
  });
  if (!res.ok) throw new Error("email failed: " + res.status);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
}

function shell(title, body) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
  <style>body{margin:0;font-family:Arial,Helvetica,sans-serif;background:linear-gradient(160deg,#dfeafb,#eef4fd);min-height:100vh;display:grid;place-items:center;color:#17285e}
  .card{background:#fff;border-radius:16px;box-shadow:0 10px 40px rgba(23,40,94,.15);padding:32px 28px;max-width:440px;text-align:center;margin:16px}
  .spin{width:34px;height:34px;border:4px solid #dbe4f5;border-top-color:#17285e;border-radius:50%;animation:s 1s linear infinite;margin:8px auto 0}
  @keyframes s{to{transform:rotate(360deg)}} h1{font-size:19px;margin:6px 0} p{color:#5a6b8c;font-size:14px;line-height:1.5}</style></head>
  <body><div class="card">${body}</div></body></html>`;
}

function waitingPage(rid) {
  return shell(
    "Đang chờ phê duyệt",
    `
    <h1>Đang chờ phê duyệt — Weather Downtime</h1>
    <p>Yêu cầu của bạn đã được gửi tới quản trị viên. Vui lòng chờ xác nhận — trang sẽ tự mở khi được cho phép.</p>
    <div class="spin"></div>
    <p id="st" style="margin-top:16px;font-size:12px;color:#8aa">Đang chờ…</p>
    <script>
      const rid=${JSON.stringify(rid)};
      async function poll(){
        try{const r=await fetch('/access/status?r='+rid,{cache:'no-store'});const j=await r.json();
          if(j.status==='granted'){document.getElementById('st').textContent='Đã được chấp nhận — đang mở…';setTimeout(function(){location.replace(location.pathname+location.search);},300);return;}
          if(j.status==='deny'){document.querySelector('.card').innerHTML='<h1>Truy cập bị từ chối</h1><p>Quản trị viên đã từ chối yêu cầu này.</p>';return;}
        }catch(e){}
        setTimeout(poll,2000);
      }
      poll();
    </script>`
  );
}

function nameForm(action, err) {
  return shell(
    "Yêu cầu truy cập",
    `
    <h1>Yêu cầu truy cập — Weather Downtime</h1>
    <p>Mục này cần quản trị viên cho phép. Vui lòng nhập <b>Họ tên / Bộ phận</b> để gửi yêu cầu.</p>
    ${err ? `<p style="color:#c81812;font-size:13px;margin:0 0 4px">${escapeHtml(err)}</p>` : ""}
    <form method="POST" action="${action}" style="margin-top:6px">
      <input name="wdtk" required minlength="2" maxlength="80" autofocus placeholder="VD: Nguyễn Văn A - Phòng XLHH"
        style="width:100%;padding:11px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;outline:none"/>
      <button type="submit" style="margin-top:12px;width:100%;background:#17285e;color:#fff;border:0;padding:12px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">Gửi yêu cầu truy cập</button>
    </form>
    <p style="margin-top:12px;font-size:12px;color:#8aa">Quản trị viên sẽ nhận thông báo và xác nhận (cho phép lần này / vĩnh viễn / từ chối).</p>`
  );
}

function deniedPage() {
  return shell("Từ chối", `<h1>Truy cập bị từ chối</h1><p>Quản trị viên đã từ chối yêu cầu này. Liên hệ quản trị viên nếu bạn cần dùng công cụ Weather Downtime.</p>`);
}
