# Greenwich Wishes

Website lời chúc của **Đại học Greenwich (Việt Nam)**: tường lời chúc, bản đồ kết nối 3D, cây ước nguyện 3D.
Mọi người vào đăng một lời chúc kèm ảnh (có crop), không cần đăng nhập, mỗi máy chỉ đăng được một lần.
Có nút chia sẻ từng lời chúc lên Facebook và chế độ admin ẩn để quản lý bài.

- **Dữ liệu** lưu trong **PostgreSQL 16** (trên Docker) và ảnh tải lên trong `data/uploads/`.
- **Hỗ trợ tự động chuyển đổi dữ liệu**: nếu trước đó có file SQLite `data/gw.db`, server sẽ tự động nạp sang PostgreSQL khi khởi động lần đầu.
- **Yêu cầu:** Node.js **22.5 trở lên** và **Docker** (để chạy PostgreSQL).

---

## 1. Chạy với Docker Compose (khuyến nghị, 1 lệnh là xong)

Khởi động cả PostgreSQL và web app chỉ với một lệnh:

```bash
docker compose up -d --build
```

- Web app mở tại: `http://localhost:8780`
- PostgreSQL lắng nghe tại cổng: `5432`

Nếu bạn muốn chạy server Node trực tiếp trên máy host và chỉ dùng Docker để chạy PostgreSQL:

```bash
# 1. Bật container PostgreSQL
docker compose up -d postgres

# 2. Cài dependency và khởi động server
npm install
node server.js
```

---

## 2. Cấu hình

Sao chép `.env.example` thành `.env` (cùng thư mục với `server.js`) rồi sửa:

| Biến | Ý nghĩa |
|---|---|
| `PUBLIC_URL` | Địa chỉ công khai, ví dụ `https://wishes.example.edu.vn` (không có `/` cuối). **Bắt buộc khi lên domain** để chia sẻ Facebook đúng. |
| `ADMIN_PASSPHRASE` | Mật khẩu mở chế độ admin. **BẮT BUỘC ĐỔI** khỏi giá trị mặc định `admingreenwich`. |
| `TRUST_PROXY` | Đặt `1` khi chạy sau nginx / Caddy / Cloudflare. |
| `PORT` | Cổng server (mặc định `8780`). |
| `DATA_DIR` | Thư mục lưu database và ảnh (mặc định `./data`). |
| `SEED_DEMO` | `1` = nạp dữ liệu mẫu vào database rỗng. Chỉ để thử. |

Nếu `PUBLIC_URL` là https mà `ADMIN_PASSPHRASE` chưa đặt (hoặc còn là `CHANGE-ME...`), server **từ chối khởi động** và báo lý do trong log, để không ai vô tình mở site công khai với mật khẩu admin đoán được.
Khi chạy thử trên máy (không có `PUBLIC_URL`), nó chỉ cảnh báo `[!]` và dùng mật khẩu mặc định `admingreenwich`.

---

## 3. Deploy lên domain (VPS Ubuntu, cách khuyến nghị)

Giả sử domain là `wishes.example.edu.vn` và server là Ubuntu 22.04/24.04.

### Bước 1 - Trỏ DNS
Tạo bản ghi **A** cho `wishes.example.edu.vn` trỏ về IP của VPS. Mở cổng **80** và **443** trên firewall.

### Bước 2 - Cài Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version      # >= v22.5
```

### Bước 3 - Đưa mã nguồn lên server

```bash
sudo mkdir -p /opt/greenwich-wishes
# giải nén file zip vào /opt/greenwich-wishes  (file server.js nằm ngay trong thư mục này)
cd /opt/greenwich-wishes
cp .env.example .env
nano .env           # sửa PUBLIC_URL, ADMIN_PASSPHRASE, giữ TRUST_PROXY=1
sudo mkdir -p data && sudo chown -R www-data:www-data data
```

### Bước 4 - Chạy như một dịch vụ (tự khởi động lại khi lỗi / khi reboot)

```bash
sudo cp deploy/greenwich-wishes.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now greenwich-wishes
sudo systemctl status greenwich-wishes          # phải thấy "active (running)"
curl -s http://127.0.0.1:8780/api/admin/me      # phải trả {"admin":false}
```

Xem log: `sudo journalctl -u greenwich-wishes -f`

### Bước 5 - HTTPS bằng reverse proxy

**Cách A - Caddy (dễ nhất, tự cấp và gia hạn chứng chỉ):**

```bash
sudo apt-get install -y caddy
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile      # sửa domain trong file trước
sudo systemctl reload caddy
```

**Cách B - nginx + certbot:** dùng `deploy/nginx.conf` (sửa domain), rồi `sudo certbot --nginx -d wishes.example.edu.vn`.
Giữ nguyên các dòng `proxy_set_header Host` và `X-Forwarded-Proto`, server cần chúng.

Mở `https://wishes.example.edu.vn` là xong.

### Cập nhật phiên bản sau này

```bash
# thay file mã nguồn (KHÔNG xóa thư mục data/ và file .env), rồi:
sudo systemctl restart greenwich-wishes
```

