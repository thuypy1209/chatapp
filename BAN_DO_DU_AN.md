# 🗺️ BẢN ĐỒ DỰ ÁN – ChatFlex (ChatApp)

> **Cập nhật lần cuối:** 30/10/2026  
> **Thư mục local:** `F:\ChatApp`  
> **GitHub:** https://github.com/thuypy1209/chatapp  
> **Live URL:** https://chatflex-2vco.onrender.com  
> **Stack:** Node.js · Express 4 · EJS · MongoDB Atlas · Mongoose  

---

## 📁 CẤU TRÚC THƯ MỤC

```
F:/ChatApp/
├── app.js                        ← Điểm khởi tạo Express app
├── package.json                  ← Dependencies & scripts
├── .env                          ← Biến môi trường (không commit)
├── .env.example                  ← Mẫu file .env
├── .gitignore
│
├── bin/
│   └── www                       ← HTTP server, lắng nghe PORT
│
├── config/
│   └── admin.js                  ← Hằng số ADMIN_USERNAME, ADMIN_SECRET
│
├── routers/
│   ├── index.js                  ← Route gốc "/" → trang Home
│   ├── auth.js                   ← Đăng nhập / Đăng xuất (/auth)
│   ├── chat.js                   ← Chat kịch bản (/chat)
│   ├── mario.js                  ← Game Mario + Chat (/mario)
│   ├── admin.js                  ← Quản trị CRUD (/admin) [706 dòng]
│   └── users.js                  ← (Dự phòng)
│
├── schemas/
│   ├── Admin.js                  ← Model quản trị viên
│   ├── User.js                   ← Model người dùng chat
│   ├── Character.js              ← Model nhân vật chatbot
│   ├── Question.js               ← Model câu hỏi kịch bản
│   ├── Answer.js                 ← Model câu trả lời
│   ├── Audio.js                  ← Model file âm thanh
│   ├── Image.js                  ← Model ảnh kịch bản
│   └── Setting.js                ← Model cài đặt hệ thống (nhạc nền)
│
├── utils/
│   ├── auth.js                   ← Token HMAC, Bcrypt, seed SuperAdmin
│   ├── settings.js               ← Cache nhạc nền + đồng bộ MongoDB
│   ├── emoji.js                  ← Bộ sinh Avatar Emoji dễ thương (Server)
│   └── hash-generator.js         ← Tiện ích sinh hash (CLI)
│
├── views/
│   ├── error.ejs                 ← Trang lỗi chung
│   ├── partials/
│   │   ├── header.ejs            ← <head> + <nav> dùng chung [212 dòng]
│   │   ├── footer.ejs            ← </body></html> + script links
│   │   └── cardModal.ejs         ← Modal Tấm Thiệp động viên khi chơi game thua (Game Over)
│   ├── page/
│   │   └── home.ejs              ← Landing page
│   ├── user/
│   │   ├── Chat.ejs              ← Phòng chat chính [195 dòng]
│   │   ├── MarioChat.ejs         ← Game Mario + Chat [520 dòng]
│   │   └── SelectCharacter.ejs   ← Lưới chọn nhân vật
│   └── admin/
│       ├── Login.ejs             ← Đăng nhập Admin [87 dòng]
│       ├── Admin.ejs             ← Bảng điều khiển chính [1877 dòng]
│       ├── EditCharacter.ejs     ← Chỉnh sửa nhân vật [215 dòng]
│       ├── emojiModal.ejs        ← Modal kho emoji tìm kiếm & tra cứu liên kết online
│       └── index.ejs             ← (Không dùng)
│
├── public/
│   ├── stylesheets/
│   │   └── style.css             ← CSS toàn bộ app [2819 dòng]
│   ├── javascripts/
│   │   ├── chat.js               ← Engine chat client [585 dòng]
│   │   ├── mario.js              ← Game Mario 2D Canvas [1856 dòng]
│   │   ├── admin.js              ← Avatar Studio, Admin Panel [445 dòng]
│   │   ├── emoji-avatar.js       ← Bộ sinh Avatar Emoji dễ thương (Client)
│   │   ├── money-rain.js         ← Hiệu ứng mưa tiền xu [474 dòng]
│   │   ├── music-player.js       ← Music Player YouTube [865 dòng]
│   │   ├── minecraft-skeleton.js ← Skeleton chạy trang trí [468 dòng]
│   │   └── style.js              ← Tạo ngôi sao trang trí [21 dòng]
│   └── uploads/
│       ├── audios/               ← File nhạc MP3 do admin upload
│       ├── images/
│       │   ├── avatar/           ← Avatar nhân vật
│       │   ├── background/       ← Ảnh nền chat
│       │   └── default-bg.jpg
│       └── seeds/                ← File kịch bản .txt đã upload
```

