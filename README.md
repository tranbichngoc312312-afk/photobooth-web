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
| `style.css` | Giao diện, gồm cả kho khung |
| `frames.js` | Dữ liệu khung ảnh và các hàm vẽ khung (`window.NohaFrames`) |
| `script.js` | Luồng chụp, ghép khung, tải ảnh |
| `social.js` | Khoảnh khắc, tin nhắn (Supabase) |

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
