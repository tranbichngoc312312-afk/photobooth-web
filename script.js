"use strict";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const video = $("#cameraVideo");
const cameraStage = $("#cameraStage");
const captureCanvas = $("#captureCanvas");
const recapCanvas = $("#recapCanvas");
const outputCanvas = $("#outputCanvas");
const cameraPlaceholder = $("#cameraPlaceholder");
const cameraStatus = $("#cameraStatus");
const countdownOverlay = $("#countdownOverlay");
const flashOverlay = $("#flashOverlay");
const capturedPhotos = $("#capturedPhotos");
const photoProgress = $("#photoProgress");
const captureMessage = $("#captureMessage");
const emptyPreview = $("#emptyPreview");
const previewStatus = $("#previewStatus");
const downloadImageButton = $("#downloadImageButton");
const downloadVideoButton = $("#downloadVideoButton");
const videoHint = $("#videoHint");
const toast = $("#toast");

const nextToEditorButton =
  $("#nextToEditorButton");

const backToCaptureButton =
  $("#backToCaptureButton");

const editorScreen =
  $("#editorScreen");

const layoutSelect = $("#layoutSelect");
const countdownSelect = $("#countdownSelect");
const intervalSelect = $("#intervalSelect");
const uploadPhotoInput = $("#uploadPhotoInput");
const customFrameInput = $("#customFrameInput");
const brightnessRange = $("#brightnessRange");
const contrastRange = $("#contrastRange");
const saturationRange = $("#saturationRange");
const brightnessValue = $("#brightnessValue");
const contrastValue = $("#contrastValue");
const saturationValue = $("#saturationValue");
const customText = $("#customText");
const textColor = $("#textColor");
const textPosition = $("#textPosition");

const LAYOUTS = {
  strip4: {
    count: 4,
    width: 900,
    height: 2700,
    columns: 1,
    rows: 4,
    label: "1 × 4"
  },

  grid4: {
    count: 4,
    width: 1600,
    height: 1780,
    columns: 2,
    rows: 2,
    label: "2 × 2"
  },

  grid6: {
    count: 6,
    width: 1600,
    height: 2440,
    columns: 2,
    rows: 3,
    label: "2 × 3"
  },

  single: {
    count: 1,
    width: 1600,
    height: 1200,
    columns: 1,
    rows: 1,
    label: "Một ảnh"
  }
};

const FILTERS = {
  normal: "none",
  bright: "brightness(1.12) saturate(1.05)",
  warm: "sepia(.18) saturate(1.12) brightness(1.05)",
  retro: "sepia(.45) contrast(1.05) saturate(.86)",
  mono: "grayscale(1) contrast(1.08)",
  vivid: "contrast(1.1) saturate(1.35)"
};

let stream = null;
let facingMode = "user";
let photos = [];
let selectedSlot = 0;
let isCapturing = false;
let soundEnabled = true;
let activeFrame = "pink";
let activeFilter = "normal";
let selectedSticker = "";
let customFrameUrl = "";
let recorder = null;
let recapChunks = [];
let recapBlob = null;
let recapAnimationId = null;
let toastTimer = null;
let audioContext = null;
let previewRenderFrame = 0;
let compositeRenderToken = 0;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getLayout() {
  return LAYOUTS[layoutSelect.value] || LAYOUTS.strip4;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function updateSteps(stepNumber) {
  $$(".step").forEach((step, index) => {
    step.classList.toggle("active", index < stepNumber);
  });
}

function revokePhoto(photo) {
  if (photo?.url?.startsWith("blob:")) {
    URL.revokeObjectURL(photo.url);
  }
}

function clearRecap() {
  if (recapBlob?.url) {
    URL.revokeObjectURL(recapBlob.url);
  }

  recapBlob = null;
  downloadVideoButton.disabled = true;

  videoHint.textContent =
    "Video recap được ghi khi bạn dùng chế độ chụp tự động.";
}

async function startCamera() {
  cameraStatus.textContent = "Đang mở camera…";

  cameraPlaceholder.hidden = false;
  cameraPlaceholder.style.display = "grid";

  $("#cameraPlaceholder strong").textContent =
    "Đang mở camera…";

  $("#cameraPlaceholder p").textContent =
    "Vui lòng chờ trong giây lát.";

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        "Trình duyệt không hỗ trợ camera."
      );
    }

    if (stream) {
      stream
        .getTracks()
        .forEach(track => track.stop());

      stream = null;
    }

    stream =
      await navigator.mediaDevices.getUserMedia({
        audio: false,

        video: {
          facingMode: {
            ideal: facingMode
          },

          width: {
            ideal: 1280
          },

          height: {
            ideal: 960
          }
        }
      });

    video.setAttribute("autoplay", "");
video.setAttribute("muted", "");
video.setAttribute("playsinline", "");
video.setAttribute(
  "webkit-playsinline",
  ""
);
video.setAttribute(
  "disablepictureinpicture",
  ""
);
    video.srcObject = stream;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;

    if ("disablePictureInPicture" in video) {
  video.disablePictureInPicture = true;
}

    await video.play();

    video.classList.toggle(
  "mirror-preview",
  facingMode === "user"
);

    if (
      video.readyState < 2 ||
      !video.videoWidth
    ) {
      await waitForVideoFrame();
    }

    video.style.display = "block";
    video.style.visibility = "visible";
    video.style.opacity = "1";
    

    cameraPlaceholder.hidden = true;
    cameraPlaceholder.style.display = "none";

    cameraStatus.textContent =
      facingMode === "user"
        ? "Camera trước đã sẵn sàng"
        : "Camera sau đã sẵn sàng";
  } catch (error) {
    console.error(
      "Lỗi mở camera:",
      error
    );

    cameraPlaceholder.hidden = false;
    cameraPlaceholder.style.display = "grid";

    $("#cameraPlaceholder strong").textContent =
      "Không thể mở camera";

    $("#cameraPlaceholder p").textContent =
      "Hãy cấp quyền camera trong cài đặt trình duyệt rồi thử lại.";

    cameraStatus.textContent =
      "Không thể mở camera";

    showToast(
      "Không mở được camera. Hãy kiểm tra quyền truy cập."
    );
  }
}

