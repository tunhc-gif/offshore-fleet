# Cổng xin phép cho mục **Weather Downtime** — Hướng dẫn cài đặt

Chỉ **Weather Downtime** bị khóa. **Vessel** và **Offshore Area** vẫn mở công khai cho mọi người.

Khi có người bấm vào Weather Downtime, họ nhập **Họ tên / Bộ phận** → bạn nhận **email** với 3 nút:
**✅ Cho phép lần này** (hết khi đóng web, tối đa 1h) · **⭐ Cho phép vĩnh viễn** (nhớ máy đó ~10 năm) · **❌ Từ chối**.

> ⚠️ Cổng gác là **server-side**, chỉ chạy khi site deploy trên **Cloudflare Pages**.
> GitHub Pages (link hiện tại `tunhc-gif.github.io/offshore-fleet`) **không chạy** được phần này — xem mục "Quan trọng" ở cuối.

Code đã có sẵn trong thư mục `functions/`. Bạn chỉ cần cấu hình bên dưới.

---

## 1) Tạo Resend (gửi email) — miễn phí
1. Đăng ký https://resend.com bằng **email bạn muốn nhận thông báo**.
2. **API Keys → Create** → copy khóa (dạng `re_...`).
3. (Chưa cần tên miền: Resend cho gửi tới **chính email đã đăng ký** với người gửi `onboarding@resend.dev`.)
   Muốn gửi tới email khác / đẹp hơn → verify tên miền rồi đặt `FROM_EMAIL`.

## 2) Tạo Cloudflare Pages — miễn phí
1. https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git**.
2. Chọn repo `tunhc-gif/offshore-fleet`.
3. Build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `out`
   - **KHÔNG đặt** biến `NEXT_PUBLIC_BASE_PATH` (để trống → site chạy ở gốc `/`, route là `/weather-downtime`).
4. Deploy. Lần đầu **Weather Downtime vẫn mở** (cổng "fail-open" khi chưa cấu hình SECRET/KV) — Vessel/Offshore Area luôn mở.

## 3) Tạo kho lưu quyết định (KV)
1. **Workers & Pages → KV → Create namespace**, tên: `offshore-access`.
2. Pages project → **Settings → Functions → KV namespace bindings → Add**:
   - **Variable name:** `ACCESS_KV` → chọn namespace vừa tạo.

## 4) Đặt biến (Settings → Environment variables → Production)
| Tên | Giá trị |
|---|---|
| `SECRET` | chuỗi ngẫu nhiên dài (vd mật khẩu 40 ký tự) — **giữ bí mật**, đặt kiểu **Secret/Encrypted** |
| `RESEND_API_KEY` | khóa `re_...` ở bước 1 — **Secret/Encrypted** |
| `OWNER_EMAIL` | email bạn nhận thông báo |
| `FROM_EMAIL` | *(tùy chọn)* email người gửi nếu đã verify tên miền; bỏ trống = `onboarding@resend.dev` |
| `ADMIN_KEY` | *(tùy chọn nhưng nên có)* chuỗi bí mật để **tự mở khóa máy của bạn** không cần email (xem mục Vận hành) |

## 5) Kích hoạt
- Bấm **Retry deployment** (hoặc push 1 commit) để nạp biến mới.
- Mở `https://<project>.pages.dev/weather-downtime` ở máy khác → bạn nhận email → bấm nút để duyệt.

---

## Vận hành
- **Tự mở khóa máy của bạn** (không cần chờ email): mở
  `https://<project>.pages.dev/weather-downtime?admin=<ADMIN_KEY>`
  → cấp cookie ~10 năm cho **trình duyệt đó** rồi tự bỏ `?admin=...` khỏi URL. Bookmark 1 lần mỗi máy.
- **"Vĩnh viễn"** nhớ theo **trình duyệt/máy** (cookie ký số ~10 năm). Xóa cookie / đổi máy → duyệt lại.
- **"Lần này"** = cookie phiên: **đóng web là mất quyền** (và tối đa 1 giờ).
- **Mỗi khách mới = 1 email.** Đông người → cân nhắc Cloudflare Access (đăng nhập email công ty).
- **Mở khẩn cấp** (lỡ tự khóa mình / Resend hỏng): đặt biến `GATE_DISABLED = 1` → Weather Downtime mở cho mọi người; xóa biến để khóa lại.
- **Thu hồi mọi quyền đã cấp**: đổi `SECRET` sang giá trị mới → mọi cookie cũ hết hiệu lực.

## Quan trọng — về GitHub Pages
Hiện site còn deploy song song trên **GitHub Pages** (`tunhc-gif.github.io/offshore-fleet`). Link đó **không qua cổng gác**, nên mục Weather Downtime ở đó vẫn mở công khai. Để khóa thật sự, chọn 1 trong 2:
- **Tắt GitHub Pages** (Repo → Settings → Pages → Source = None), chỉ dùng link Cloudflare Pages; **hoặc**
- Giữ GitHub Pages cho Vessel/Offshore Area, nhưng hiểu rằng Weather Downtime trên link GH Pages vẫn mở.
(Em có thể chỉnh workflow để **không build trang Weather Downtime** cho bản GitHub Pages nếu anh muốn — báo em.)

## Cơ chế (tóm tắt kỹ thuật)
- `functions/_middleware.js`: chỉ chặn path bắt đầu bằng `/weather-downtime`; cookie hợp lệ → cho qua; chưa có → tạo "knock" (KV, 15 phút), gửi email, trả trang chờ. Mọi path khác (Vessel, Offshore Area, ảnh, JS) → cho qua ngay.
- `functions/access/decide.js`: bạn bấm link trong email (đã ký số) → ghi quyết định vào KV.
- `functions/access/status.js`: trang chờ của khách hỏi liên tục; khi được duyệt → cấp cookie ký số cho **trình duyệt khách** → vào được.
- Link vào Weather Downtime (trang chủ + trang chi tiết tàu) đã đổi thành **điều hướng tải lại trang thật** (không phải chuyển trang nội bộ) để middleware chắc chắn chạy.