---

## 🌐 TOÀN BỘ API ROUTES

### 🏠 Trang chủ – `/`
| Method | Path | View | Mô tả |
|--------|------|------|--------|
| GET | `/` | `page/home` | Hiển thị landing page, nhân vật mặc định & nút Chơi Mario |

---

### 🔐 Xác thực – `/auth`
> Rate limit: **20 request / 5 phút / IP**

| Method | Path | Mô tả |
|--------|------|--------|
| POST | `/auth/login` | Đăng nhập. Admin → xác thực Bcrypt → set cookie `chat_admin_token` (HttpOnly). User → kiểm tra trùng tên → tạo mới nếu chưa có → set cookie `chat_user` |
| POST | `/auth/logout` | Xóa 3 cookies, trả JSON `{success: true}` |
| GET | `/auth/logout` | Xóa 3 cookies, redirect `/` |

**Cookies:**
- `chat_admin_token` — HttpOnly, 7 ngày (chỉ Admin)
- `chat_user` — 7 ngày (tên người dùng)
- `chat_role` — 7 ngày (`'admin'` hoặc `'user'`)

---

### 💬 Chat kịch bản – `/chat`
| Method | Path | View | Mô tả |
|--------|------|------|--------|
| GET | `/chat/` | `user/Chat` | Mở phòng chat với nhân vật mặc định (`isDefault:true`) |
| GET | `/chat/:characterId` | `user/Chat` | Mở phòng chat với nhân vật cụ thể |
| POST | `/chat/ask` | JSON | Body: `{questionId}` → trả nội dung câu trả lời + media + `nextQuestions[]` |
| POST | `/chat/text-message` | JSON | Body: `{message, characterId}` → khớp regex kịch bản hoặc trả lời cứng theo từ khóa |
| POST | `/chat/reset` | JSON | Body: `{characterId}` → reset về `blockIndex:0`, trả câu hỏi ban đầu |

---

### 🎮 Mario & Chat – `/mario`
| Method | Path | View | Mô tả |
|--------|------|------|--------|
| GET | `/mario/` | `user/MarioChat` | Mở trang game Mario. Tự động tạo nhân vật Super Mario nếu chưa có |
| POST | `/mario/message` | JSON | Body: `{message}` → phản hồi chatbot theo từ khóa Mario/Minecraft |

---

### ⚙️ Quản trị – `/admin`
> 🔒 **Toàn bộ router yêu cầu cookie `chat_admin_token` hợp lệ**