function waitForVideoFrame() {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 2 && video.videoWidth > 0) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error("Camera chưa có khung hình."));
    }, 8000);

    video.addEventListener(
      "loadeddata",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      {
        once: true
      }
    );
  });
}

function setBusy(busy) {
  isCapturing = busy;

  [
    $("#manualCaptureButton"),
    $("#autoCaptureButton"),
    $("#retakeButton"),
    $("#resetButton"),
    layoutSelect,
    $("#switchCameraButton")
  ].forEach(element => {
    if (element) {
      element.disabled = busy;
    }
  });
}

async function beep(frequency = 700, duration = 90) {
  if (!soundEnabled) {
    return;
  }

  try {
    audioContext ||= new (
      window.AudioContext ||
      window.webkitAudioContext
    )();

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.frequency.value = frequency;

    gain.gain.setValueAtTime(
      0.08,
      audioContext.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + duration / 1000
    );

    oscillator.connect(gain).connect(audioContext.destination);

    oscillator.start();

    oscillator.stop(
      audioContext.currentTime + duration / 1000
    );
  } catch (error) {
    console.warn("Không phát được âm thanh", error);
  }
}

async function runCountdown() {
  const seconds = Number(countdownSelect.value);

  for (let number = seconds; number > 0; number--) {
    countdownOverlay.textContent = number;

    beep(
      number === 1 ? 960 : 680,
      100
    );

    await wait(1000);
  }

  countdownOverlay.textContent = "";
}

function flash() {
  flashOverlay.classList.remove("flash");

  void flashOverlay.offsetWidth;

  flashOverlay.classList.add("flash");
}

