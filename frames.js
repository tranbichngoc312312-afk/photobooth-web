"use strict";

/*
 * NoHa · Kho khung ảnh
 *
 * Mỗi khung là một mục dữ liệu trong FRAME_TEMPLATES. Ảnh xem trước nhỏ và
 * ảnh tải xuống dùng chung các hàm vẽ bên dưới nên luôn khớp bố cục.
 *
 * Thêm khung mới: thêm một object vào FRAME_TEMPLATES với
 *   id, name, category (xem CATEGORIES), access, palette,
 *   background, decorations, photo, text.
 *
 * access:
 *   "free"   — dùng ngay.
 *   "unlock" — cần mở khóa (giai đoạn sau: đổi bằng xu NoHa trong
 *              "Vườn kỷ niệm"). Danh sách khung đã mở lưu ở localStorage
 *              khóa UNLOCK_STORAGE_KEY; dùng NohaFrames.unlock(id).
 */
window.NohaFrames = (() => {
  const UNLOCK_STORAGE_KEY = "noha.unlockedFrames";

  const CATEGORIES = [
    { id: "all", name: "Tất cả" },
    { id: "trend", name: "Hot trend" },
    { id: "korean", name: "Kiểu Hàn" },
    { id: "event", name: "Lễ & sự kiện" },
    { id: "season", name: "Theo mùa" },
    { id: "minimal", name: "Tối giản" },
    { id: "cute", name: "Dễ thương" },
    { id: "couple", name: "Chụp đôi" },
    { id: "group", name: "Nhóm bạn" }
  ];

  const BRAND_TEXT = {
    title: "NoHa",
    titleFont: "serif",
    subtitle: "TIỆM PHOTOBOOTH",
    date: false
  };

  const FRAME_TEMPLATES = [
    /* ===== Khung gốc của NoHa ===== */
    {
      id: "pink",
      name: "NoHa Hồng",
      category: "cute",
      access: "free",
      palette: { ink: "#ffffff" },
      background: { type: "solid", color: "#ff98bc" },
      decorations: [{ type: "cornerFlowers", layer: "front" }]
    },
    {
      id: "cream",
      name: "Kem ngọt",
      category: "minimal",
      access: "free",
      palette: { ink: "#694d3e" },
      background: { type: "solid", color: "#f0dfbd" },
      decorations: [{ type: "cornerFlowers", layer: "front" }]
    },
    {
      id: "sky",
      name: "Trời xanh",
      category: "minimal",
      access: "free",
      palette: { ink: "#ffffff" },
      background: { type: "solid", color: "#88c8ee" },
      decorations: [{ type: "cornerFlowers", layer: "front" }]
    },
    {
      id: "film",
      name: "Film cổ điển",
      category: "trend",
      access: "free",
      palette: { ink: "#f7dfb9" },
      background: { type: "solid", color: "#292329" },
      photo: { extras: ["filmMarks"] }
    },
    {
      id: "mono",
      name: "Đen trắng",
      category: "minimal",
      access: "free",
      palette: { ink: "#ffffff" },
      background: { type: "solid", color: "#111111" },
      decorations: [{ type: "frameBorder", layer: "front", color: "#ffffff" }]
    },
    {
      id: "none",
      name: "Tối giản",
      category: "minimal",
      access: "free",
      palette: { ink: "#5b376d" },
      background: { type: "solid", color: "#ffffff" },
      decorations: [{ type: "singleFooterBand", layer: "top" }]
    },
    {
      // Nền cho khung PNG người dùng tự tải lên
      id: "custom",
      name: "Khung riêng",
      category: "minimal",
      access: "free",
      hidden: true,
      palette: { ink: "#5b376d" },
      background: { type: "solid", color: "#ffffff" }
    },

    /* ===== Khung mới ===== */
    {
      id: "minimal-white",
      name: "Trắng tinh",
      category: "minimal",
      access: "free",
      palette: { ink: "#5b376d" },
      background: { type: "solid", color: "#fffdfb" },
      decorations: [
        { type: "insetLine", layer: "front", color: "#ead7e1", inset: 26, width: 2 }
      ],
      photo: { radius: 8 },
      text: { date: true }
    },
    {
      id: "cute-strawberry",
      name: "Dâu sữa",
      category: "cute",
      access: "free",
      palette: { ink: "#e4568c" },
      background: { type: "solid", color: "#ffe0eb" },
      decorations: [
        { type: "dots", layer: "back", color: "#ffffff", radius: 9, spacing: 44 },
        {
          type: "scatter",
          layer: "front",
          shape: "heart",
          density: 9,
          size: [18, 30],
          colors: ["#ff5c8a", "#ff8fb1"],
          seed: 11
        }
      ],
      photo: { radius: 22, border: { color: "#ffffff", width: 10 } },
      text: { titleFont: "script", subtitle: "NGỌT NHƯ DÂU" }
    },
    {
      id: "cute-cloud",
      name: "Mây kẹo bông",
      category: "cute",
      access: "free",
      palette: { ink: "#7a5cc4" },
      background: {
        type: "linear",
        stops: ["#d4e6ff", "#efdcff", "#ffe1f0"]
      },
      decorations: [
        {
          type: "scatter",
          layer: "back",
          shape: "cloud",
          density: 5,
          size: [40, 70],
          colors: ["rgba(255,255,255,0.9)"],
          seed: 4
        },
        {
          type: "scatter",
          layer: "front",
          shape: "sparkle",
          density: 8,
          size: [14, 26],
          colors: ["#ffffff", "#ffe38a"],
          seed: 9
        }
      ],
      photo: { radius: 26, border: { color: "#ffffff", width: 8 } },
      text: { titleFont: "script", subtitle: "MƠ MỘT GIẤC MÂY" }
    },
    {
      id: "couple-heart",
      name: "Tim đôi",
      category: "couple",
      access: "free",
      palette: { ink: "#ffffff" },
      background: {
        type: "linear",
        stops: ["#ff7aa2", "#ffb3c7"]
      },
      decorations: [
        {
          type: "scatter",
          layer: "back",
          shape: "heart",
          area: "all",
          density: 14,
          size: [16, 42],
          colors: ["rgba(255,255,255,0.28)"],
          seed: 21
        },
        {
          type: "scatter",
          layer: "front",
          shape: "heart",
          density: 6,
          size: [20, 32],
          colors: ["#ffffff", "#d93668"],
          seed: 5
        }
      ],
      photo: { radius: 18, border: { color: "#ffffff", width: 8 } },
      text: {
        titleFont: "script",
        subtitle: "HAI ĐỨA MÌNH",
        date: true,
        shadow: "rgba(140,30,70,0.25)"
      }
    },
    {
      id: "couple-letter",
      name: "Thư tình",
      category: "couple",
      access: "free",
      palette: { ink: "#b5485f" },
      background: { type: "ruled", color: "#fbf3e6", line: "#f1e1ca", spacing: 34 },
      decorations: [
        { type: "stamp", layer: "front", color: "#d9536f" },
        {
          type: "scatter",
          layer: "front",
          shape: "heart",
          density: 4,
          size: [14, 22],
          colors: ["#d9536f"],
          seed: 3
        }
      ],
      photo: {
        radius: 6,
        border: { color: "#ffffff", width: 12 },
        shadow: "rgba(110,70,40,0.22)"
      },
      text: { titleFont: "script", subtitle: "GỬI NGƯỜI THƯƠNG", date: true }
    },
    {
      id: "group-bestie",
      name: "Hội bạn thân",
      category: "group",
      access: "free",
      palette: { ink: "#5b376d" },
      background: {
        type: "linear",
        stops: ["#ffe066", "#ffb978"]
      },
      decorations: [
        {
          type: "scatter",
          layer: "back",
          shape: "confetti",
          area: "all",
          density: 28,
          size: [10, 18],
          colors: ["#ff7bab", "#8c6cf2", "#ffffff", "#36c2b4"],
          seed: 7
        }
      ],
      photo: { radius: 14, border: { color: "#ffffff", width: 8 } },
      text: {
        subtitle: "HỘI BẠN THÂN",
        date: true,
        shadow: "rgba(255,255,255,0.7)"
      }
    },
    {
      id: "group-party",
      name: "Đêm tiệc",
      category: "group",
      access: "free",
      palette: { ink: "#ffffff" },
      background: {
        type: "linear",
        stops: ["#2b2350", "#4b2b6e"]
      },
      decorations: [
        {
          type: "scatter",
          layer: "back",
          shape: "confetti",
          area: "all",
          density: 16,
          size: [8, 14],
          colors: ["#ff8fc0", "#ffd66b", "#7fd8ff"],
          seed: 13
        },
        {
          type: "scatter",
          layer: "front",
          shape: "star",
          density: 7,
          size: [16, 28],
          colors: ["#ffd66b", "#ff8fc0"],
          seed: 2
        }
      ],
      photo: { radius: 16, border: { color: "#ffd66b", width: 4 } },
      text: { subtitle: "CẢ HỘI CÙNG QUẨY", date: true }
    },
    {
      id: "season-autumn",
      name: "Thu Hà Nội",
      category: "season",
      access: "free",
      palette: { ink: "#6b3b22" },
      background: {
        type: "linear",
        stops: ["#f7e4c3", "#ecbf8e"]
      },
      decorations: [
        {
          type: "scatter",
          layer: "back",
          shape: "leaf",
          area: "all",
          density: 10,
          size: [26, 44],
          colors: ["rgba(217,119,58,0.45)", "rgba(184,87,42,0.4)"],
          seed: 17
        },
        {
          type: "scatter",
          layer: "front",
          shape: "leaf",
          density: 6,
          size: [24, 38],
          colors: ["#d9773a", "#b8572a", "#e8a23c"],
          seed: 8
        }
      ],
      photo: { radius: 12, border: { color: "#fff7ec", width: 8 } },
      text: { titleFont: "script", subtitle: "MÙA THU", date: true }
    },
    {
      id: "trend-y2k",
      name: "Y2K lấp lánh",
      category: "trend",
      access: "free",
      palette: { ink: "#6b4fd8" },
      background: {
        type: "linear",
        angle: 135,
        stops: ["#e3e7ff", "#ffd6f5", "#d3fff4"]
      },
      decorations: [
        {
          type: "scatter",
          layer: "front",
          shape: "sparkle",
          density: 11,
          size: [14, 34],
          colors: ["#ffffff", "#b79bff", "#ff9bd8"],
          seed: 6
        }
      ],
      photo: { radius: 30, border: { color: "#ffffff", width: 6 } },
      text: { titleFont: "bold", subtitle: "Y2K MOOD ✦", shadow: "rgba(255,255,255,0.9)" }
    },
    {
      id: "season-christmas",
      name: "Giáng sinh",
      category: "season",
      access: "free",
      palette: { ink: "#fff3e0" },
      background: {
        type: "linear",
        stops: ["#1f5b45", "#164331"]
      },
      decorations: [
        {
          type: "scatter",
          layer: "back",
          shape: "circle",
          area: "all",
          density: 30,
          size: [4, 9],
          colors: ["rgba(255,255,255,0.55)"],
          seed: 19
        },
        {
          type: "scatter",
          layer: "front",
          shape: "snowflake",
          density: 6,
          size: [20, 34],
          colors: ["#ffffff"],
          seed: 4
        },
        {
          type: "scatter",
          layer: "front",
          shape: "circle",
          density: 4,
          size: [8, 12],
          colors: ["#e8404f"],
          seed: 12
        }
      ],
      photo: { radius: 14, border: { color: "#ffffff", width: 8 } },
      text: { titleFont: "script", subtitle: "MERRY CHRISTMAS", date: true }
    },

    /* ===== Khung hot trend & sự kiện ===== */
    {
      id: "event-graduation",
      name: "Tốt nghiệp",
      category: "event",
      access: "free",
      palette: { ink: "#ffe7a3" },
      background: {
        type: "linear",
        stops: ["#2b4c8c", "#162a52"]
      },
      decorations: [
        {
          type: "scatter",
          layer: "back",
          shape: "confetti",
          area: "all",
          density: 14,
          size: [8, 14],
          colors: ["#f5c542", "#ffffff", "#d9b44a"],
          seed: 31
        },
        {
          type: "scatter",
          layer: "front",
          shape: "gradCap",
          density: 5,
          size: [36, 52],
          colors: ["#0a0f1f"],
          seed: 32
        }
      ],
      photo: { radius: 14, border: { color: "#f5c542", width: 5 } },
      text: { titleFont: "script", subtitle: "CLASS OF {year}", date: true }
    },
    {
      id: "event-graduation-paper",
      name: "Bằng tốt nghiệp",
      category: "event",
      access: "free",
      palette: { ink: "#1d2b5a" },
      background: { type: "solid", color: "#fbf6ea" },
      decorations: [
        { type: "doubleBorder", layer: "front", color: "#c9a227", inset: 18, gap: 10, width: 4 },
        { type: "corners", layer: "front", shape: "gradCap", colors: ["#1d2b5a"], size: 44, inset: 72 }
      ],
      photo: {
        radius: 6,
        border: { color: "#ffffff", width: 10 },
        shadow: "rgba(60,50,20,0.2)"
      },
      text: {
        subtitle: "TỐT NGHIỆP {year}",
        tagline: "Chúc mừng tân cử nhân",
        date: true
      }
    },
    {
      id: "event-teacher",
      name: "Tri ân 20/11",
      category: "event",
      access: "free",
      palette: { ink: "#c2416b" },
      background: {
        type: "linear",
        stops: ["#fff4d6", "#ffe1ea"]
      },
      decorations: [
        {
          type: "scatter",
          layer: "front",
          shape: "blossom",
          density: 8,
          size: [20, 32],
          colors: ["#ff8fb1", "#ffd166", "#ffffff"],
          seed: 41
        },
        { type: "corners", layer: "front", shape: "book", colors: ["#5b8def", "#ff8fb1"], size: 44, inset: 40 }
      ],
      photo: { radius: 16, border: { color: "#ffffff", width: 8 } },
      text: { titleFont: "script", subtitle: "TRI ÂN THẦY CÔ · 20.11" }
    },
    {
      id: "event-birthday",
      name: "Sinh nhật",
      category: "event",
      access: "free",
      palette: { ink: "#e4568c" },
      background: {
        type: "linear",
        stops: ["#ffe3f1", "#e3ecff"]
      },
      decorations: [
        {
          type: "scatter",
          layer: "back",
          shape: "confetti",
          area: "all",
          density: 18,
          size: [8, 14],
          colors: ["#ff7bab", "#7ec8ff", "#ffd166", "#9b8cff"],
          seed: 51
        },
        {
          type: "scatter",
          layer: "front",
          shape: "balloon",
          density: 6,
          size: [36, 56],
          colors: ["#ff7bab", "#7ec8ff", "#ffd166", "#9b8cff"],
          seed: 52
        }
      ],
      photo: { radius: 20, border: { color: "#ffffff", width: 8 } },
      text: { titleFont: "script", subtitle: "HAPPY BIRTHDAY", date: true }
    },
    {
      id: "event-halloween",
      name: "Halloween",
      category: "event",
      access: "free",
      palette: { ink: "#ffb347" },
      background: {
        type: "linear",
        stops: ["#2a1840", "#5a2a4a", "#c85a1e"]
      },
      decorations: [
        {
          type: "scatter",
          layer: "back",
          shape: "circle",
          area: "all",
          density: 20,
          size: [3, 6],
          colors: ["rgba(255,236,170,0.6)"],
          seed: 61
        },
        {
          type: "scatter",
          layer: "front",
          shape: "pumpkin",
          density: 5,
          size: [36, 52],
          colors: ["#ff8a1f"],
          seed: 62
        },
        {
          type: "scatter",
          layer: "front",
          shape: "bat",
          density: 5,
          size: [34, 50],
          colors: ["#1a1026"],
          seed: 63
        }
      ],
      photo: { radius: 14, border: { color: "#ff8a1f", width: 5 } },
      text: { titleFont: "bold", subtitle: "HAPPY HALLOWEEN", date: true }
    },
    {
      id: "event-tet",
      name: "Tết sum vầy",
      category: "event",
      access: "free",
      palette: { ink: "#ffe08a" },
      background: {
        type: "linear",
        stops: ["#d0142f", "#9e0b22"]
      },
      decorations: [
        {
          type: "scatter",
          layer: "front",
          shape: "blossom",
          density: 9,
          size: [22, 34],
          colors: ["#ffd23f", "#ffe27a"],
          seed: 71
        },
        { type: "corners", layer: "front", shape: "lantern", colors: ["#ff3b3b"], size: 48, inset: 40 }
      ],
      photo: { radius: 12, border: { color: "#ffd23f", width: 6 } },
      text: { titleFont: "script", subtitle: "CHÚC MỪNG NĂM MỚI", date: true }
    },
    {
      id: "couple-wedding",
      name: "Ngày cưới",
      category: "couple",
      access: "free",
      palette: { ink: "#b08d2a" },
      background: { type: "solid", color: "#fffaf3" },
      decorations: [
        { type: "doubleBorder", layer: "front", color: "#d4af37", inset: 18, gap: 9, width: 3 },
        {
          type: "scatter",
          layer: "front",
          shape: "heart",
          density: 5,
          size: [14, 22],
          colors: ["#e7b8c4", "#d4af37"],
          seed: 81
        },
        { type: "corners", layer: "front", shape: "ring", colors: ["#d4af37"], size: 40, inset: 72 }
      ],
      photo: {
        radius: 6,
        border: { color: "#ffffff", width: 10 },
        shadow: "rgba(120,90,30,0.18)"
      },
      text: { titleFont: "script", subtitle: "JUST MARRIED", date: true }
    },
    {
      id: "trend-magazine",
      name: "Bìa tạp chí",
      category: "trend",
      access: "free",
      palette: { ink: "#111111" },
      background: { type: "solid", color: "#ffffff" },
      decorations: [
        {
          type: "coverLines",
          layer: "front",
          color: "#111111",
          lines: ["BỘ ẢNH CỰC CHÁY", "Bí kíp tạo dáng chuẩn idol", "Phỏng vấn độc quyền ✦"]
        },
        { type: "barcode", layer: "front", color: "#111111" }
      ],
      photo: { radius: 0 },
      text: {
        title: "NOHA",
        titleSize: 1.25,
        titleColor: "#e4002b",
        letterSpacing: 10,
        tagline: "SỐ ĐẶC BIỆT · THÁNG {month}/{year}",
        subtitle: ""
      }
    },
    {
      id: "trend-newspaper",
      name: "Báo NoHa",
      category: "trend",
      access: "free",
      palette: { ink: "#1b1b1b" },
      background: { type: "solid", color: "#f1ede4" },
      decorations: [
        { type: "newsRules", layer: "front", color: "#1b1b1b" },
        { type: "newsColumns", layer: "front", color: "rgba(27,27,27,0.28)" }
      ],
      photo: { radius: 0 },
      text: {
        title: "NoHa Times",
        tagline: "SỐ ĐẶC BIỆT · {date}",
        subtitle: "TIN NÓNG: CẢ HỘI LÊN ẢNH QUÁ XINH"
      }
    },
    {
      id: "trend-cinema",
      name: "Rạp phim",
      category: "trend",
      access: "free",
      palette: { ink: "#f4e9d8" },
      background: { type: "solid", color: "#141018" },
      decorations: [
        { type: "sprockets", layer: "back", color: "#f4e9d8" }
      ],
      photo: { radius: 4, border: { color: "#f4e9d8", width: 3 } },
      text: {
        title: "NoHa Cinema",
        titleFont: "bold",
        titleColor: "#ffcf5a",
        tagline: "NOW SHOWING",
        subtitle: "SUẤT CHIẾU ĐẶC BIỆT",
        date: true
      }
    },
    {
      id: "trend-photocard",
      name: "Photocard idol",
      category: "trend",
      access: "free",
      palette: { ink: "#7b5cff" },
      background: {
        type: "linear",
        angle: 135,
        stops: ["#ffd1f0", "#d6e4ff", "#d1fff3", "#fff4c2"]
      },
      decorations: [
        {
          type: "scatter",
          layer: "front",
          shape: "star",
          density: 6,
          size: [14, 26],
          colors: ["#ffffff", "#ffd6f5"],
          seed: 91
        },
        {
          type: "scatter",
          layer: "front",
          shape: "sparkle",
          density: 6,
          size: [14, 28],
          colors: ["#ffffff"],
          seed: 92
        }
      ],
      photo: { radius: 26, border: { color: "#ffffff", width: 6 } },
      text: {
        titleFont: "bold",
        subtitle: "NOHA ENT. · OFFICIAL PHOTOCARD",
        shadow: "rgba(255,255,255,0.9)"
      }
    },

    /* ===== Kiểu Hàn, pastel, cute, vintage, K-pop (isNew: nhãn MỚI) ===== */
    {
      id: "korean-black",
      name: "Hàn Quốc đen",
      category: "korean",
      access: "free",
      isNew: true,
      palette: { ink: "#f5f5f5" },
      background: { type: "solid", color: "#111111" },
      photo: { radius: 2 },
      text: { titleSize: 0.75, subtitle: "NOHA · 4 CUTS", date: true }
    },
    {
      id: "korean-white",
      name: "Hàn Quốc trắng",
      category: "korean",
      access: "free",
      isNew: true,
      palette: { ink: "#3a3a3a" },
      background: { type: "solid", color: "#fafafa" },
      photo: { radius: 2 },
      text: { titleSize: 0.75, subtitle: "NOHA · 4 CUTS", date: true }
    },
    {
      id: "korean-pastel-pink",
      name: "Pastel hồng",
      category: "korean",
      access: "free",
      isNew: true,
      palette: { ink: "#c25a7c" },
      background: { type: "solid", color: "#f9d9e3" },
      decorations: [
        {
          type: "scatter",
          layer: "front",
          shape: "sparkle",
          density: 4,
          size: [12, 20],
          colors: ["#ffffff"],
          seed: 101
        }
      ],
      photo: { radius: 8 },
      text: { titleFont: "script", titleSize: 0.85, subtitle: "SWEET MOMENT", date: true }
    },
    {
      id: "korean-pastel-lilac",
      name: "Pastel tím",
      category: "korean",
      access: "free",
      isNew: true,
      palette: { ink: "#7a5fb0" },
      background: { type: "solid", color: "#e3dbf5" },
      decorations: [
        {
          type: "scatter",
          layer: "front",
          shape: "star",
          density: 4,
          size: [12, 18],
          colors: ["#ffffff"],
          seed: 102
        }
      ],
      photo: { radius: 8 },
      text: { titleFont: "script", titleSize: 0.85, subtitle: "LAVENDER DAY", date: true }
    },
    {
      id: "korean-pastel-mint",
      name: "Pastel bạc hà",
      category: "korean",
      access: "free",
      isNew: true,
      palette: { ink: "#3f8a76" },
      background: { type: "solid", color: "#d4f0e6" },
      decorations: [
        {
          type: "scatter",
          layer: "front",
          shape: "heart",
          density: 4,
          size: [12, 18],
          colors: ["#ffffff"],
          seed: 103
        }
      ],
      photo: { radius: 8 },
      text: { titleFont: "script", titleSize: 0.85, subtitle: "FRESH MINT", date: true }
    },
    {
      id: "cute-coquette",
      name: "Nơ coquette",
      category: "cute",
      access: "free",
      isNew: true,
      palette: { ink: "#d0637f" },
      background: { type: "solid", color: "#fff0f3" },
      decorations: [
        {
          type: "scatter",
          layer: "back",
          shape: "circle",
          area: "all",
          density: 12,
          size: [6, 10],
          colors: ["rgba(255,255,255,0.95)"],
          seed: 111
        },
        { type: "corners", layer: "front", shape: "bow", colors: ["#f497b0"], size: 54, inset: 40 },
        {
          type: "scatter",
          layer: "front",
          shape: "heart",
          density: 4,
          size: [12, 18],
          colors: ["#f497b0"],
          seed: 112
        }
      ],
      photo: { radius: 16, border: { color: "#ffffff", width: 8 } },
      text: { titleFont: "script", subtitle: "SOFT & SWEET", date: true }
    },
    {
      id: "cute-gingham-blue",
      name: "Caro xanh",
      category: "cute",
      access: "free",
      isNew: true,
      palette: { ink: "#2f5f9e" },
      background: { type: "gingham", color: "#ffffff", stripe: "rgba(120,170,230,0.35)", size: 22 },
      decorations: [
        {
          type: "scatter",
          layer: "front",
          shape: "heart",
          density: 5,
          size: [16, 24],
          colors: ["#ffffff", "#7aaae6"],
          seed: 121
        }
      ],
      photo: { radius: 12, border: { color: "#ffffff", width: 8 } },
      text: { titleFont: "script", subtitle: "PICNIC DAY", date: true, shadow: "rgba(255,255,255,0.95)" }
    },
    {
      id: "cute-gingham-cherry",
      name: "Caro cherry",
      category: "cute",
      access: "free",
      isNew: true,
      palette: { ink: "#c8323f" },
      background: { type: "gingham", color: "#fff6f6", stripe: "rgba(230,90,100,0.28)", size: 22 },
      decorations: [
        {
          type: "scatter",
          layer: "front",
          shape: "cherry",
          density: 6,
          size: [28, 40],
          colors: ["#e0313f"],
          seed: 131
        }
      ],
      photo: { radius: 12, border: { color: "#ffffff", width: 8 } },
      text: { titleFont: "script", subtitle: "CHERRY ON TOP", date: true, shadow: "rgba(255,255,255,0.95)" }
    },
    {
      id: "cute-bear",
      name: "Gấu nâu",
      category: "cute",
      access: "free",
      isNew: true,
      palette: { ink: "#7a4a2c" },
      background: {
        type: "linear",
        stops: ["#fbe9d7", "#f2d3b6"]
      },
      decorations: [
        {
          type: "scatter",
          layer: "front",
          shape: "bear",
          density: 6,
          size: [30, 44],
          colors: ["#a86b45", "#c08457"],
          seed: 141
        }
      ],
      photo: { radius: 18, border: { color: "#fffaf4", width: 8 } },
      text: { titleFont: "script", subtitle: "BEAR HUG", date: true }
    },
    {
      id: "trend-vintage-roll",
      name: "Cuộn phim vàng",
      category: "trend",
      access: "free",
      isNew: true,
      palette: { ink: "#3a2412" },
      background: { type: "solid", color: "#efb53a" },
      decorations: [
        { type: "sprockets", layer: "back", color: "#3a2412" }
      ],
      photo: { radius: 2, border: { color: "#3a2412", width: 4 } },
      text: {
        title: "NOHA FILM 400",
        titleFont: "bold",
        titleSize: 0.8,
        subtitle: "◀ 24 EXP · COLOR NEGATIVE ▶",
        date: true
      }
    },
    {
      id: "trend-kpop-bias",
      name: "My bias",
      category: "trend",
      access: "free",
      isNew: true,
      palette: { ink: "#8a4fd8" },
      background: {
        type: "linear",
        stops: ["#efe2ff", "#ffe0f2"]
      },
      decorations: [
        {
          type: "scatter",
          layer: "front",
          shape: "heart",
          density: 5,
          size: [16, 26],
          colors: ["#ff7bc0", "#b48cff"],
          seed: 151
        },
        {
          type: "scatter",
          layer: "front",
          shape: "star",
          density: 5,
          size: [14, 22],
          colors: ["#ffd84d", "#ffffff"],
          seed: 152
        }
      ],
      photo: { radius: 20, border: { color: "#ffffff", width: 6 } },
      text: { titleFont: "bold", subtitle: "♡ MY BIAS ♡", tagline: "NOHA FANCLUB", date: true }
    },
    {
      id: "trend-y2k-neon",
      name: "Y2K neon",
      category: "trend",
      access: "free",
      isNew: true,
      palette: { ink: "#9dff6a" },
      background: { type: "solid", color: "#0d0d14" },
      decorations: [
        {
          type: "scatter",
          layer: "front",
          shape: "sparkle",
          density: 9,
          size: [14, 30],
          colors: ["#ff4fd8", "#9dff6a", "#5ee7ff"],
          seed: 161
        }
      ],
      photo: { radius: 24, border: { color: "#ff4fd8", width: 4 } },
      text: {
        titleFont: "bold",
        titleColor: "#ff4fd8",
        subtitle: "Y2K NEON ✦ NOHA",
        shadow: "rgba(255,79,216,0.8)",
        date: true
      }
    }
  ];

  const templatesById = new Map(
    FRAME_TEMPLATES.map(template => [template.id, template])
  );

  let fontsReady = null;

  /* ===== Dữ liệu và mở khóa ===== */

  function get(id) {
    return templatesById.get(id) || templatesById.get("pink");
  }

  /* Khung mới (isNew) luôn đứng đầu danh sách để người dùng thấy ngay */
  function list(category = "all") {
    const visible = FRAME_TEMPLATES.filter(
      template =>
        !template.hidden &&
        (category === "all" || template.category === category)
    );

    return [
      ...visible.filter(template => template.isNew),
      ...visible.filter(template => !template.isNew)
    ];
  }

  function readUnlocked() {
    try {
      return new Set(
        JSON.parse(localStorage.getItem(UNLOCK_STORAGE_KEY) || "[]")
      );
    } catch {
      return new Set();
    }
  }

  function isUnlocked(id) {
    const template = templatesById.get(id);

    if (!template) {
      return false;
    }

    return template.access !== "unlock" || readUnlocked().has(id);
  }

  function unlock(id) {
    const unlocked = readUnlocked();
    unlocked.add(id);

    try {
      localStorage.setItem(UNLOCK_STORAGE_KEY, JSON.stringify([...unlocked]));
    } catch {
      // Không lưu được thì vẫn mở trong phiên hiện tại
    }

    return true;
  }

  function ensureFonts() {
    if (!fontsReady) {
      const fontLoad = document.fonts?.load
        ? document.fonts.load("48px Pacifico").catch(() => {})
        : Promise.resolve();

      fontsReady = Promise.race([
        fontLoad,
        new Promise(resolve => setTimeout(resolve, 2500))
      ]);
    }

    return fontsReady;
  }

  /* ===== Hình vẽ cơ bản ===== */

  function seededRandom(seed) {
    let value = seed >>> 0;

    return () => {
      value = (value + 0x6d2b79f5) >>> 0;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function roundedRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);

    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function heartPath(context, size) {
    const s = size / 2;

    context.beginPath();
    context.moveTo(0, s * 0.7);
    context.bezierCurveTo(-s * 1.2, -s * 0.1, -s * 0.6, -s * 1.05, 0, -s * 0.45);
    context.bezierCurveTo(s * 0.6, -s * 1.05, s * 1.2, -s * 0.1, 0, s * 0.7);
    context.closePath();
  }

  function starPath(context, size, points = 5) {
    const outer = size / 2;
    const inner = outer * 0.45;

    context.beginPath();

    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 ? inner : outer;
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      if (i === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }

    context.closePath();
  }

  function sparklePath(context, size) {
    const s = size / 2;
    const w = s * 0.18;

    context.beginPath();
    context.moveTo(0, -s);
    context.quadraticCurveTo(w, -w, s, 0);
    context.quadraticCurveTo(w, w, 0, s);
    context.quadraticCurveTo(-w, w, -s, 0);
    context.quadraticCurveTo(-w, -w, 0, -s);
    context.closePath();
  }

  function leafPath(context, size) {
    const s = size / 2;

    context.beginPath();
    context.moveTo(0, -s);
    context.bezierCurveTo(s * 0.75, -s * 0.5, s * 0.6, s * 0.55, 0, s);
    context.bezierCurveTo(-s * 0.6, s * 0.55, -s * 0.75, -s * 0.5, 0, -s);
    context.closePath();
  }

  function cloudPath(context, size) {
    const s = size / 2;

    context.beginPath();
    context.arc(-s * 0.5, s * 0.1, s * 0.42, 0, Math.PI * 2);
    context.arc(0, -s * 0.15, s * 0.55, 0, Math.PI * 2);
    context.arc(s * 0.55, s * 0.1, s * 0.4, 0, Math.PI * 2);
    context.rect(-s * 0.5, s * 0.05, s * 1.05, s * 0.47);
  }

  function gradCapShape(context, size) {
    const s = size / 2;

    // Phần ôm đầu
    context.beginPath();
    context.moveTo(-s * 0.55, 0);
    context.lineTo(-s * 0.55, s * 0.42);
    context.quadraticCurveTo(0, s * 0.68, s * 0.55, s * 0.42);
    context.lineTo(s * 0.55, 0);
    context.closePath();
    context.fill();

    // Mặt mũ hình thoi
    context.beginPath();
    context.moveTo(-s, -s * 0.12);
    context.lineTo(0, -s * 0.55);
    context.lineTo(s, -s * 0.12);
    context.lineTo(0, s * 0.3);
    context.closePath();
    context.fill();
    context.strokeStyle = "rgba(255,255,255,0.35)";
    context.lineWidth = Math.max(1, size * 0.025);
    context.stroke();

    // Tua rua vàng
    context.strokeStyle = "#f5c542";
    context.fillStyle = "#f5c542";
    context.lineWidth = Math.max(1.5, size * 0.045);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(0, -s * 0.12);
    context.lineTo(s * 0.72, s * 0.02);
    context.lineTo(s * 0.72, s * 0.5);
    context.stroke();
    context.beginPath();
    context.arc(s * 0.72, s * 0.56, size * 0.05, 0, Math.PI * 2);
    context.fill();
  }

  function pumpkinShape(context, size, color) {
    const s = size / 2;

    [-0.36, 0.36, 0].forEach(offset => {
      context.beginPath();
      context.ellipse(s * offset, s * 0.1, s * (offset ? 0.42 : 0.46), s * 0.52, 0, 0, Math.PI * 2);
      context.fillStyle = color;
      context.fill();
      context.strokeStyle = "rgba(120,45,0,0.35)";
      context.lineWidth = Math.max(1, size * 0.03);
      context.stroke();
    });

    context.fillStyle = "#4f7a2a";
    context.fillRect(-s * 0.08, -s * 0.62, s * 0.16, s * 0.24);
  }

  function batShape(context, size) {
    const s = size / 2;

    context.beginPath();
    context.moveTo(0, -s * 0.15);
    context.quadraticCurveTo(-s * 0.35, -s * 0.55, -s, -s * 0.25);
    context.quadraticCurveTo(-s * 0.75, -s * 0.05, -s * 0.72, s * 0.2);
    context.quadraticCurveTo(-s * 0.55, s * 0.02, -s * 0.4, s * 0.18);
    context.quadraticCurveTo(-s * 0.25, s * 0.02, 0, s * 0.3);
    context.quadraticCurveTo(s * 0.25, s * 0.02, s * 0.4, s * 0.18);
    context.quadraticCurveTo(s * 0.55, s * 0.02, s * 0.72, s * 0.2);
    context.quadraticCurveTo(s * 0.75, -s * 0.05, s, -s * 0.25);
    context.quadraticCurveTo(s * 0.35, -s * 0.55, 0, -s * 0.15);
    context.closePath();
    context.fill();

    context.beginPath();
    context.arc(0, -s * 0.12, s * 0.16, 0, Math.PI * 2);
    context.fill();
  }

  function balloonShape(context, size) {
    const s = size / 2;

    context.beginPath();
    context.ellipse(0, -s * 0.2, s * 0.5, s * 0.62, 0, 0, Math.PI * 2);
    context.fill();

    context.beginPath();
    context.moveTo(-s * 0.09, s * 0.47);
    context.lineTo(s * 0.09, s * 0.47);
    context.lineTo(0, s * 0.38);
    context.closePath();
    context.fill();

    context.fillStyle = "rgba(255,255,255,0.45)";
    context.beginPath();
    context.ellipse(-s * 0.2, -s * 0.42, s * 0.09, s * 0.17, -0.4, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "rgba(90,60,80,0.55)";
    context.lineWidth = Math.max(1, size * 0.025);
    context.beginPath();
    context.moveTo(0, s * 0.47);
    context.quadraticCurveTo(s * 0.18, s * 0.75, 0, s);
    context.stroke();
  }

  function bookShape(context, size) {
    const s = size / 2;

    [-1, 1].forEach(side => {
      context.beginPath();
      context.moveTo(0, -s * 0.3);
      context.quadraticCurveTo(side * s * 0.5, -s * 0.5, side * s, -s * 0.32);
      context.lineTo(side * s, s * 0.42);
      context.quadraticCurveTo(side * s * 0.5, s * 0.25, 0, s * 0.45);
      context.closePath();
      context.fill();
    });

    context.strokeStyle = "rgba(255,255,255,0.7)";
    context.lineWidth = Math.max(1, size * 0.03);

    [-1, 1].forEach(side => {
      for (let row = 0; row < 3; row++) {
        const y = -s * 0.12 + row * s * 0.18;
        context.beginPath();
        context.moveTo(side * s * 0.2, y);
        context.lineTo(side * s * 0.78, y - s * 0.05);
        context.stroke();
      }
    });
  }

  function ringShape(context, size) {
    const s = size / 2;

    context.lineWidth = Math.max(2, size * 0.1);
    context.beginPath();
    context.arc(0, s * 0.18, s * 0.48, 0, Math.PI * 2);
    context.stroke();

    context.fillStyle = "#eaf6ff";
    context.beginPath();
    context.moveTo(0, -s * 0.78);
    context.lineTo(s * 0.24, -s * 0.5);
    context.lineTo(0, -s * 0.3);
    context.lineTo(-s * 0.24, -s * 0.5);
    context.closePath();
    context.fill();
    context.lineWidth = Math.max(1, size * 0.03);
    context.stroke();
  }

  function blossomShape(context, size) {
    const s = size / 2;

    for (let petal = 0; petal < 5; petal++) {
      const angle = (petal / 5) * Math.PI * 2 - Math.PI / 2;
      context.beginPath();
      context.arc(Math.cos(angle) * s * 0.45, Math.sin(angle) * s * 0.45, s * 0.4, 0, Math.PI * 2);
      context.fill();
    }

    context.fillStyle = "rgba(170,60,20,0.8)";
    context.beginPath();
    context.arc(0, 0, s * 0.2, 0, Math.PI * 2);
    context.fill();
  }

  function lanternShape(context, size) {
    const s = size / 2;

    context.strokeStyle = "#f2c14e";
    context.lineWidth = Math.max(1, size * 0.03);
    context.beginPath();
    context.moveTo(0, -s);
    context.lineTo(0, -s * 0.7);
    context.stroke();

    context.beginPath();
    context.ellipse(0, 0, s * 0.5, s * 0.6, 0, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "rgba(255,214,120,0.7)";
    context.beginPath();
    context.ellipse(0, 0, s * 0.22, s * 0.6, 0, 0, Math.PI * 2);
    context.moveTo(0, -s * 0.6);
    context.lineTo(0, s * 0.6);
    context.stroke();

    context.fillStyle = "#f2c14e";
    context.fillRect(-s * 0.28, -s * 0.72, s * 0.56, s * 0.16);
    context.fillRect(-s * 0.28, s * 0.56, s * 0.56, s * 0.16);

    context.strokeStyle = "#f2c14e";
    context.lineWidth = Math.max(1.5, size * 0.05);
    context.beginPath();
    context.moveTo(0, s * 0.72);
    context.lineTo(0, s);
    context.stroke();
  }

  function bowShape(context, size) {
    const s = size / 2;

    [-1, 1].forEach(side => {
      // Hai cánh nơ
      context.beginPath();
      context.moveTo(0, 0);
      context.bezierCurveTo(side * s * 0.4, -s * 0.7, side * s, -s * 0.5, side * s * 0.9, 0);
      context.bezierCurveTo(side * s, s * 0.5, side * s * 0.4, s * 0.45, 0, 0);
      context.fill();

      // Hai đuôi nơ
      context.beginPath();
      context.moveTo(side * s * 0.05, s * 0.05);
      context.lineTo(side * s * 0.5, s * 0.95);
      context.lineTo(side * s * 0.3, s * 0.82);
      context.lineTo(side * s * 0.14, s * 0.98);
      context.closePath();
      context.fill();
    });

    context.beginPath();
    context.arc(0, 0, s * 0.2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "rgba(0,0,0,0.12)";
    context.fill();
  }

  function cherryShape(context, size, color) {
    const s = size / 2;

    context.strokeStyle = "#4f7a2a";
    context.lineWidth = Math.max(1.5, size * 0.05);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(-s * 0.4, s * 0.25);
    context.quadraticCurveTo(-s * 0.2, -s * 0.4, s * 0.1, -s * 0.75);
    context.moveTo(s * 0.4, s * 0.3);
    context.quadraticCurveTo(s * 0.3, -s * 0.3, s * 0.1, -s * 0.75);
    context.stroke();

    context.fillStyle = "#6fae3c";
    context.beginPath();
    context.ellipse(s * 0.38, -s * 0.72, s * 0.3, s * 0.13, -0.4, 0, Math.PI * 2);
    context.fill();

    [[-s * 0.42, s * 0.45], [s * 0.42, s * 0.5]].forEach(([x, y]) => {
      context.fillStyle = color;
      context.beginPath();
      context.arc(x, y, s * 0.36, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "rgba(255,255,255,0.55)";
      context.beginPath();
      context.arc(x - s * 0.12, y - s * 0.12, s * 0.09, 0, Math.PI * 2);
      context.fill();
    });
  }

  function bearShape(context, size, color) {
    const s = size / 2;

    context.fillStyle = color;
    [[-s * 0.62, -s * 0.58], [s * 0.62, -s * 0.58]].forEach(([x, y]) => {
      context.beginPath();
      context.arc(x, y, s * 0.3, 0, Math.PI * 2);
      context.fill();
    });

    context.beginPath();
    context.arc(0, 0, s * 0.8, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "rgba(255,240,220,0.9)";
    context.beginPath();
    context.ellipse(0, s * 0.28, s * 0.36, s * 0.28, 0, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#3a2418";
    [[-s * 0.3, -s * 0.12], [s * 0.3, -s * 0.12]].forEach(([x, y]) => {
      context.beginPath();
      context.arc(x, y, s * 0.09, 0, Math.PI * 2);
      context.fill();
    });
    context.beginPath();
    context.ellipse(0, s * 0.18, s * 0.12, s * 0.08, 0, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "rgba(255,130,150,0.45)";
    [[-s * 0.5, s * 0.15], [s * 0.5, s * 0.15]].forEach(([x, y]) => {
      context.beginPath();
      context.arc(x, y, s * 0.12, 0, Math.PI * 2);
      context.fill();
    });
  }

  function drawShape(context, shape, size, color, random) {
    context.fillStyle = color;
    context.strokeStyle = color;

    if (shape === "bow") {
      bowShape(context, size);
    } else if (shape === "cherry") {
      cherryShape(context, size, color);
    } else if (shape === "bear") {
      bearShape(context, size, color);
    } else if (shape === "gradCap") {
      gradCapShape(context, size);
    } else if (shape === "pumpkin") {
      pumpkinShape(context, size, color);
    } else if (shape === "bat") {
      batShape(context, size);
    } else if (shape === "balloon") {
      balloonShape(context, size);
    } else if (shape === "book") {
      bookShape(context, size);
    } else if (shape === "ring") {
      ringShape(context, size);
    } else if (shape === "blossom") {
      blossomShape(context, size);
    } else if (shape === "lantern") {
      lanternShape(context, size);
    } else if (shape === "heart") {
      heartPath(context, size);
      context.fill();
    } else if (shape === "star") {
      starPath(context, size);
      context.fill();
    } else if (shape === "sparkle") {
      sparklePath(context, size);
      context.fill();
    } else if (shape === "leaf") {
      leafPath(context, size);
      context.fill();
      context.globalAlpha *= 0.55;
      context.lineWidth = Math.max(1, size * 0.05);
      context.strokeStyle = "rgba(90,40,20,0.6)";
      context.beginPath();
      context.moveTo(0, -size * 0.42);
      context.lineTo(0, size * 0.62);
      context.stroke();
    } else if (shape === "cloud") {
      cloudPath(context, size);
      context.fill();
    } else if (shape === "snowflake") {
      context.lineWidth = Math.max(1.5, size * 0.08);
      context.lineCap = "round";

      for (let arm = 0; arm < 6; arm++) {
        context.save();
        context.rotate((arm * Math.PI) / 3);
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(0, -size / 2);
        context.moveTo(0, -size * 0.3);
        context.lineTo(size * 0.12, -size * 0.4);
        context.moveTo(0, -size * 0.3);
        context.lineTo(-size * 0.12, -size * 0.4);
        context.stroke();
        context.restore();
      }
    } else if (shape === "confetti") {
      if (random() < 0.4) {
        context.beginPath();
        context.arc(0, 0, size * 0.36, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillRect(-size / 2, -size * 0.2, size, size * 0.4);
      }
    } else {
      context.beginPath();
      context.arc(0, 0, size / 2, 0, Math.PI * 2);
      context.fill();
    }
  }

  /* ===== Hình học dùng chung ===== */

  function insideAnyBox(x, y, margin, boxes) {
    return boxes.some(
      box =>
        x > box.x - margin &&
        x < box.x + box.width + margin &&
        y > box.y - margin &&
        y < box.y + box.height + margin
    );
  }

  function insideTextZone(x, y, margin, geo) {
    const { width, height, strip } = geo;
    const halfTitle = width * (strip ? 0.22 : 0.17);
    const halfSubtitle = width * (strip ? 0.36 : 0.26);

    const titleY = strip ? 70 : 82;
    const subtitleY = strip ? height - 88 : height - 58;

    return (
      (Math.abs(x - width / 2) < halfTitle + margin &&
        y > titleY - 60 * geo.scale - margin &&
        y < titleY + 16 * geo.scale + margin) ||
      (Math.abs(x - width / 2) < halfSubtitle + margin &&
        y > subtitleY - 30 * geo.scale - margin &&
        y < height - 6)
    );
  }

  function photoBounds(geo) {
    return {
      top: Math.min(...geo.boxes.map(box => box.y)),
      bottom: Math.max(...geo.boxes.map(box => box.y + box.height))
    };
  }

  /* ===== Các lớp trang trí ===== */

  const DECORATIONS = {
    doubleBorder(context, decoration, template, geo) {
      const inset = decoration.inset * geo.scale;
      const gap = decoration.gap * geo.scale;
      const lineWidth = decoration.width * geo.scale;

      context.strokeStyle = decoration.color;
      context.lineWidth = lineWidth;
      context.strokeRect(inset, inset, geo.width - inset * 2, geo.height - inset * 2);

      context.lineWidth = lineWidth / 2;
      context.strokeRect(
        inset + gap,
        inset + gap,
        geo.width - (inset + gap) * 2,
        geo.height - (inset + gap) * 2
      );
    },

    /* Một hình ở mỗi góc khung, nằm ngoài vùng ảnh */
    corners(context, decoration, template, geo) {
      const inset = decoration.inset * geo.scale;
      const size = decoration.size * geo.scale;
      const colors = decoration.colors;

      [
        [inset, inset, -0.25],
        [geo.width - inset, inset, 0.25],
        [inset, geo.height - inset, 0.2],
        [geo.width - inset, geo.height - inset, -0.2]
      ].forEach(([x, y, rotation], index) => {
        context.save();
        context.translate(x, y);
        context.rotate(rotation);
        drawShape(context, decoration.shape, size, colors[index % colors.length], () => 0);
        context.restore();
      });
    },

    barcode(context, decoration, template, geo) {
      const random = seededRandom(2026);
      const barWidth = 120 * geo.scale;
      const barHeight = 42 * geo.scale;
      const x = geo.width - geo.padding - barWidth;
      const y = geo.height - barHeight - 30 * geo.scale;

      context.fillStyle = "#ffffff";
      context.fillRect(x - 6 * geo.scale, y - 6 * geo.scale, barWidth + 12 * geo.scale, barHeight + 26 * geo.scale);

      context.fillStyle = decoration.color;

      for (let bx = x; bx < x + barWidth; ) {
        const w = (1 + Math.floor(random() * 3)) * geo.scale;
        context.fillRect(bx, y, w, barHeight);
        bx += w + (1 + Math.floor(random() * 3)) * geo.scale;
      }

      context.font = `600 ${11 * geo.scale}px monospace`;
      context.textAlign = "center";
      context.fillText("8 938526 102026", x + barWidth / 2, y + barHeight + 14 * geo.scale);
    },

    /* Các dòng tít kiểu bìa tạp chí ở góc dưới bên trái */
    coverLines(context, decoration, template, geo) {
      const lines = decoration.lines;
      const headSize = (geo.strip ? 22 : 20) * geo.scale;
      const bodySize = (geo.strip ? 16 : 15) * geo.scale;
      const { bottom } = photoBounds(geo);

      // Luôn bắt đầu dưới ảnh; phần chân ngắn (bố cục một ảnh) thì xếp dòng sát hơn
      const lastY = geo.height - 24 * geo.scale;
      const preferredHeight = (geo.strip ? 30 : 28) * geo.scale;
      const firstY = Math.max(
        bottom + headSize + 10 * geo.scale,
        lastY - preferredHeight * (lines.length - 1)
      );
      const lineHeight = lines.length > 1
        ? (lastY - firstY) / (lines.length - 1)
        : 0;

      context.fillStyle = decoration.color;
      context.textAlign = "left";

      lines.forEach((line, index) => {
        context.font = index === 0
          ? `900 ${headSize}px Arial`
          : `600 ${bodySize}px Arial`;
        context.fillText(line, geo.padding, firstY + lineHeight * index);
      });
    },

    /* Kẻ ngang kiểu trang báo dưới tiêu đề và trên phần chân */
    newsRules(context, decoration, template, geo) {
      const { top, bottom } = photoBounds(geo);
      const left = geo.padding;
      const right = geo.width - geo.padding;

      context.strokeStyle = decoration.color;

      [
        [top - 18 * geo.scale, 3],
        [top - 12 * geo.scale, 1],
        [bottom + 16 * geo.scale, 1]
      ].forEach(([y, lineWidth]) => {
        context.lineWidth = lineWidth * geo.scale;
        context.beginPath();
        context.moveTo(left, y);
        context.lineTo(right, y);
        context.stroke();
      });
    },

    /* Cột "chữ" giả bằng các vạch xám hai bên chân trang */
    newsColumns(context, decoration, template, geo) {
      const random = seededRandom(77);
      const { bottom } = photoBounds(geo);
      const columnWidth = geo.width * 0.18;
      const rowHeight = 10 * geo.scale;
      const startY = bottom + 32 * geo.scale;
      const endY = geo.height - 18 * geo.scale;

      context.fillStyle = decoration.color;

      [geo.padding, geo.width - geo.padding - columnWidth].forEach(x => {
        for (let y = startY; y + rowHeight * 0.5 < endY; y += rowHeight) {
          const width = columnWidth * (0.7 + random() * 0.3);
          context.fillRect(x, y, width, rowHeight * 0.45);
        }
      });
    },

    /* Lỗ phim hai bên mép */
    sprockets(context, decoration, template, geo) {
      const holeWidth = geo.padding * 0.36;
      const holeHeight = 24 * geo.scale;
      const spacing = 44 * geo.scale;

      context.fillStyle = decoration.color;

      [geo.padding * 0.32, geo.width - geo.padding * 0.32 - holeWidth].forEach(x => {
        for (let y = spacing / 2; y < geo.height - holeHeight; y += spacing) {
          roundedRect(context, x, y, holeWidth, holeHeight, 4 * geo.scale);
          context.fill();
        }
      });
    },

    cornerFlowers(context, decoration, template, geo) {
      const { width, height, padding, strip } = geo;

      context.fillStyle = template.palette.ink;
      context.textAlign = "center";
      context.font = `${strip ? 38 : 52}px Arial`;

      context.fillText("✿", padding, strip ? height - 70 : 70);
      context.fillText("✿", width - padding, strip ? 74 : height - 62);
    },

    frameBorder(context, decoration, template, geo) {
      context.strokeStyle = decoration.color;
      context.lineWidth = geo.strip ? 5 : 8;
      context.strokeRect(20, 20, geo.width - 40, geo.height - 40);
    },

    singleFooterBand(context, decoration, template, geo) {
      if (!geo.single) {
        return;
      }

      context.fillStyle = "rgba(255,255,255,.72)";
      context.fillRect(0, geo.height - 80, geo.width, 80);

      context.fillStyle = "#5b376d";
      context.textAlign = "center";
      context.font = "800 26px Arial";
      context.fillText("NoHa · Tiệm Photobooth", geo.width / 2, geo.height - 30);
    },

    insetLine(context, decoration, template, geo) {
      const inset = decoration.inset * geo.scale;

      context.strokeStyle = decoration.color;
      context.lineWidth = decoration.width * geo.scale;
      context.strokeRect(inset, inset, geo.width - inset * 2, geo.height - inset * 2);
    },

    dots(context, decoration, template, geo) {
      const spacing = decoration.spacing * geo.scale;
      const radius = decoration.radius * geo.scale;

      context.fillStyle = decoration.color;

      for (let row = 0, y = spacing / 2; y < geo.height + spacing; row++, y += spacing) {
        const shift = row % 2 ? spacing / 2 : 0;

        for (let x = shift; x < geo.width + spacing; x += spacing) {
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fill();
        }
      }
    },

    stamp(context, decoration, template, geo) {
      const size = (geo.strip ? 64 : 76) * geo.scale * (geo.strip ? 1 : 0.8);
      const x = geo.width - geo.padding - size / 2;
      const y = geo.padding + (geo.header - size) / 2 + size / 2 - 8;

      context.save();
      context.translate(x, y);
      context.rotate(0.12);

      context.fillStyle = "#ffffff";
      context.shadowColor = "rgba(110,70,40,0.2)";
      context.shadowBlur = 6;
      context.fillRect(-size / 2, -size * 0.6, size, size * 1.2);
      context.shadowColor = "transparent";

      context.setLineDash([size * 0.06, size * 0.05]);
      context.strokeStyle = decoration.color;
      context.lineWidth = Math.max(1.5, size * 0.03);
      context.strokeRect(-size * 0.4, -size * 0.5, size * 0.8, size);
      context.setLineDash([]);

      context.translate(0, size * 0.04);
      drawShape(context, "heart", size * 0.5, decoration.color, () => 0);
      context.restore();
    },

    scatter(context, decoration, template, geo) {
      const random = seededRandom(
        decoration.seed * 7919 + Math.round(geo.width) * 31 + Math.round(geo.height)
      );

      const [minSize, maxSize] = decoration.size;
      const count = Math.round(
        decoration.density * (geo.width * geo.height) / 1e6
      );

      const colors = decoration.colors;
      const marginOnly = decoration.area !== "all";
      let placed = 0;

      for (let attempt = 0; placed < count && attempt < count * 30; attempt++) {
        const size = (minSize + random() * (maxSize - minSize)) * geo.scale;
        const x = random() * geo.width;
        const y = random() * geo.height;
        const rotation = (random() - 0.5) * 1.2;
        const color = colors[Math.floor(random() * colors.length)];

        if (
          marginOnly &&
          (insideAnyBox(x, y, size * 0.6, geo.boxes) ||
            insideTextZone(x, y, size * 0.5, geo) ||
            x < size * 0.6 ||
            y < size * 0.6 ||
            x > geo.width - size * 0.6 ||
            y > geo.height - size * 0.6)
        ) {
          continue;
        }

        context.save();
        context.translate(x, y);
        context.rotate(rotation);
        drawShape(context, decoration.shape, size, color, random);
        context.restore();

        placed++;
      }
    }
  };

  const PHOTO_EXTRAS = {
    filmMarks(context, box, index) {
      context.fillStyle = "#f6dfbb";

      const size = Math.max(10, box.width * 0.018);

      for (let x = box.x + 20; x < box.x + box.width - 20; x += size * 2.2) {
        context.fillRect(x, box.y - 16, size, 8);
        context.fillRect(x, box.y + box.height + 8, size, 8);
      }

      context.font = `700 ${Math.max(12, box.width * 0.025)}px monospace`;
      context.fillText(String(index + 1).padStart(2, "0"), box.x + 10, box.y + 24);
    }
  };

  function paintDecorations(context, template, geo, layer) {
    (template.decorations || [])
      .filter(decoration => (decoration.layer || "front") === layer)
      .forEach(decoration => {
        const painter = DECORATIONS[decoration.type];

        if (!painter) {
          return;
        }

        context.save();
        painter(context, decoration, template, geo);
        context.restore();
      });
  }

  /* ===== Các bước vẽ khung (dùng chung cho xem trước và ảnh xuất) ===== */

  function paintBackground(context, template, geo) {
    const background = template.background;

    context.save();

    if (background.type === "linear") {
      const angle = ((background.angle ?? 180) * Math.PI) / 180;
      const half = Math.abs(geo.width * Math.sin(angle)) / 2 +
        Math.abs(geo.height * Math.cos(angle)) / 2;

      const cx = geo.width / 2;
      const cy = geo.height / 2;
      const dx = Math.sin(angle) * half;
      const dy = -Math.cos(angle) * half;

      const gradient = context.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);

      background.stops.forEach((color, index) => {
        gradient.addColorStop(index / (background.stops.length - 1), color);
      });

      context.fillStyle = gradient;
      context.fillRect(0, 0, geo.width, geo.height);
    } else if (background.type === "gingham") {
      // Caro: sọc dọc và sọc ngang bán trong suốt chồng lên nhau
      context.fillStyle = background.color;
      context.fillRect(0, 0, geo.width, geo.height);

      const size = background.size * geo.scale;
      context.fillStyle = background.stripe;

      for (let x = 0; x < geo.width; x += size * 2) {
        context.fillRect(x, 0, size, geo.height);
      }

      for (let y = 0; y < geo.height; y += size * 2) {
        context.fillRect(0, y, geo.width, size);
      }
    } else if (background.type === "ruled") {
      context.fillStyle = background.color;
      context.fillRect(0, 0, geo.width, geo.height);

      const spacing = background.spacing * geo.scale;
      context.strokeStyle = background.line;
      context.lineWidth = Math.max(1, 1.5 * geo.scale);

      for (let y = spacing; y < geo.height; y += spacing) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(geo.width, y);
        context.stroke();
      }
    } else {
      context.fillStyle = background.color;
      context.fillRect(0, 0, geo.width, geo.height);
    }

    context.restore();

    paintDecorations(context, template, geo, "back");
  }

  /* Vẽ viền/bóng phía sau ô ảnh, rồi đặt vùng cắt bo góc cho ảnh */
  function clipPhoto(context, template, box, geo) {
    const radius = template.photo?.radius ?? 18;
    const border = template.photo?.border;
    const shadow = template.photo?.shadow;

    if (border || shadow) {
      const width = border ? border.width * geo.scale : 0;

      context.save();

      if (shadow) {
        context.shadowColor = shadow;
        context.shadowBlur = 18 * geo.scale;
        context.shadowOffsetY = 6 * geo.scale;
      }

      context.fillStyle = border?.color || "#ffffff";
      roundedRect(
        context,
        box.x - width,
        box.y - width,
        box.width + width * 2,
        box.height + width * 2,
        radius + width
      );
      context.fill();
      context.restore();
    }

    roundedRect(context, box.x, box.y, box.width, box.height, radius);
    context.clip();
  }

  function paintPhotoExtras(context, template, box, index) {
    (template.photo?.extras || []).forEach(name => {
      const painter = PHOTO_EXTRAS[name];

      if (painter) {
        context.save();
        painter(context, box, index);
        context.restore();
      }
    });
  }

  function formatDate(date = new Date()) {
    const pad = value => String(value).padStart(2, "0");
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
  }

  /* {year}, {month}, {date} trong chữ được thay bằng ngày hiện tại */
  function fillPlaceholders(value, date = new Date()) {
    return String(value || "")
      .replaceAll("{year}", String(date.getFullYear()))
      .replaceAll("{month}", String(date.getMonth() + 1))
      .replaceAll("{date}", formatDate(date));
  }

  function paintText(context, template, geo) {
    const text = { ...BRAND_TEXT, ...template.text };
    const { width, height, strip } = geo;
    const titleSize = text.titleSize || 1;
    const titleY = strip ? 70 : 82;

    context.save();
    context.fillStyle = text.color || template.palette.ink;
    context.textAlign = "center";

    if (text.shadow) {
      context.shadowColor = text.shadow;
      context.shadowBlur = 10 * geo.scale;
    }

    if (text.titleFont === "script") {
      context.font = `${(strip ? 46 : 62) * titleSize}px Pacifico, Georgia, serif`;
    } else if (text.titleFont === "bold") {
      context.font = `italic 900 ${(strip ? 46 : 62) * titleSize}px Arial, sans-serif`;
    } else {
      context.font = `900 ${(strip ? 42 : 58) * titleSize}px Georgia`;
    }

    context.save();

    if (text.titleColor) {
      context.fillStyle = text.titleColor;
    }

    if (text.letterSpacing && "letterSpacing" in context) {
      context.letterSpacing = `${text.letterSpacing * geo.scale}px`;
    }

    context.fillText(fillPlaceholders(text.title), width / 2, titleY);
    context.restore();

    if (text.tagline) {
      context.font = `700 ${strip ? 15 : 20}px Arial`;
      context.fillText(
        fillPlaceholders(text.tagline),
        width / 2,
        titleY + (strip ? 32 : 44)
      );
    }

    if (text.subtitle) {
      context.font = `800 ${strip ? 17 : 24}px Arial`;
      context.fillText(
        fillPlaceholders(text.subtitle),
        width / 2,
        strip ? height - 88 : height - 58
      );
    }

    if (text.date) {
      context.globalAlpha = 0.82;
      context.font = `700 ${strip ? 15 : 20}px Arial`;
      context.fillText(
        formatDate(),
        width / 2,
        strip ? height - 58 : height - 28
      );
    }

    context.restore();
  }

  function paintOverlay(context, template, geo) {
    paintDecorations(context, template, geo, "front");
    paintText(context, template, geo);
    paintDecorations(context, template, geo, "top");
  }

  /* Ảnh xem trước nhỏ: cùng các bước vẽ, ô ảnh dùng hình giữ chỗ */
  function renderThumbnail(canvas, template, geo, maxWidth, maxHeight) {
    const scale = Math.min(maxWidth / geo.width, maxHeight / geo.height);
    const ratio = Math.min(2, window.devicePixelRatio || 1);

    canvas.width = Math.max(1, Math.round(geo.width * scale * ratio));
    canvas.height = Math.max(1, Math.round(geo.height * scale * ratio));
    canvas.style.width = `${Math.round(geo.width * scale)}px`;
    canvas.style.height = `${Math.round(geo.height * scale)}px`;

    const context = canvas.getContext("2d");

    context.setTransform(
      canvas.width / geo.width,
      0,
      0,
      canvas.height / geo.height,
      0,
      0
    );

    paintBackground(context, template, geo);

    geo.boxes.forEach((box, index) => {
      context.save();
      clipPhoto(context, template, box, geo);

      const gradient = context.createLinearGradient(
        box.x,
        box.y,
        box.x + box.width,
        box.y + box.height
      );

      gradient.addColorStop(0, "#f6e3ec");
      gradient.addColorStop(1, "#e7dcf3");
      context.fillStyle = gradient;
      context.fillRect(box.x, box.y, box.width, box.height);

      context.fillStyle = "rgba(255,255,255,0.75)";
      const head = Math.min(box.width, box.height) * 0.2;
      context.beginPath();
      context.arc(box.x + box.width / 2, box.y + box.height * 0.45, head, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.ellipse(
        box.x + box.width / 2,
        box.y + box.height * 0.45 + head * 2.6,
        head * 1.7,
        head * 1.2,
        0,
        0,
        Math.PI * 2
      );
      context.fill();
      context.restore();

      paintPhotoExtras(context, template, box, index);
    });

    paintOverlay(context, template, geo);
  }

  return {
    CATEGORIES,
    get,
    list,
    isUnlocked,
    unlock,
    ensureFonts,
    paintBackground,
    clipPhoto,
    paintPhotoExtras,
    paintOverlay,
    renderThumbnail
  };
})();