#### Nhân vật (Character)
| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/admin/` | Render bảng điều khiển chính |
| POST | `/admin/character/add-full` | Upload multipart + parse file `.txt` kịch bản → tạo Character + Questions + Answers + Media |
| GET | `/admin/character/delete/:id` | Xóa nhân vật + file vật lý + toàn bộ Questions/Answers/Media liên quan |
| GET | `/admin/character/edit/:id` | Render form chỉnh sửa |
| POST | `/admin/character/update/:id` | Cập nhật thông tin + kịch bản (nếu upload file mới thì xóa cũ và tạo lại) |
| POST | `/admin/character/update-default/:id` | Set nhân vật này làm mặc định (unset tất cả còn lại) |

#### Nhạc nền (Music)
| Method | Path | Mô tả |
|--------|------|--------|
| POST | `/admin/music-setting` | Body: `{versionIndex, speed}` → cập nhật cài đặt nhạc nền (cache + DB) |
| POST | `/admin/music-versions` | Body: `{versions: [...]}` → cập nhật danh sách bài hát |
| POST | `/admin/music-upload` | Upload file MP3 → lưu `/uploads/audios/` → cập nhật `customAudioUrl` |

#### Quản lý tài khoản Admin ⭐ CHỈ SUPER ADMIN
| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/admin/api/accounts` | Lấy danh sách tài khoản Admin |
| POST | `/admin/api/accounts/create` | Tạo tài khoản Admin mới |
| POST | `/admin/api/accounts/change-password` | Đổi mật khẩu (không cho đổi tài khoản gốc `admin`) |
| POST | `/admin/api/accounts/delete` | Xóa tài khoản (không xóa gốc, không tự xóa mình, phải còn ít nhất 1) |

#### Quản lý người dùng Chat
| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/admin/api/chat-users` | Lấy tất cả người dùng đã vào chat (sort `lastActive` giảm dần) |
| POST | `/admin/api/chat-users/delete` | ⭐ CHỈ SUPER ADMIN – Xóa người dùng |

#### Quản lý Icon gợi ý (Custom Icons)
| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/admin/api/icons` | Lấy danh sách icon gợi ý nhanh |
| POST | `/admin/api/icons` | Lưu danh sách icon gợi ý (thêm/xóa) vào MongoDB Setting |