function canvasToBlob(
  canvas,
  type = "image/jpeg",
  quality = 0.9
) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) {
          resolve(blob);
        } else {
          reject(
            new Error("Không thể tạo ảnh.")
          );
        }
      },
      type,
      quality
    );
  });
}
function drawVideoCover(
  context,
  sourceVideo,
  targetWidth,
  targetHeight
) {
  const sourceWidth =
    sourceVideo.videoWidth;

  const sourceHeight =
    sourceVideo.videoHeight;

  const sourceRatio =
    sourceWidth / sourceHeight;

  const targetRatio =
    targetWidth / targetHeight;

  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (sourceRatio > targetRatio) {
    // Camera rộng hơn khung: cắt hai bên
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else {
    // Camera cao hơn khung: cắt trên và dưới
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  }

  context.drawImage(
    sourceVideo,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    targetWidth,
    targetHeight
  );
}
async function captureCurrentFrame(targetIndex = null) {
  if (
    !stream ||
    video.readyState < 2 ||
    !video.videoWidth
  ) {
    showToast("Camera chưa sẵn sàng.");
    return false;
  }

  const stageRect =
  cameraStage?.getBoundingClientRect();

const previewRatio =
  stageRect?.width > 0 &&
  stageRect?.height > 0
    ? stageRect.width / stageRect.height
    : video.videoWidth / video.videoHeight;

const maxSize = 1280;

let width;
let height;

if (previewRatio >= 1) {
  width = Math.min(
    maxSize,
    video.videoWidth
  );

  height = Math.round(
    width / previewRatio
  );
} else {
  height = Math.min(
    maxSize,
    video.videoHeight
  );

  width = Math.round(
    height * previewRatio
  );
}

width = Math.max(2, width);
height = Math.max(2, height);

captureCanvas.width = width;
captureCanvas.height = height;
  const context = captureCanvas.getContext(
    "2d",
    {
      alpha: false
    }
  );

  context.save();

  if (facingMode === "user") {
  context.translate(width, 0);
  context.scale(-1, 1);
}

  

  drawVideoCover(
  context,
  video,
  width,
  height
);

  context.restore();

  flash();
  beep(1180, 150);

  const blob = await canvasToBlob(
    captureCanvas,
    "image/jpeg",
    0.9
  );

  const url = URL.createObjectURL(blob);

  const index =
    targetIndex ?? findNextTargetSlot();

  if (index < 0) {
    URL.revokeObjectURL(url);
    showToast("Bạn đã chụp đủ ảnh.");
    return false;
  }

  revokePhoto(photos[index]);

  photos[index] = {
    url,
    name: `Ảnh ${index + 1}`,
    source: "camera"
  };

  selectedSlot = Math.min(
    index + 1,
    getLayout().count - 1
  );

  renderSlots();
  await renderComposite();

  if (video.paused) {
    await video.play().catch(() => {});
  }

  return true;
}

function findNextTargetSlot() {
  const count = getLayout().count;

  if (
    selectedSlot >= 0 &&
    selectedSlot < count &&
    !photos[selectedSlot]
  ) {
    return selectedSlot;
  }

  for (let index = 0; index < count; index++) {
    if (!photos[index]) {
      return index;
    }
  }

  if (
    selectedSlot >= 0 &&
    selectedSlot < count
  ) {
    return selectedSlot;
  }

  return -1;
}

function nextEmptySlot() {
  const count = getLayout().count;

  for (let index = 0; index < count; index++) {
    if (!photos[index]) {
      return index;
    }
  }

  return -1;
}

async function autoCapture() {
  if (isCapturing) {
    return;
  }

  if (!stream) {
    await startCamera();

    if (!stream) {
      return;
    }
  }

  if (
    photos.filter(Boolean).length ===
    getLayout().count
  ) {
    const replace = confirm(
      "Bạn đã đủ ảnh. Xóa ảnh cũ và chụp bộ mới?"
    );

    if (!replace) {
      return;
    }

    resetPhotos(false);
  }

  clearRecap();
  setBusy(true);
  updateSteps(2);

  captureMessage.textContent =
    "Đang chụp tự động, hãy tạo dáng nhé!";

  await startRecapRecording();

  try {
    while (nextEmptySlot() !== -1) {
      selectedSlot = nextEmptySlot();

      renderSlots();

      await runCountdown();

      const success =
        await captureCurrentFrame(selectedSlot);

      if (!success) {
        break;
      }

      if (nextEmptySlot() !== -1) {
        await wait(
          Number(intervalSelect.value) * 1000
        );
      }
    }

    captureMessage.textContent =
      "Đã chụp xong. Bạn có thể chọn khung và filter.";

    updateSteps(3);
  } catch (error) {
    console.error(error);

    showToast(
      "Có lỗi khi chụp tự động."
    );
  } finally {
    await stopRecapRecording();
    setBusy(false);
  }
}

async function manualCapture() {
  if (isCapturing) {
    return;
  }

  setBusy(true);

  try {
    await captureCurrentFrame();
  } catch (error) {
    console.error(error);

    showToast(
      "Không thể chụp ảnh."
    );
  } finally {
    setBusy(false);
  }
}

function retakeSelected() {
  const count = getLayout().count;

  const index =
    selectedSlot >= 0 &&
    selectedSlot < count
      ? selectedSlot
      : count - 1;

  if (!photos[index]) {
    const last = [...photos]
      .slice(0, count)
      .map((photo, photoIndex) =>
        photo ? photoIndex : -1
      )
      .filter(photoIndex => photoIndex >= 0)
      .pop();

    if (last === undefined) {
      showToast(
        "Bạn chưa có ảnh để chụp lại."
      );

      return;
    }

    selectedSlot = last;
  }

  revokePhoto(photos[selectedSlot]);

  photos[selectedSlot] = null;

  clearRecap();
  renderSlots();
  renderComposite();

  showToast(
    `Đã chọn ô ${selectedSlot + 1}. Bấm chụp để thay ảnh.`
  );
}

function resetPhotos(ask = true) {
  if (
    ask &&
    photos.some(Boolean) &&
    !confirm("Xóa toàn bộ ảnh đã chụp?")
  ) {
    return;
  }

  photos.forEach(revokePhoto);

  photos = [];
  selectedSlot = 0;

  clearRecap();
  renderSlots();
  renderComposite();

  captureMessage.textContent =
    "Bấm nút tròn để chụp tự động đủ số ảnh.";

  updateSteps(1);
}

function renderSlots() {
  const layout = getLayout();

  photos.length = Math.min(
    photos.length,
    layout.count
  );

  capturedPhotos.innerHTML = "";

  for (
    let index = 0;
    index < layout.count;
    index++
  ) {
    const slot = document.createElement("div");

    slot.className =
      `photo-slot${
        selectedSlot === index
          ? " selected"
          : ""
      }`;

    slot.tabIndex = 0;
    slot.dataset.index = index;

    slot.innerHTML =
      `<span class="slot-number">
        ${index + 1}
      </span>`;

    if (photos[index]) {
      const image =
        document.createElement("img");

      image.src = photos[index].url;
      image.alt = `Ảnh số ${index + 1}`;
      image.style.filter =
        getCombinedFilter();

      slot.appendChild(image);

      const actions =
        document.createElement("div");

      actions.className = "slot-actions";

      actions.innerHTML = `
        <button
          type="button"
          data-action="replace"
          title="Chụp lại"
        >
          ↶
        </button>

        <button
          type="button"
          data-action="delete"
          title="Xóa"
        >
          ✕
        </button>
      `;

      slot.appendChild(actions);
    } else {
      const empty =
        document.createElement("div");

      empty.className = "photo-empty";

      empty.innerHTML = `
        <strong>
          Ảnh ${index + 1}
        </strong>

        <small>
          Chạm để chọn ô
        </small>
      `;

      slot.appendChild(empty);
    }

    slot.addEventListener(
      "click",
      event => {
        const action =
          event.target
            .closest("button")
            ?.dataset.action;

        selectedSlot = index;

        if (action === "delete") {
          revokePhoto(photos[index]);

          photos[index] = null;

          clearRecap();
          renderComposite();
        } else if (
          action === "replace"
        ) {
          revokePhoto(photos[index]);

          photos[index] = null;

          clearRecap();

          showToast(
            `Ô ${index + 1} đã sẵn sàng để chụp lại.`
          );

          renderComposite();
        }

        renderSlots();
      }
    );

    slot.addEventListener(
      "keydown",
      event => {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          selectedSlot = index;
          renderSlots();
        }
      }
    );

    capturedPhotos.appendChild(slot);
  }

  const total = photos
    .slice(0, layout.count)
    .filter(Boolean)
    .length;

  photoProgress.textContent =
    `${total}/${layout.count}`;

  captureMessage.textContent =
    total === layout.count
      ? "Đã đủ ảnh. Hãy trang trí và tải xuống."
      : `Còn ${layout.count - total} ảnh nữa.`;

  const readyForEditor =
  total === layout.count;

if (nextToEditorButton) {
  nextToEditorButton.disabled =
    !readyForEditor;

  nextToEditorButton.textContent =
    readyForEditor
      ? "Tiếp theo: Trang trí →"
      : `Chụp đủ ${layout.count} ảnh để tiếp tục`;
}
}

function getCombinedFilter() {
  const base =
    FILTERS[activeFilter] || "none";

  const adjustments = `
    brightness(${
      Number(brightnessRange.value) / 100
    })

    contrast(${
      Number(contrastRange.value) / 100
    })

    saturate(${
      Number(saturationRange.value) / 100
    })
  `;

  return base === "none"
    ? adjustments
    : `${base} ${adjustments}`;
}

function updateVideoPreviewFilter() {
  video.style.filter =
    getCombinedFilter();

  $$(".photo-slot img").forEach(
    image => {
      image.style.filter =
        getCombinedFilter();
    }
  );
}

function loadImage(url) {
  return new Promise(
    (resolve, reject) => {
      const image = new Image();

      image.onload = () =>
        resolve(image);

      image.onerror = reject;

      image.src = url;
    }
  );
}

