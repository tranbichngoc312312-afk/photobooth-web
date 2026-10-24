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
    { id: "minimal", name: "Tối giản" },
    { id: "cute", name: "Dễ thương" },
    { id: "couple", name: "Chụp đôi" },
    { id: "group", name: "Nhóm bạn" },
    { id: "season", name: "Mùa & trend" }
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
      category: "season",
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
      category: "season",
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

  function list(category = "all") {
    return FRAME_TEMPLATES.filter(
      template =>
        !template.hidden &&
        (category === "all" || template.category === category)
    );
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

  function drawShape(context, shape, size, color, random) {
    context.fillStyle = color;
    context.strokeStyle = color;

    if (shape === "heart") {
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

  /* ===== Các lớp trang trí ===== */

  const DECORATIONS = {
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

  function paintText(context, template, geo) {
    const text = { ...BRAND_TEXT, ...template.text };
    const { width, height, strip } = geo;

    context.save();
    context.fillStyle = text.color || template.palette.ink;
    context.textAlign = "center";

    if (text.shadow) {
      context.shadowColor = text.shadow;
      context.shadowBlur = 10 * geo.scale;
    }

    if (text.titleFont === "script") {
      context.font = `${strip ? 46 : 62}px Pacifico, Georgia, serif`;
    } else if (text.titleFont === "bold") {
      context.font = `italic 900 ${strip ? 46 : 62}px Arial, sans-serif`;
    } else {
      context.font = `900 ${strip ? 42 : 58}px Georgia`;
    }

    context.fillText(text.title, width / 2, strip ? 70 : 82);

    context.font = `800 ${strip ? 17 : 24}px Arial`;
    context.fillText(
      text.subtitle,
      width / 2,
      strip ? height - 88 : height - 58
    );

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