#### Quản lý Text Thiệp Game Over
| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/game-card` | API public lấy cấu hình text thiệp động viên |
| GET | `/admin/api/game-card` | Lấy cấu hình text thiệp cho Admin |
| POST | `/admin/api/game-card` | Cập nhật nội dung text thiệp vào MongoDB Setting (`game_over_card`) |

---

## 🗄️ SCHEMAS MONGODB

### `Admin` — Tài khoản quản trị
```
username      String   required, unique, trim, lowercase
passwordHash  String   required (Bcrypt)
fullName      String   default: 'Quản trị viên'
role          String   enum: ['superadmin', 'admin'], default: 'admin'
createdAt     Date     default: Date.now
lastLogin     Date
```
**Methods:** `comparePassword()`, `Admin.hashPassword()`

---

### `User` — Người dùng chat
```
username    String   required, unique, trim
isAdmin     Boolean  default: false
lastActive  Date     default: null (null = chưa từng hoạt động)
lastPage    String   default: 'Phòng Chat'
visitCount  Number   default: 1
createdAt   Date     default: Date.now
```

---

### `Character` — Nhân vật chatbot
```
name            String   required
avatarUrl       String   URL ảnh đại diện
description     String   Mô tả ngắn
backgroudUrl    String   URL ảnh nền chat (⚠️ typo: backgroud)
audioUrl        String   URL âm thanh nhân vật
scriptFilename  String   Tên file kịch bản .txt
icon            String
isDefault       Boolean  default: false
```

---

### `Question` — Câu hỏi kịch bản
```
questionText   String     required
answerId       ObjectId   ref: 'Answer'
imageId        ObjectId   ref: 'Image'
audioId        ObjectId   ref: 'Audio'
characterId    ObjectId   ref: 'Character'
nextQuestions  [ObjectId] ref: 'Question' — các câu hỏi tiếp theo
blockIndex     Number     default: 0 (chỉ số khối trong kịch bản)
createdAt      Date       auto
updatedAt      Date       auto
```

---

### `Answer` — Câu trả lời
```
answerText  String  required
```

---

### `Audio` — File âm thanh
```
audioUrl  String  required
fileName  String
```

---

### `Image` — Ảnh kịch bản
```
imageUrl  String  required
fileName  String
```

---

### `Setting` — Cài đặt hệ thống
```
key        String  required, unique (VD: 'music_setting')
value      Mixed   required (object, number, string...)
updatedAt  Date    default: Date.now
```

---

## 📄 FILE KỊ CH BẢN `.TXT` — ĐỊNH DẠNG CHUẨN

```
Q: [Câu hỏi nút bấm]
A: [Câu trả lời chatbot]
IMAGE: [URL ảnh, tuỳ chọn]
AUDIO: [URL âm thanh, tuỳ chọn]
---
Q: [Câu hỏi tiếp theo]
A: [Câu trả lời tiếp theo]
---
```

> Mỗi khối (`blockIndex`) cách nhau bằng dấu `---`. Câu hỏi ở khối trước sẽ dẫn đến các câu hỏi của khối tiếp theo qua `nextQuestions`.

---

## 🧩 JAVASCRIPT CLIENT — Tổng quan

| File | Dòng | Chức năng |
|------|------|-----------|
| `chat.js` | 585 | Engine chat: xử lý nút câu hỏi, free-text, typing indicator, TTS, reset chat, toggle Mario panel |
| `mario.js` | 1856 | Game Mario 2D Canvas: vật lý, va chạm, skin Minecraft/Classic, âm thanh Web Audio API |
| `admin.js` | 445 | Avatar Studio (upload/drag-drop/preset), Icon Picker, Script Preview, Audio Preview, Dynamic Nodes |
| `money-rain.js` | 474 | Hiệu ứng mưa tiền xu vàng & tiền giấy rơi toàn màn hình, click tung tiền, âm thanh Mario coin |
| `music-player.js` | 865 | YouTube IFrame Player, polling đồng bộ nhạc theo thời gian thực (`/api/music-setting`), điều khiển tốc độ |
| `minecraft-skeleton.js` | 468 | Skeleton Minecraft tuần tra qua lại dải Mario Ground, click giật mình nhảy, rớt xương |
| `style.js` | 21 | Sinh ngẫu nhiên 25 ngôi sao ✦ ✧ lên `.starry-sky` khi DOMContentLoaded |

---

## 🎨 CSS — `style.css` (2819 dòng)
- **Pastel Glassmorphism** theme: hồng – xanh pastel, `backdrop-filter: blur`
- **Retro Mario Ground**: dải nền pixel art ở footer
- **Responsive**: mobile-first, có media query cho màn hình nhỏ
- **Component chính:**
  - `.navbar`, `.cloud-retro`, `.starry-sky`, `.mario-ground`
  - `.chat-bubble`, `.chat-bubble-bot`, `.question-btn`
  - `.admin-card`, `.admin-modal-overlay`, `.admin-modal-box`
  - `.admin-badge-viewonly`, `.admin-badge-protected`
  - `#money-rain-canvas` (pointer-events: none, z-index: 99)
  - `.mario-panel`, `#mario-canvas`

---

## 🔧 UTILS

### `utils/auth.js` — Xác thực Token
- **Token format:** `base64(JSON{u, exp}).HMAC-SHA256` (không phải JWT)
- **`seedSuperAdmin()`** — Tự tạo SuperAdmin từ `.env` nếu DB trống
- **`generateAdminToken(username, 7d)`** — Tạo token 7 ngày
- **`verifyAdminToken(token)`** — Chống timing attack với `crypto.timingSafeEqual`
- **`checkAdminPassword(username, pw)`** — So sánh bcrypt + cập nhật `lastLogin`

### `utils/settings.js` — Nhạc nền
- **In-memory cache** `cachedMusicSetting` → đọc 0ms latency
- **`initSettings()`** — Load từ MongoDB sau 1.5s khởi động
- **`getMusicSetting()`** — Trả cache ngay
- **`updateMusicSetting(obj)`** — Merge cache + upsert DB (`key: 'music_setting'`)
- **4 bài nhạc mặc định:** "Graduation" – NCT DREAM (Piano Cover, MV, Acoustic, Lofi)

---

## 🖥️ VIEWS — CHI TIẾT