function drawImageCover(
  context,
  image,
  x,
  y,
  width,
  height
) {
  const imageRatio =
    image.naturalWidth /
    image.naturalHeight;

  const targetRatio =
    width / height;

  let sx = 0;
  let sy = 0;
  let sw = image.naturalWidth;
  let sh = image.naturalHeight;

  if (imageRatio > targetRatio) {
    sw =
      image.naturalHeight *
      targetRatio;

    sx =
      (image.naturalWidth - sw) / 2;
  } else {
    sh =
      image.naturalWidth /
      targetRatio;

    sy =
      (image.naturalHeight - sh) / 2;
  }

  context.drawImage(
    image,
    sx,
    sy,
    sw,
    sh,
    x,
    y,
    width,
    height
  );
}

function clampColor(value) {
  return Math.max(0, Math.min(255, value));
}

function applyPixelFilter(canvas) {
  const context = canvas.getContext("2d", {
    willReadFrequently: true
  });
  const imageData = context.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );
  const data = imageData.data;

  const userBrightness =
    Number(brightnessRange.value) / 100;
  const userContrast =
    Number(contrastRange.value) / 100;
  const userSaturation =
    Number(saturationRange.value) / 100;

  const preset = {
    brightness: 1,
    contrast: 1,
    saturation: 1,
    sepia: 0,
    grayscale: 0
  };

  if (activeFilter === "bright") {
    preset.brightness = 1.12;
    preset.saturation = 1.05;
  } else if (activeFilter === "warm") {
    preset.sepia = 0.18;
    preset.saturation = 1.12;
    preset.brightness = 1.05;
  } else if (activeFilter === "retro") {
    preset.sepia = 0.45;
    preset.contrast = 1.05;
    preset.saturation = 0.86;
  } else if (activeFilter === "mono") {
    preset.grayscale = 1;
    preset.contrast = 1.08;
  } else if (activeFilter === "vivid") {
    preset.contrast = 1.1;
    preset.saturation = 1.35;
  }

  const changeSaturation = (rgb, amount) => {
    const luminance =
      rgb[0] * 0.2126 +
      rgb[1] * 0.7152 +
      rgb[2] * 0.0722;

    return rgb.map(
      channel =>
        luminance +
        (channel - luminance) * amount
    );
  };

  const changeContrast = (rgb, amount) =>
    rgb.map(
      channel =>
        (channel - 128) * amount + 128
    );

  for (let index = 0; index < data.length; index += 4) {
    let rgb = [
      data[index],
      data[index + 1],
      data[index + 2]
    ];

    if (preset.sepia > 0) {
      const [red, green, blue] = rgb;
      const sepiaRgb = [
        red * 0.393 + green * 0.769 + blue * 0.189,
        red * 0.349 + green * 0.686 + blue * 0.168,
        red * 0.272 + green * 0.534 + blue * 0.131
      ];

      rgb = rgb.map(
        (channel, channelIndex) =>
          channel * (1 - preset.sepia) +
          sepiaRgb[channelIndex] * preset.sepia
      );
    }

    if (preset.grayscale > 0) {
      const gray =
        rgb[0] * 0.2126 +
        rgb[1] * 0.7152 +
        rgb[2] * 0.0722;
      rgb = [gray, gray, gray];
    }

    rgb = changeContrast(rgb, preset.contrast);
    rgb = changeSaturation(rgb, preset.saturation);
    rgb = rgb.map(
      channel => channel * preset.brightness
    );

    rgb = changeContrast(rgb, userContrast);
    rgb = changeSaturation(rgb, userSaturation);
    rgb = rgb.map(
      channel => channel * userBrightness
    );

    data[index] = clampColor(rgb[0]);
    data[index + 1] = clampColor(rgb[1]);
    data[index + 2] = clampColor(rgb[2]);
  }

  context.putImageData(imageData, 0, 0);
}

function framePalette(frame) {
  const palettes = {
    pink: {
      bg: "#ff98bc",
      inner: "#fff8fb",
      ink: "#ffffff",
      accent: "#ffe3ee"
    },

    cream: {
      bg: "#f0dfbd",
      inner: "#fffaf0",
      ink: "#694d3e",
      accent: "#fff4da"
    },

    sky: {
      bg: "#88c8ee",
      inner: "#f7fcff",
      ink: "#ffffff",
      accent: "#dff4ff"
    },

    film: {
      bg: "#292329",
      inner: "#f8ead8",
      ink: "#f7dfb9",
      accent: "#111111"
    },

    mono: {
      bg: "#111111",
      inner: "#fafafa",
      ink: "#ffffff",
      accent: "#e9e9e9"
    },

    none: {
      bg: "#ffffff",
      inner: "#ffffff",
      ink: "#5b376d",
      accent: "#ffffff"
    },

    custom: {
      bg: "#ffffff",
      inner: "#ffffff",
      ink: "#5b376d",
      accent: "#ffffff"
    }
  };

  return palettes[frame] ||
    palettes.pink;
}

function roundedRect(
  context,
  x,
  y,
  width,
  height,
  radius
) {
  const r = Math.min(
    radius,
    width / 2,
    height / 2
  );

  context.beginPath();

  context.moveTo(
    x + r,
    y
  );

  context.arcTo(
    x + width,
    y,
    x + width,
    y + height,
    r
  );

  context.arcTo(
    x + width,
    y + height,
    x,
    y + height,
    r
  );

  context.arcTo(
    x,
    y + height,
    x,
    y,
    r
  );

  context.arcTo(
    x,
    y,
    x + width,
    y,
    r
  );

  context.closePath();
}

