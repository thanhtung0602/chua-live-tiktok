# Chùa Online · TikTok LIVE MVP

MVP game 2D một bản đồ **Chính điện** cho OBS Browser Source. Người xem được biểu diễn bằng nhân vật chibi đi từ cổng vào lễ Phật; quà tặng đi qua hàng đợi vinh danh với camera zoom mượt. Bản này chạy hoàn toàn bằng sự kiện giả lập trước khi nối nguồn LIVE hợp lệ.

## Chạy nhanh

```powershell
Copy-Item .env.example .env
npm.cmd install
npm.cmd start
```

- Màn game / OBS Browser Source: `http://localhost:3000/`
- Trang quản trị: `http://localhost:3000/admin`
- Kiểm tra mã nguồn: `npm.cmd run check`

Trong OBS, thêm Browser Source ở 1920×1080 (hoặc tỷ lệ 16:9), dùng URL màn game. Nếu Chromium chặn autoplay, nhấn **Bật âm thanh** một lần trong nguồn trình duyệt; audio sau đó tiếp tục chạy khi có người vào/ra hoặc nhận quà.

## Đã triển khai

- Chính điện Phaser 3 16:9 vẽ bằng Graphics: tượng Phật, bàn thờ, hoa sen, đèn lồng, cột, cổng và sàn phối cảnh; không phụ thuộc ảnh bên ngoài.
- Người xem định danh chỉ tạo một lần theo `viewer.id`; tim lặp lại chỉ cập nhật hoạt động. Tim thiếu danh tính chỉ cộng thống kê.
- Luồng nhân vật: cổng → đi vào → quỳ/chắp tay → đứng dậy → về cổng. Slot chỉ được giải phóng sau khi ra khỏi bản đồ.
- Rời chùa bằng từ khóa bình luận, nút admin, hoặc thời gian không hoạt động cấu hình được. Không coi việc ngừng thả tim là rời chùa.
- Hàng đợi quà ưu tiên cao trước, FIFO cùng mức; camera chỉ zoom một quà tại một lúc, có bảng vinh danh avatar/nickname/username/quà và hiệu ứng hoa sen, kim quang, chuông, Sư Tử.
- Người tặng chưa có mặt nhận nhân vật vinh danh tạm thời nếu còn slot; nếu đầy, bảng vinh danh vẫn hiện mà không tạo người trùng.
- Playlist bài kinh: upload, play/pause/next/previous, âm lượng, phát lần lượt/ngẫu nhiên, lặp và crossfade trong browser client.
- Admin quản lý nhân vật, nhạc, quà, cấu hình, trạng thái nguồn LIVE và các sự kiện giả lập.
- Express + Socket.IO realtime, JSON persistence mặc định, SQL Server adapter/schema tùy chọn.

## Thử ngay

1. Mở `/admin`.
2. Trong **Tổng quan**, gửi Tim với `viewerId` bất kỳ. Gửi lại cùng mã để xác nhận không tạo nhân vật trùng.
3. Chọn Quà trong khối giả lập rồi gửi `Sư Tử` để xem queue, zoom camera và hiệu ứng.
4. Gửi bình luận `!roi` để nhân vật rời chùa.
5. Tải file audio hợp pháp tại **Âm thanh & kinh**, sau đó bấm phát.

## Kết nối TikTok LIVE hợp lệ

Ứng dụng **không** scraping, reverse-engineer hoặc mở socket LIVE không công khai. Adapter chỉ nhận sự kiện chuẩn hóa từ API chính thức hoặc nhà cung cấp được phép.

Đặt `LIVE_WEBHOOK_SECRET` trong `.env`, sau đó nguồn tích hợp gọi endpoint sau:

```http
POST /api/live/events
x-live-secret: <LIVE_WEBHOOK_SECRET>
Content-Type: application/json
```

Ví dụ Like định danh:

```json
{
  "type": "like",
  "eventId": "provider-like-001",
  "count": 1,
  "viewer": {
    "id": "stable-provider-viewer-id",
    "username": "thanh_tung",
    "nickname": "Thanh Tùng",
    "avatarUrl": "https://..."
  }
}
```

Ví dụ quà:

```json
{
  "type": "gift",
  "eventId": "provider-gift-001",
  "giftId": "lion",
  "repeatCount": 1,
  "viewer": { "id": "stable-provider-viewer-id", "username": "thanh_tung", "nickname": "Thanh Tùng" }
}
```

`eventId` quà được dùng để bỏ qua bản phát lại trùng trong phiên chạy. Quà ánh xạ theo `giftId` tại tab **Quà tặng**. Bật nguồn ở admin sẽ chuyển trạng thái sang “chờ webhook”; nhà cung cấp thực tế chịu trách nhiệm OAuth/API và kiểm tra chữ ký riêng nếu có.

Đặt `ADMIN_TOKEN` trước khi public server. Khi đó API quản trị yêu cầu `x-admin-token`; nhập giá trị ở góc phải trang admin. Trong production, nên dùng HTTPS + reverse proxy và giới hạn truy cập `/admin`.

## SQL Server

Local development dùng `data/state.json`, nên chạy ngay không cần SQL Server. Để dùng SQL Server:

1. Tạo database `temple_live` (hoặc tên riêng).
2. Chạy [database/schema.sql](database/schema.sql).
3. Điền `DB_SERVER`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD`, `DB_ENCRYPT` trong `.env`.
4. Khởi động lại server.

Adapter lưu cấu hình MVP nguyên tử trong `dbo.AppSettings`; schema đồng thời chuẩn bị `Viewers`, `TemplePresences`, `GiftConfigs`, `GiftEvents` và `AudioTracks` cho báo cáo/mở rộng production.

## Cấu trúc

`server/` — Express, Socket.IO, REST, upload, webhook và service game  
`public/game/` — Phaser chính điện + broadcast UI  
`public/admin/` — Trang quản trị không framework  
`database/` — SQL Server schema

## Lưu ý vận hành

- Chỉ upload/phát audio và dùng ảnh/quà khi có quyền sử dụng.
- Hiện diện là runtime: khi server khởi động lại, chính điện bắt đầu trống để không tái tạo người xem cũ sai trạng thái.
- Xóa bài khỏi playlist giữ lại file trong `public/uploads/audio` để tránh mất dữ liệu khó khôi phục; dọn thủ công sau khi sao lưu.
- Với lưu lượng lớn, chạy Node sau process manager, proxy Socket.IO bằng WebSocket sticky session nếu nhiều instance, và đưa event audit/metrics vào SQL Server theo schema đã có.