### `views/partials/header.ejs` (212 dòng)
- `<head>`: charset, viewport, `/stylesheets/style.css`
- `<nav>`: Brand 🍄 → `/`, Nav links: Trang chủ / Phòng Chat / Mario & Chat / ⚙️ Quản trị (nếu `isAdmin`)
- Modal nhập tên người dùng (welcome popup) → POST `/auth/login`
- Trang trí: `.cloud-retro`, `.starry-sky`, Mario Ground
- Script: `money-rain.js`, `music-player.js`, `minecraft-skeleton.js`

### `views/page/home.ejs`
- Tên app: **"Phổi bạn không phải tôi"**
- Nút **Trò chuyện** → `/chat/:defaultCharacter._id`
- Nút **Chơi Super Mario & Chat** → `/mario`

### `views/user/Chat.ejs` (195 dòng)
- Hiển thị: avatar nhân vật, tên, bong bóng chat
- Nút câu hỏi kịch bản → POST `/chat/ask`
- Ô nhập text → POST `/chat/text-message`
- Nút Reset → POST `/chat/reset`
- Nút bật/tắt Mario panel song song

### `views/user/MarioChat.ejs` (520 dòng)
- `<canvas id="mario-canvas">` — Game chạy 120 FPS
- Skin toggle: Minecraft ↔ Classic
- Fullscreen + âm thanh on/off
- Sidebar chat → POST `/mario/message`
- Nhúng script `mario.js` trực tiếp

### `views/admin/Admin.ejs` (1877 dòng) — 4 Section chính
1. **Form thêm nhân vật** + Upload kịch bản `.txt` + avatar/bg/audio
2. **Danh sách nhân vật**: thẻ card, nút Đặt mặc định / Sửa / Xóa
3. **Quản lý tài khoản Admin** ⭐ SUPER ADMIN ONLY: thêm/đổi mật khẩu/xóa (Custom Modal)
4. **Danh sách Chat Users**: tên / lần đầu vào / hoạt động gần nhất / trang truy cập / số lần / Xóa (⭐ SUPER ADMIN) hoặc 👁️ Chỉ xem (Admin thường)

---

## 👤 PHÂN QUYỀN

| Vai trò | Tài khoản hiện tại | Quyền |
|---------|-------------------|-------|
| ⭐ **Super Admin** | `admin`, `hoangyen` | Toàn quyền: CRUD nhân vật, quản lý Admin, xóa Chat User, đổi nhạc |
| 👤 **Admin thường** | `tehau` | Chỉ xem Chat Users, quản lý nhân vật, KHÔNG xóa Chat User, KHÔNG quản lý tài khoản |

**Bảo vệ tài khoản gốc `admin`:**
- Không thể đổi mật khẩu từ giao diện
- Không thể xóa

---

## 🔄 LUỒNG HOẠT ĐỘNG CHÍNH

### Luồng Chat Kịch Bản
```
User → nhập tên (home) → POST /auth/login → cookie chat_user
→ GET /chat/:characterId → render Chat.ejs
→ Click câu hỏi → POST /chat/ask (questionId)
  → Mongoose: Question.findById().populate(answer, image, audio, nextQuestions)
  → Trả JSON: {questionText, answerText, imageUrl, audioUrl, nextQuestions[]}
→ chat.js render bong bóng chat + hiển thị nút nextQuestions
→ Repeat
```

### Luồng Upload Kịch Bản
```
Admin → Admin.ejs form → POST /admin/character/add-full (multipart)
→ multer lưu file .txt vào /uploads/seeds/
→ Parse file: tách khối theo "---", tách Q: / A: / IMAGE: / AUDIO:
→ Tạo: Answer → Image/Audio (nếu có) → Question (blockIndex i)
→ Sau khi tạo hết: link nextQuestions[i] = questions[i+1]
→ Character.scriptFilename = tên file
→ redirect /admin
```

### Luồng Đồng Bộ Nhạc Thực Thời Gian Thực
```
Admin → POST /admin/music-setting {versionIndex, speed}
→ settings.js: updateMusicSetting() → cập nhật cache + MongoDB
→ music-player.js (client): mỗi 8s polling GET /api/music-setting
→ So sánh updatedAt → nếu khác → tải bài hát mới trên YouTube IFrame
→ Tất cả người dùng đang online tự động đổi nhạc
```