function getPhotoBoxes(layout) {
  const frame = activeFrame;

  const strip =
    layoutSelect.value ===
    "strip4";

  const single =
    layoutSelect.value ===
    "single";

  const padding =
    strip ? 60 : 70;

  const header =
    strip ? 90 : 100;

  const footer =
    strip
      ? 165
      : single
        ? 70
        : 120;

  const gap =
    strip ? 32 : 36;

  const usableWidth =
    layout.width -
    padding * 2;

  const usableHeight =
    layout.height -
    padding * 2 -
    header -
    footer;

  const boxWidth =
    (
      usableWidth -
      gap * (layout.columns - 1)
    ) /
    layout.columns;

  const boxHeight =
    (
      usableHeight -
      gap * (layout.rows - 1)
    ) /
    layout.rows;

  const boxes = [];

  for (
    let row = 0;
    row < layout.rows;
    row++
  ) {
    for (
      let col = 0;
      col < layout.columns;
      col++
    ) {
      boxes.push({
        x:
          padding +
          col * (boxWidth + gap),

        y:
          padding +
          header +
          row * (boxHeight + gap),

        width: boxWidth,
        height: boxHeight
      });
    }
  }

  return {
    boxes,
    padding,
    header,
    footer,
    gap,
    frame
  };
}

async function renderComposite() {
  const renderToken =
    ++compositeRenderToken;
  const layout = getLayout();

  const filled = photos
    .slice(0, layout.count)
    .filter(Boolean)
    .length;

  const ready =
    filled === layout.count;

  downloadImageButton.disabled =
    !ready;

  previewStatus.textContent =
    ready
      ? "Sẵn sàng tải"
      : `Thiếu ${
          layout.count - filled
        } ảnh`;

  previewStatus.classList.toggle(
    "ready",
    ready
  );

  if (!ready) {
    outputCanvas.style.display =
      "none";

    emptyPreview.style.display =
      "grid";

    return;
  }

  updateSteps(4);

  const workCanvas =
  document.createElement("canvas");

workCanvas.width =
  layout.width;

workCanvas.height =
  layout.height;

const context =
  workCanvas.getContext("2d");

  const palette =
    framePalette(activeFrame);

  context.clearRect(
    0,
    0,
    layout.width,
    layout.height
  );

  context.fillStyle =
    palette.bg;

  context.fillRect(
    0,
    0,
    layout.width,
    layout.height
  );

  const {
    boxes,
    padding
  } = getPhotoBoxes(layout);

  for (
    let index = 0;
    index < layout.count;
    index++
  ) {
    const image =
      await loadImage(
        photos[index].url
      );

    const box =
      boxes[index];

    const photoCanvas =
      document.createElement("canvas");
    photoCanvas.width =
      Math.max(1, Math.round(box.width));
    photoCanvas.height =
      Math.max(1, Math.round(box.height));

    const photoContext =
      photoCanvas.getContext("2d");

    drawImageCover(
      photoContext,
      image,
      0,
      0,
      photoCanvas.width,
      photoCanvas.height
    );

    applyPixelFilter(photoCanvas);

    context.save();

    roundedRect(
      context,
      box.x,
      box.y,
      box.width,
      box.height,
      18
    );

    context.clip();

    context.drawImage(
      photoCanvas,
      box.x,
      box.y,
      box.width,
      box.height
    );

    context.restore();

    if (
      activeFrame === "film"
    ) {
      drawFilmMarks(
        context,
        box,
        index
      );
    }
  }

  drawFrameDecorations(
    context,
    layout,
    palette,
    padding
  );

  if (customFrameUrl) {
    try {
      const frameImage =
        await loadImage(
          customFrameUrl
        );

      context.drawImage(
        frameImage,
        0,
        0,
        layout.width,
        layout.height
      );
    } catch (error) {
      console.warn(
        "Không vẽ được khung riêng",
        error
      );
    }
  }

  drawCustomText(
    context,
    layout,
    palette
  );

  drawSticker(
    context,
    layout
  );

  if (
  renderToken !== compositeRenderToken
) {
  return;
}

outputCanvas.width =
  layout.width;

outputCanvas.height =
  layout.height;

const outputContext =
  outputCanvas.getContext("2d");

outputContext.clearRect(
  0,
  0,
  outputCanvas.width,
  outputCanvas.height
);

outputContext.drawImage(
  workCanvas,
  0,
  0
);

outputCanvas.style.display =
  "block";

emptyPreview.style.display =
  "none";
}

function drawFrameDecorations(
  context,
  layout,
  palette,
  padding
) {
  const strip =
    layoutSelect.value ===
    "strip4";

  const single =
    layoutSelect.value ===
    "single";

  context.save();

  context.fillStyle =
    palette.ink;

  context.textAlign =
    "center";

  context.font =
    `900 ${
      strip ? 42 : 58
    }px Georgia`;

  context.fillText(
    "NoHa",
    layout.width / 2,
    strip ? 70 : 82
  );

  context.font =
    `800 ${
      strip ? 17 : 24
    }px Arial`;

  context.fillText(
    "TIỆM PHOTOBOOTH",
    layout.width / 2,
    strip
      ? layout.height - 88
      : layout.height - 58
  );

  if (
    activeFrame === "pink" ||
    activeFrame === "cream" ||
    activeFrame === "sky"
  ) {
    context.font =
      `${
        strip ? 38 : 52
      }px Arial`;

    context.fillText(
      "✿",
      padding,
      strip
        ? layout.height - 70
        : 70
    );

    context.fillText(
      "✿",
      layout.width - padding,
      strip
        ? 74
        : layout.height - 62
    );
  }

  if (
    activeFrame === "mono"
  ) {
    context.strokeStyle =
      "#ffffff";

    context.lineWidth =
      strip ? 5 : 8;

    context.strokeRect(
      20,
      20,
      layout.width - 40,
      layout.height - 40
    );
  }

  if (
    single &&
    activeFrame === "none"
  ) {
    context.fillStyle =
      "rgba(255,255,255,.72)";

    context.fillRect(
      0,
      layout.height - 80,
      layout.width,
      80
    );

    context.fillStyle =
      "#5b376d";

    context.font =
      "800 26px Arial";

    context.fillText(
      "NoHa · Tiệm Photobooth",
      layout.width / 2,
      layout.height - 30
    );
  }

  context.restore();
}

