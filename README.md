# NoHa · Tiệm Photobooth

Website photobooth chạy hoàn toàn trên trình duyệt (GitHub Pages), không cần backend cho phần chụp ảnh.

## Chạy thử trên máy

Camera chỉ hoạt động trên `https` hoặc `localhost`, nên cần mở qua một máy chủ tĩnh, không mở thẳng file:

```bash
npx serve .
```

Rồi mở địa chỉ mà lệnh in ra (ví dụ `http://localhost:3000`).

## Cấu trúc

| File | Nội dung |
| --- | --- |
| `index.html` | Giao diện |
| `style.css` | Giao diện, gồm cả nút làm đẹp và kho khung |
| `frames.js` | Dữ liệu khung ảnh và các hàm vẽ khung (`window.NohaFrames`) |
| `beauty.js` | Làm đẹp tự động "Đẹp tự nhiên" (`window.NohaBeauty`) |
| `script.js` | Luồng chụp, ghép khung, tải ảnh |
| `social.js` | Khoảnh khắc, tin nhắn (Supabase) |
| `assets/models/face_landmarker.task` | Mô hình nhận diện khuôn mặt MediaPipe (float16) |

## Làm đẹp tự động

- Bật mặc định. Nút ✨ trên camera để bật/tắt, lựa chọn được nhớ trong trình duyệt.
- Nhận diện tối đa 6 khuôn mặt bằng [MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) chạy ngay trên thiết bị. Ảnh **không** được gửi đi đâu. Thư viện (`@mediapipe/tasks-vision@0.10.35`, khoảng 11 MB WASM) tải từ jsDelivr ở lần đầu bật camera rồi được cache.
- Chỉ xử lý theo vùng: da mặt (trừ mắt, lông mày, miệng) được làm mịn giữ biên và nâng sáng nhẹ; môi và má được tô nhẹ. Tóc, mắt, nền giữ nguyên. Không thay đổi hình dạng khuôn mặt.
- Mức hiệu ứng nằm trong `LOOK` ở đầu `beauty.js`.
- Hiệu ứng được "in" vào ảnh lúc chụp (và ảnh tải lên khi đang bật), nên ảnh tải xuống giống hệt màn hình xem trước.
- Trình duyệt không có WebGL, không tải được thư viện, hoặc máy quá chậm (dưới ~6 khung hình/giây): tự tắt làm đẹp, báo cho người dùng, vẫn chụp ảnh gốc bình thường.

## Thêm khung ảnh mới

Thêm một object vào `FRAME_TEMPLATES` trong `frames.js`:

```js
{
  id: "ten-khung",            // duy nhất
  name: "Tên hiển thị",
  category: "cute",           // minimal | cute | couple | group | season
  access: "free",             // "unlock" = cần mở khóa (xu NoHa sau này)
  palette: { ink: "#5b376d" },  // màu chữ
  background: { type: "linear", stops: ["#ffe0eb", "#ffd0e0"] },
  decorations: [
    { type: "scatter", layer: "front", shape: "heart", density: 8,
      size: [18, 30], colors: ["#ff5c8a"], seed: 1 }
  ],
  photo: { radius: 18, border: { color: "#ffffff", width: 8 } },
  text: { titleFont: "script", subtitle: "DÒNG CHỮ DƯỚI", date: true }
}
```

Ảnh xem trước trong danh sách và ảnh xuất ra dùng chung hàm vẽ, nên khung mới tự khớp với mọi layout.

## Chuẩn bị cho giai đoạn sau (minigame "Vườn kỷ niệm NoHa")

Chưa xây minigame. Đã có sẵn các điểm nối:

- Sự kiện trên `document`: `noha:photo-captured` (mỗi ảnh chụp) và `noha:photobooth-downloaded` (mỗi lần tải ảnh). Minigame chỉ cần lắng nghe hai sự kiện này để cộng nước tưới/phân bón.
- Khung `access: "unlock"` hiện biểu tượng 🔒. `NohaFrames.unlock(id)` mở khóa và lưu vào `localStorage` (khóa `noha.unlockedFrames`).