---

## 🐛 LỖI ĐÃ BIẾT / GHI CHÚ

| # | Vấn đề | Trạng thái |
|---|--------|------------|
| 1 | `Character.backgroudUrl` — typo thiếu chữ `n` | Tồn tại trong DB, cần cẩn thận khi query |
| 2 | `<script src="admin.js">` thiếu thẻ đóng `</script>` (đã fix commit `85c4f3e`) | ✅ Đã sửa |
| 3 | `lastActive` default `Date.now` gây timestamp giả (đã fix) | ✅ Đã sửa (default: null) |
| 4 | Modal xóa bị kẹt trong section thay vì cấp body (đã fix) | ✅ Đã sửa |
| 5 | Server Render chạy UTC → lệch 7 tiếng so với VN | ✅ Dùng `toLocaleString('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh'})` |

---

## 📦 DEPENDENCIES

| Package | Version | Dùng để |
|---------|---------|---------|
| `express` | ~4.16.1 | Web framework |
| `ejs` | ~2.6.1 | Template engine |
| `mongoose` | ^9.11.2 | ODM cho MongoDB |
| `bcryptjs` | ^3.0.3 | Hash mật khẩu Admin |
| `cookie-parser` | ~1.4.4 | Đọc cookies |
| `multer` | ^2.4.0 | Upload file |
| `helmet` | ^8.3.0 | HTTP security headers |
| `express-rate-limit` | ^8.7.1 | Rate limiting login |
| `dotenv` | ^18.0.9 | Load biến môi trường |
| `morgan` | ~1.9.1 | HTTP request logger |
| `nodemon` | ^3.1.14 | Dev hot-reload |

---

## 🌍 BIẾN MÔI TRƯỜNG (`.env`)

```env
MONGODB_URI=mongodb+srv://...       # Chuỗi kết nối MongoDB Atlas
ADMIN_USERNAME=admin                 # Username Super Admin gốc
ADMIN_PASSWORD=...                   # Mật khẩu Super Admin gốc
ADMIN_SECRET=...                     # Khóa ký token HMAC-SHA256
PORT=3000                            # Port (Render tự inject)
```

---

## 📜 LỊCH SỬ COMMIT QUAN TRỌNG

| Commit | Nội dung |
|--------|----------|
| `HEAD` | Random Text Thiệp: Thêm kho lời nhắn ngẫu nhiên khi thua game Mario, hỗ trợ CRUD danh sách câu và nút đổi lời chúc 🎲 |
| `657abe0` | Set animal avatar: Add cool 3D motorcycle cat avatar image and sanitize emoji list to 100% animals |
| `758b13d` | Add heartwarming Game Over Greeting Card modal and canvas drawing with custom admin text settings |
| `2537cbb` | Apply Impeccable UI polish: rounded Quicksand font, glow focus rings, micro-interaction animations |
| `aa49aa9` | Fix hardcoded gamepad icon: dynamically bind default icon to saved admin icons |
| `85c4f3e` | Fix script tag, chuyển modal xóa ra ngoài body, tăng z-index |
| `a9206c0` | Phân quyền Super Admin: chỉ Super Admin xóa Chat User, Custom Modal |
| `b7b400c` | Sửa timestamp giả lastActive, force múi giờ GMT+7 |
| `221691a` | Thêm section Chat Users vào trang Admin |
| `a41f810` | Custom Modal đổi mật khẩu & xóa tài khoản Admin |
| `7e483f4` | Bảo vệ tài khoản Super Admin gốc khỏi bị xóa/đổi mật khẩu |
| `93802be` | Refactor CSS: tách inline styles vào style.css |
| `fa3d94b` | Hỗ trợ touch screen / D-pad di động cho game Mario |
| `4323d5a` | Security hardening: Rate limit, Helmet, Token expiry |
| `a5f090b` | Initial commit |