function drawFilmMarks(
  context,
  box,
  index
) {
  context.save();

  context.fillStyle =
    "#f6dfbb";

  const size = Math.max(
    10,
    box.width * 0.018
  );

  for (
    let x = box.x + 20;
    x < box.x + box.width - 20;
    x += size * 2.2
  ) {
    context.fillRect(
      x,
      box.y - 16,
      size,
      8
    );

    context.fillRect(
      x,
      box.y +
        box.height +
        8,
      size,
      8
    );
  }

  context.font =
    `700 ${
      Math.max(
        12,
        box.width * 0.025
      )
    }px monospace`;

  context.fillText(
    String(index + 1)
      .padStart(2, "0"),
    box.x + 10,
    box.y + 24
  );

  context.restore();
}

function drawCustomText(
  context,
  layout,
  palette
) {
  const text =
    customText.value.trim();

  if (!text) {
    return;
  }

  const strip =
    layoutSelect.value ===
    "strip4";

  const fontSize =
    strip ? 34 : 52;

  let y =
    layout.height -
    (strip ? 125 : 105);

  if (
    textPosition.value === "top"
  ) {
    y = strip ? 118 : 140;
  }

  if (
    textPosition.value ===
    "center"
  ) {
    y = layout.height / 2;
  }

  context.save();

  context.textAlign =
    "center";

  context.font =
    `900 ${fontSize}px Arial`;

  context.lineWidth =
    Math.max(
      4,
      fontSize * 0.12
    );

  context.strokeStyle =
    "rgba(0,0,0,.32)";

  context.fillStyle =
    textColor.value ||
    palette.ink;

  context.strokeText(
    text,
    layout.width / 2,
    y
  );

  context.fillText(
    text,
    layout.width / 2,
    y
  );

  context.restore();
}

function drawSticker(
  context,
  layout
) {
  if (!selectedSticker) {
    return;
  }

  const strip =
    layoutSelect.value ===
    "strip4";

  const size =
    strip ? 76 : 112;

  context.save();

  context.font =
    `${size}px Arial`;

  context.textAlign =
    "center";

  context.fillText(
    selectedSticker,
    strip
      ? layout.width - 105
      : layout.width - 130,
    strip ? 128 : 155
  );

  context.fillText(
    selectedSticker,
    strip ? 105 : 130,
    strip
      ? layout.height - 110
      : layout.height - 120
  );

  context.restore();
}