---

## 4. Deploy bằng Docker (thay thế cho bước 2-4)

```bash
cp .env.example .env && nano .env
docker compose up -d --build
```

Container chỉ mở cổng ở `127.0.0.1:8780`; vẫn cần Caddy/nginx (bước 5) đứng trước để có HTTPS.
Dữ liệu nằm trong thư mục `./data` bên cạnh `docker-compose.yml`.

> **Quyền thư mục:** container chạy bằng user `node` (uid 1000). Trên Linux hãy tạo sẵn thư mục và cấp quyền, nếu không sẽ lỗi không ghi được database:
> `mkdir -p data && sudo chown -R 1000:1000 data`

---

## 5. Chế độ admin

1. Ở trang chủ, gõ **mật khẩu admin** (giá trị `ADMIN_PASSPHRASE`) vào **ô tìm kiếm**.
2. Bấm **Ctrl + Alt + X**.
3. Trang tải lại, xuất hiện thanh **ADMIN** ở góc phải dưới và nút **sửa / xóa** trên mọi thẻ lời chúc.

Admin có thể:
- **Đăng nhiều lời chúc** (không bị giới hạn một bài mỗi máy): bấm *Thêm lời chúc* trên thanh admin.
- **Sửa** mọi lời chúc: nút bút chì trên thẻ, đổi tên, nội dung, vai trò, cơ sở, quốc gia, và ảnh (để trống nếu giữ ảnh cũ).
- **Xóa vĩnh viễn** mọi lời chúc (kể cả file ảnh): nút thùng rác.
- Bấm **Thoát admin** khi xong. Phiên tự hết sau 12 giờ.

**Về bảo mật của chế độ này**
- Mật khẩu **không nằm trong mã nguồn phía trình duyệt**. Trình duyệt chỉ gửi cụm đã gõ lên server; server so sánh và, nếu đúng, cấp một cookie ký số `HttpOnly`. Mọi quyền sửa/xóa đều được kiểm tra ở server, nên mở DevTools cũng không tự thành admin được.
- Gõ sai thì không có phản hồi gì. Tối đa 8 lần thử mỗi 10 phút trên mỗi IP.
- Ai biết mật khẩu là admin: **đặt `ADMIN_PASSPHRASE` dài, khó đoán, và chỉ cho người cần**. Muốn thu hồi, đổi giá trị trong `.env` rồi restart (cookie admin cũ vẫn hết hạn theo thời gian; để vô hiệu ngay, xóa `data/secret.key` rồi restart).
> **Cẩn thận:** xóa `secret.key` cũng làm mất hiệu lực cookie nhận diện thiết bị của mọi khách, nghĩa là những người đã đăng rồi sẽ đăng thêm được một lần nữa. Chỉ làm khi thật sự cần.

---

## 6. Chia sẻ Facebook

Mỗi thẻ có nút Facebook. Khi bấm, trang mở hộp thoại chia sẻ với link `https://<domain>/w/<id>`. Link này chứa thẻ Open Graph
trỏ đến **ảnh thẻ lời chúc hoàn chỉnh** (ảnh + lời chúc + tên + logo) được dựng sẵn lúc đăng bài, nên bài đăng trên Facebook
giống hệt thẻ trên web. Người bấm vào bài sẽ được đưa thẳng tới đúng lời chúc đó.

Yêu cầu: website phải **công khai qua https** và đã đặt `PUBLIC_URL`. Không hoạt động với `localhost`.

Kiểm tra / làm mới bản xem trước (Facebook lưu cache): <https://developers.facebook.com/tools/debug/> rồi dán link `https://<domain>/w/<id>`
và bấm *Scrape Again*.

---

## 7. Cơ chế "mỗi máy một lời chúc"

Không có đăng nhập, nên dùng cơ chế của trình duyệt:
- Lần đầu truy cập, server cấp một **cookie ký số** (`gw_did`, `HttpOnly`, 10 năm). Database có ràng buộc `UNIQUE` theo mã này, nên lần đăng thứ hai bị từ chối (HTTP 409).
- Trình duyệt cũng ghi nhớ trong `localStorage`; người đã đăng sẽ thấy khung "Bạn đã gửi lời chúc rồi" thay cho form.
- Thêm giới hạn **20 bài/giờ/IP** (cố ý để rộng vì nhiều người có thể dùng chung Wi-Fi của trường).

**Giới hạn:** người xóa cookie hoặc dùng cửa sổ ẩn danh vẫn đăng thêm được. Muốn chặt hơn phải thêm đăng nhập (Google, email) hoặc OTP, ngoài phạm vi bản này.

---

## 8. Kiểm tra sau khi deploy (checklist)

Làm lần lượt, mỗi mục đều nên đạt:

1. `https://<domain>` mở được, có ổ khóa https; trang hiển thị logo và banner Greenwich.
2. `curl -s https://<domain>/api/admin/me` trả `{"admin":false}`.
3. Vào *Gửi lời chúc*, chọn ảnh, crop, gửi bài: bài hiện trên tường. Gửi lần hai từ cùng trình duyệt: hiện khung "Bạn đã gửi lời chúc rồi".
4. Bấm nút Facebook trên thẻ: hộp thoại Facebook hiện **ảnh thẻ lời chúc**, không phải ảnh trống. Nếu lỗi, xem mục 6 và 10.
5. Vào admin (mục 5), thử sửa rồi xóa bài thử của chính bạn. Rồi **Thoát admin**.
6. `sudo systemctl restart greenwich-wishes`, tải lại trang: bài vẫn còn (xác nhận database được lưu bền).
7. `ls data/` có `gw.db`, `uploads/`, `secret.key`, và đã đặt lịch sao lưu (mục 9).

---

## 9. Sao lưu và khôi phục

Toàn bộ dữ liệu nằm trong thư mục `data/`:

```
data/gw.db        database SQLite
data/uploads/     ảnh đã crop + ảnh thẻ chia sẻ
data/secret.key   khóa ký cookie
```

**Sao lưu:** dừng dịch vụ (hoặc chấp nhận sao lưu nóng) và chép cả thư mục `data/`, ví dụ `tar czf backup-$(date +%F).tar.gz data/`.
**Khôi phục:** chép lại thư mục `data/` rồi khởi động lại dịch vụ. Nên đặt lịch sao lưu hằng ngày bằng `cron`.

---

## 10. Cấu trúc thư mục

```
server.js            server (API, lưu trữ, trang chia sẻ Facebook, phục vụ file tĩnh)
index.html           trang chủ: tường lời chúc, bản đồ, cây ước nguyện
create.html          trang gửi / sửa lời chúc (upload + crop ảnh)
js/                  i18n.js (VI/EN), data.js (quốc gia, thành phố, dữ liệu mẫu), common.js, main.js, create.js
css/style.css        toàn bộ giao diện và biến màu (đầu file)
images/              logo, banner, ảnh nền thẻ (photos/p01..p13.jpg)
deploy/              Caddyfile, nginx.conf, greenwich-wishes.service
Dockerfile, docker-compose.yml, .env.example
data/                (tự tạo khi chạy) database + ảnh người dùng
```

**Tùy chỉnh nhanh**
- Đổi màu: các biến `--gw-navy`, `--gw-orange` ở đầu `css/style.css`.
- Đổi logo / favicon: thay `images/logo.png`, `favicon.ico`, `favicon-32.png`, `favicon-192.png`, `apple-touch-icon.png`.
- Danh sách quốc gia, thành phố trên bản đồ: `js/data.js` (server đọc cùng file này để kiểm tra dữ liệu).
- Nội dung chữ VI/EN: `js/i18n.js`.

---

## 11. Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| `Cannot find module 'node:sqlite'` | Node quá cũ. Cài Node **>= 22.5**. |
| Trang mở được nhưng gửi bài báo lỗi `bad_origin` (403) | Proxy chưa chuyển header `Host`. Dùng đúng `deploy/Caddyfile` hoặc `nginx.conf`. |
| Cookie không giữ được trên https | Chưa đặt `PUBLIC_URL=https://...` hoặc thiếu `X-Forwarded-Proto` ở proxy. |
| Chia sẻ Facebook không có ảnh | Chưa đặt `PUBLIC_URL`, hoặc site chưa công khai qua https. Dùng Sharing Debugger (mục 6). |
| Tải ảnh lên báo quá lớn | Proxy giới hạn dung lượng: đặt `client_max_body_size 8m` (nginx) hoặc `max_size 8MB` (Caddy). |
| Server tự thoát ngay khi khởi động, log có `Refusing to start` | Chưa đặt `ADMIN_PASSPHRASE` thật trong `.env` (xem mục 2). |
| Quên mật khẩu admin | Sửa `ADMIN_PASSPHRASE` trong `.env`, restart dịch vụ. |
| Gõ mật khẩu admin đúng nhưng không vào được | Có thể đã bị khóa tạm do thử sai nhiều lần (8 lần/10 phút/IP): đợi 10 phút hoặc restart dịch vụ. |
| Bản đồ / cây 3D trống | Trình duyệt cần truy cập CDN (xem mục 12) và bật WebGL. |

---

## 12. Phụ thuộc bên ngoài (tải từ CDN khi người dùng mở trang)

Bootstrap, Font Awesome, Google Fonts (Be Vietnam Pro), Three.js, globe.gl, Cropper.js, và ảnh bản đồ Trái Đất từ `unpkg.com`.
Người dùng cần có Internet. Nếu cần chạy hoàn toàn nội bộ, tải các file này về thư mục `js/`, `css/` và sửa đường dẫn trong `index.html` / `create.html` / `js/main.js`.

## 13. Lưu ý về nội dung

Logo, favicon và các ảnh trong `images/photos/` lấy từ website chính thức của Greenwich Việt Nam. Hãy đảm bảo đơn vị vận hành có quyền sử dụng
chúng cho website công khai, hoặc thay bằng ảnh do nhà trường cung cấp.