async function downloadComposite() {
  await renderComposite();

  if (
    downloadImageButton.disabled
  ) {
    return;
  }

  const blob =
    await canvasToBlob(
      outputCanvas,
      "image/png"
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    `noha-photobooth-${
      layoutSelect.value
    }.png`;

  document.body.appendChild(link);

  link.click();
  link.remove();

  setTimeout(
    () =>
      URL.revokeObjectURL(url),
    2000
  );

  showToast(
    "Đã tạo ảnh PNG chất lượng cao."
  );
}

function chooseRecorderMimeType() {
  if (!window.MediaRecorder) {
    return "";
  }

  const types = [
    "video/mp4;codecs=h264",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ];

  return (
    types.find(
      type =>
        MediaRecorder
          .isTypeSupported?.(type)
    ) || ""
  );
}

async function startRecapRecording() {
  if (!stream || !window.MediaRecorder) {
    videoHint.textContent =
      "Trình duyệt này chưa hỗ trợ ghi video recap.";

    return;
  }

  try {
    recapChunks = [];

    const width = 720;
    const height = 540;

    recapCanvas.width = width;
    recapCanvas.height = height;

    const context =
      recapCanvas.getContext("2d");

    const draw = () => {
      context.save();

      context.fillStyle = "#1e1821";

      context.fillRect(
        0,
        0,
        width,
        height
      );

      if (video.readyState >= 2) {

        context.filter =
          getCombinedFilter();

        context.drawImage(
          video,
          0,
          0,
          width,
          height
        );
      }

      context.restore();

      context.fillStyle =
        "rgba(255,123,171,.9)";

      context.fillRect(
        0,
        height - 46,
        width,
        46
      );

      context.fillStyle = "#ffffff";
      context.textAlign = "center";
      context.font = "800 20px Arial";

      context.fillText(
        "NoHa · Tiệm Photobooth",
        width / 2,
        height - 16
      );

      recapAnimationId =
        requestAnimationFrame(draw);
    };

    draw();

    const canvasStream =
      recapCanvas.captureStream?.(24);

    const recordingStream =
      canvasStream || stream;

    const mimeType =
      chooseRecorderMimeType();

    recorder = mimeType
      ? new MediaRecorder(
          recordingStream,
          {
            mimeType,
            videoBitsPerSecond: 2500000
          }
        )
      : new MediaRecorder(
          recordingStream
        );

    recorder.addEventListener(
      "dataavailable",
      event => {
        if (event.data.size) {
          recapChunks.push(
            event.data
          );
        }
      }
    );

    recorder.start(250);

    videoHint.textContent =
      "Đang ghi video recap…";
  } catch (error) {
    console.warn(
      "Không ghi được recap",
      error
    );

    recorder = null;

    if (recapAnimationId) {
      cancelAnimationFrame(
        recapAnimationId
      );
    }

    videoHint.textContent =
      "Thiết bị này chưa ghi được video recap.";
  }
}

function stopRecapRecording() {
  return new Promise(resolve => {
    if (recapAnimationId) {
      cancelAnimationFrame(
        recapAnimationId
      );
    }

    recapAnimationId = null;

    if (
      !recorder ||
      recorder.state === "inactive"
    ) {
      resolve();
      return;
    }

    recorder.addEventListener(
      "stop",
      () => {
        try {
          const type =
            recorder.mimeType ||
            recapChunks[0]?.type ||
            "video/webm";

          const blob = new Blob(
            recapChunks,
            {
              type
            }
          );

          const url =
            URL.createObjectURL(blob);

          recapBlob = {
            blob,
            url,
            type
          };

          downloadVideoButton.disabled =
            false;

          videoHint.textContent =
            "Video recap đã sẵn sàng tải xuống.";
        } catch (error) {
          console.warn(error);
        }

        resolve();
      },
      {
        once: true
      }
    );

    recorder.stop();
  });
}

function downloadRecap() {
  if (!recapBlob) {
    showToast(
      "Hãy dùng chế độ chụp tự động để tạo video recap."
    );

    return;
  }

  const extension =
    recapBlob.type.includes("mp4")
      ? "mp4"
      : "webm";

  const link =
    document.createElement("a");

  link.href = recapBlob.url;

  link.download =
    `noha-video-recap.${extension}`;

  document.body.appendChild(link);

  link.click();
  link.remove();
}

async function handlePhotoUpload(files) {
  const layout = getLayout();

  const accepted = [...files]
    .filter(file =>
      file.type.startsWith("image/")
    )
    .slice(0, layout.count);

  if (!accepted.length) {
    return;
  }

  let index = nextEmptySlot();

  if (index === -1) {
    index = selectedSlot;
  }

  for (const file of accepted) {
    if (index >= layout.count) {
      break;
    }

    revokePhoto(photos[index]);

    photos[index] = {
      url: URL.createObjectURL(file),
      name: file.name,
      source: "upload"
    };

    index++;
  }

  selectedSlot = Math.min(
    index,
    layout.count - 1
  );

  clearRecap();
  renderSlots();

  await renderComposite();

  uploadPhotoInput.value = "";

  showToast(
    "Đã thêm ảnh từ thiết bị."
  );
}

function onLayoutChange() {
  const newCount =
    getLayout().count;

  photos
    .slice(newCount)
    .forEach(revokePhoto);

  photos.length = Math.min(
    photos.length,
    newCount
  );

  selectedSlot = 0;

  clearRecap();
  renderSlots();
  renderComposite();

  showToast(
    `Đã chọn layout ${
      getLayout().label
    }.`
  );
}

function bindOptionButtons() {
  $$(".frame-item").forEach(
    button => {
      button.addEventListener(
        "click",
        async () => {
          $$(".frame-item").forEach(
            item =>
              item.classList.remove(
                "active"
              )
          );

          button.classList.add(
            "active"
          );

          activeFrame =
            button.dataset.frame;

          if (
            activeFrame !== "custom"
          ) {
            customFrameUrl = "";
          }

          await renderComposite();
        }
      );
    }
  );

  $$(".filter-item").forEach(
    button => {
      button.addEventListener(
        "click",
        async () => {
          $$(".filter-item").forEach(
            item =>
              item.classList.remove(
                "active"
              )
          );

          button.classList.add(
            "active"
          );

          activeFilter =
            button.dataset.filter;

      

          await renderComposite();
        }
      );
    }
  );

  $$(".sticker-button").forEach(
    button => {
      button.addEventListener(
        "click",
        async () => {
          $$(".sticker-button").forEach(
            item =>
              item.classList.remove(
                "active"
              )
          );

          button.classList.add(
            "active"
          );

          selectedSticker =
            button.dataset.sticker;

          await renderComposite();
        }
      );
    }
  );
}


function scheduleCompositeRender() {
  cancelAnimationFrame(
    previewRenderFrame
  );

  previewRenderFrame =
    requestAnimationFrame(() => {
      renderComposite().catch(
        error => {
          console.error(
            "Lỗi render preview:",
            error
          );
        }
      );
    });
}

async function openEditorScreen() {
  const layout = getLayout();

  const total = photos
    .slice(0, layout.count)
    .filter(Boolean)
    .length;

  if (total !== layout.count) {
    showToast(
      "Bạn cần chụp đủ ảnh trước khi trang trí."
    );
    return;
  }

  document
    .querySelectorAll(".capture-view")
    .forEach(element => {
      element.classList.add(
        "screen-hidden"
      );
    });

  editorScreen.hidden = false;

  await renderComposite();

  editorScreen.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function openCaptureScreen() {
  editorScreen.hidden = true;

  document
    .querySelectorAll(".capture-view")
    .forEach(element => {
      element.classList.remove(
        "screen-hidden"
      );
    });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}
function bindEvents() {

  nextToEditorButton?.addEventListener(
  "click",
  openEditorScreen
);

backToCaptureButton?.addEventListener(
  "click",
  openCaptureScreen
);
  $("#startCameraButton")
    .addEventListener(
      "click",
      startCamera
    );

  $("#manualCaptureButton")
    .addEventListener(
      "click",
      manualCapture
    );

  $("#autoCaptureButton")
    .addEventListener(
      "click",
      autoCapture
    );

  $("#retakeButton")
    .addEventListener(
      "click",
      retakeSelected
    );

  $("#resetButton")
    .addEventListener(
      "click",
      () => resetPhotos(true)
    );

  $("#refreshPreviewButton")
    .addEventListener(
      "click",
      renderComposite
    );

  downloadImageButton
    .addEventListener(
      "click",
      downloadComposite
    );

  downloadVideoButton
    .addEventListener(
      "click",
      downloadRecap
    );

  layoutSelect
    .addEventListener(
      "change",
      onLayoutChange
    );

  uploadPhotoInput
    .addEventListener(
      "change",
      event =>
        handlePhotoUpload(
          event.target.files
        )
    );

  $("#switchCameraButton")
    .addEventListener(
      "click",
      async () => {
        facingMode =
          facingMode === "user"
            ? "environment"
            : "user";

        await startCamera();
      }
    );

  customFrameInput
    .addEventListener(
      "change",
      async event => {
        const file =
          event.target.files?.[0];

        if (!file) {
          return;
        }

        if (
          customFrameUrl.startsWith(
            "blob:"
          )
        ) {
          URL.revokeObjectURL(
            customFrameUrl
          );
        }

        customFrameUrl =
          URL.createObjectURL(file);

        activeFrame = "custom";

        $$(".frame-item").forEach(
          item =>
            item.classList.remove(
              "active"
            )
        );

        await renderComposite();

        showToast(
          "Đã áp dụng khung PNG riêng."
        );
      }
    );

  [
  brightnessRange,
  contrastRange,
  saturationRange
].forEach(input => {
  input.addEventListener(
    "input",
    () => {
      brightnessValue.value =
        `${brightnessRange.value}%`;

      contrastValue.value =
        `${contrastRange.value}%`;

      saturationValue.value =
        `${saturationRange.value}%`;

     
      scheduleCompositeRender();
    }
  );
});

  [
    customText,
    textColor,
    textPosition
  ].forEach(input => {
    input.addEventListener(
      "input",
      renderComposite
    );
  });

  textPosition.addEventListener(
    "change",
    renderComposite
  );

  $("#soundButton")
    .addEventListener(
      "click",
      event => {
        soundEnabled =
          !soundEnabled;

        event.currentTarget.textContent =
          soundEnabled
            ? "🔊"
            : "🔇";

        showToast(
          soundEnabled
            ? "Đã bật âm thanh."
            : "Đã tắt âm thanh."
        );
      }
    );

  const helpDialog =
    $("#helpDialog");

  $("#helpButton")
    .addEventListener(
      "click",
      () => {
        helpDialog.showModal();
      }
    );

  $("#closeHelpButton")
    .addEventListener(
      "click",
      () => {
        helpDialog.close();
      }
    );

  window.addEventListener(
    "beforeunload",
    () => {
      stream
        ?.getTracks()
        .forEach(track =>
          track.stop()
        );

      photos.forEach(
        revokePhoto
      );

      if (
        customFrameUrl.startsWith(
          "blob:"
        )
      ) {
        URL.revokeObjectURL(
          customFrameUrl
        );
      }

      if (recapBlob?.url) {
        URL.revokeObjectURL(
          recapBlob.url
        );
      }
    }
  );
}


function setupMobileEditorTools() {
  const mobileMedia = window.matchMedia(
    "(max-width: 780px)"
  );

  const editorScreen =
    document.querySelector("#editorScreen");

  const mobileBackButton =
  document.querySelector(
    "#mobileBackToCaptureButton"
  );

const mobileDownloadButton =
  document.querySelector(
    "#mobileDownloadImageButton"
  );

const originalBackButton =
  document.querySelector(
    "#backToCaptureButton"
  );

const originalDownloadButton =
  document.querySelector(
    "#downloadImageButton"
  );

  const editorLayout =
    document.querySelector(".mobile-editor-layout");

  const toolsPanel =
    document.querySelector("#mobileToolsPanel");

  const toolButtons = [
    ...document.querySelectorAll(
      ".mobile-tool-button"
    )
  ];

  const toolPanels = [
    ...document.querySelectorAll(
      "[data-mobile-panel]"
    )
  ];

  if (
    !editorScreen ||
    !editorLayout ||
    !toolsPanel ||
    toolButtons.length === 0 ||
    toolPanels.length === 0
  ) {
    return;
  }

  let activeTool = null;

  function renderMobileEditorTools() {
    const isMobile = mobileMedia.matches;
    const isOpen =
      isMobile && activeTool !== null;

    editorScreen.dataset.activeTool =
      activeTool || "";

    editorLayout.classList.toggle(
      "is-tool-open",
      isOpen
    );

    toolsPanel.classList.toggle(
      "is-open",
      isOpen
    );

    const panelClosed =
  isMobile && !isOpen;

toolsPanel.setAttribute(
  "aria-hidden",
  String(panelClosed)
);

if ("inert" in toolsPanel) {
  toolsPanel.inert = panelClosed;
}

    toolButtons.forEach((button) => {
      const isActive =
        isMobile &&
        button.dataset.mobileTool === activeTool;

      button.classList.toggle(
        "is-active",
        isActive
      );

      button.setAttribute(
        "aria-pressed",
        String(isActive)
      );
    });

    toolPanels.forEach((panel) => {
      if (!isMobile) {
        panel.hidden = false;
        return;
      }

      panel.hidden =
        panel.dataset.mobilePanel !== activeTool;
    });
  }

  toolButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (!mobileMedia.matches) {
        return;
      }

      const selectedTool =
        button.dataset.mobileTool;

      activeTool =
        activeTool === selectedTool
          ? null
          : selectedTool;

      renderMobileEditorTools();
    });
  });

  function handleScreenChange() {
    if (!mobileMedia.matches) {
      activeTool = null;
    }

    renderMobileEditorTools();
  }

  if (mobileMedia.addEventListener) {
    mobileMedia.addEventListener(
      "change",
      handleScreenChange
    );
  } else {
    mobileMedia.addListener(
      handleScreenChange
    );
  }

  mobileBackButton?.addEventListener(
  "click",
  () => {
    activeTool = null;
    renderMobileEditorTools();
    originalBackButton?.click();
  }
);

mobileDownloadButton?.addEventListener(
  "click",
  () => {
    originalDownloadButton?.click();
  }
);

/* Đồng bộ trạng thái nút tải mobile với nút tải gốc */
if (
  mobileDownloadButton &&
  originalDownloadButton
) {
  const syncDownloadButton = () => {
    mobileDownloadButton.disabled =
      originalDownloadButton.disabled;
  };

  const downloadObserver =
    new MutationObserver(syncDownloadButton);

  downloadObserver.observe(
    originalDownloadButton,
    {
      attributes: true,
      attributeFilter: ["disabled"]
    }
  );

  syncDownloadButton();
}
  renderMobileEditorTools();
}
async function init() {
    /* Luôn bắt đầu ở màn hình chụp ảnh */
  editorScreen.hidden = true;

  document
    .querySelectorAll(".capture-view")
    .forEach(element => {
      element.classList.remove("screen-hidden");
    });
  bindOptionButtons();
  bindEvents();
  setupMobileEditorTools();
  renderSlots();
  updateVideoPreviewFilter();

  cameraStatus.textContent =
  "Bấm Mở camera để bắt đầu.";
}

init();
