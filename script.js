const camera = document.getElementById("camera");
const canvas = document.getElementById("photoCanvas");
const cameraMessage = document.getElementById("cameraMessage");
const countdownDisplay = document.getElementById("countdown");

const layoutSelect = document.getElementById("layoutSelect");
const countdownSelect = document.getElementById("countdownSelect");

const manualButton = document.getElementById("manualButton");
const captureButton = document.getElementById("captureButton");
const retakeButton = document.getElementById("retakeButton");
const retryButton = document.getElementById("retryButton");
const downloadButton = document.getElementById("downloadButton");
const frameButton = document.getElementById("frameButton");

const photoCounter = document.getElementById("photoCounter");
const photoSlots = document.querySelectorAll(".photo-slot");
const filterButtons = document.querySelectorAll(".filter");

let cameraStream = null;
let photos = [];
let maxPhotos = 4;
let currentFilter = "none";
let isCapturing = false;

/* Hàm chờ */
function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/* Mở camera */
async function startCamera() {
  cameraMessage.style.display = "block";
  cameraMessage.textContent = "Đang mở camera...";
  camera.style.display = "none";
  retryButton.style.display = "none";

  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Trình duyệt không hỗ trợ camera");
    }

    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    camera.srcObject = cameraStream;
    await camera.play();

    camera.style.display = "block";
    cameraMessage.style.display = "none";
  } catch (error) {
    console.error(error);

    cameraMessage.style.display = "block";
    cameraMessage.textContent =
      "❌ Không thể mở camera. Hãy cấp quyền camera rồi bấm Thử lại.";

    retryButton.style.display = "block";
  }
}

/* Đếm ngược */
async function runCountdown() {
  const seconds = Number(countdownSelect.value);

  for (let number = seconds; number >= 1; number--) {
    countdownDisplay.textContent = number;
    await wait(1000);
  }

  countdownDisplay.textContent = "📸";
  await wait(300);
  countdownDisplay.textContent = "";
}

/* Chụp một ảnh */
function takeOnePhoto() {
  if (!camera.srcObject || camera.readyState < 2) {
    alert("Camera chưa sẵn sàng.");
    return false;
  }

  if (photos.length >= maxPhotos) {
    alert("Bạn đã chụp đủ ảnh.");
    return false;
  }

  const width = camera.videoWidth;
  const height = camera.videoHeight;

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  context.save();

  /* Áp dụng bộ lọc */
  context.filter = currentFilter;

  /* Lật ảnh giống hình xem trước camera */
  context.translate(width, 0);
  context.scale(-1, 1);

  context.drawImage(camera, 0, 0, width, height);
  context.restore();

  const photoData = canvas.toDataURL("image/png");

  photos.push(photoData);
  renderPhotos();

  return true;
}

/* Chụp tự động đủ số lượng ảnh */
async function autoCapture() {
  if (isCapturing) {
    return;
  }

  if (!camera.srcObject) {
    alert("Camera chưa được mở.");
    return;
  }

  if (photos.length >= maxPhotos) {
    alert("Bạn đã chụp đủ ảnh. Hãy bấm Chụp lại.");
    return;
  }

  isCapturing = true;
  setButtonsDisabled(true);

  try {
    while (photos.length < maxPhotos) {
      await runCountdown();
      takeOnePhoto();

      if (photos.length < maxPhotos) {
        await wait(800);
      }
    }
  } finally {
    isCapturing = false;
    setButtonsDisabled(false);
  }
}

/* Khóa nút khi đang chụp */
function setButtonsDisabled(disabled) {
  manualButton.disabled = disabled;
  captureButton.disabled = disabled;
  retakeButton.disabled = disabled;
  layoutSelect.disabled = disabled;
}

/* Hiển thị ảnh đã chụp */
function renderPhotos() {
  photoSlots.forEach((slot, index) => {
    const image = slot.querySelector("img");
    const text = slot.querySelector("span");

    if (index >= maxPhotos) {
      slot.style.display = "none";
      return;
    }

    slot.style.display = "flex";

    if (photos[index]) {
      image.src = photos[index];
      image.style.display = "block";
      text.style.display = "none";
    } else {
      image.removeAttribute("src");
      image.style.display = "none";
      text.style.display = "block";
      text.textContent = `Ảnh ${index + 1}`;
    }
  });

  photoCounter.textContent = `${photos.length}/${maxPhotos}`;
  downloadButton.disabled = photos.length !== maxPhotos;
}

/* Chụp lại ảnh cuối cùng */
function retakeLastPhoto() {
  if (photos.length === 0) {
    alert("Bạn chưa chụp ảnh nào.");
    return;
  }

  photos.pop();
  renderPhotos();
}

/* Đổi layout */
function changeLayout() {
  maxPhotos = Number(layoutSelect.value);
  photos = [];
  renderPhotos();
}

/* Đổi bộ lọc */
filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => {
      item.classList.remove("active");
    });

    button.classList.add("active");
    currentFilter = button.dataset.filter;
    camera.style.filter = currentFilter;
  });
});

/* Tải hình ảnh vào canvas ghép */
function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

/* Vẽ ảnh vừa khung, không bị méo */
function drawCover(context, image, x, y, width, height) {
  const imageRatio = image.width / image.height;
  const boxRatio = width / height;

  let sourceWidth;
  let sourceHeight;
  let sourceX;
  let sourceY;

  if (imageRatio > boxRatio) {
    sourceHeight = image.height;
    sourceWidth = image.height * boxRatio;
    sourceX = (image.width - sourceWidth) / 2;
    sourceY = 0;
  } else {
    sourceWidth = image.width;
    sourceHeight = image.width / boxRatio;
    sourceX = 0;
    sourceY = (image.height - sourceHeight) / 2;
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height
  );
}

/* Tải ảnh hoàn chỉnh */
async function downloadPhotos() {
  if (photos.length !== maxPhotos) {
    alert("Bạn cần chụp đủ ảnh trước.");
    return;
  }

  if (maxPhotos === 1) {
    const link = document.createElement("a");
    link.href = photos[0];
    link.download = "photoxinhh.png";
    link.click();
    return;
  }

  const outputCanvas = document.createElement("canvas");
  const context = outputCanvas.getContext("2d");

  const outputWidth = 1200;
  const padding = 60;
  const gap = 30;
  const photoWidth = outputWidth - padding * 2;
  const photoHeight = 720;
  const footerHeight = 130;

  outputCanvas.width = outputWidth;
  outputCanvas.height =
    padding * 2 +
    photoHeight * maxPhotos +
    gap * (maxPhotos - 1) +
    footerHeight;

  /* Nền photobooth */
  context.fillStyle = "#fff7fa";
  context.fillRect(0, 0, outputCanvas.width, outputCanvas.height);

  for (let index = 0; index < photos.length; index++) {
    const image = await loadImage(photos[index]);

    const x = padding;
    const y = padding + index * (photoHeight + gap);

    drawCover(context, image, x, y, photoWidth, photoHeight);
  }

  /* Chữ cuối ảnh */
  context.fillStyle = "#ff75a4";
  context.font = "bold 48px Arial";
  context.textAlign = "center";
  context.fillText(
    "PhotoXinhh",
    outputCanvas.width / 2,
    outputCanvas.height - 55
  );

  const link = document.createElement("a");
  link.href = outputCanvas.toDataURL("image/png");
  link.download = "photoxinhh-1x4.png";
  link.click();
}

/* Gắn chức năng cho các nút */
retryButton.addEventListener("click", startCamera);

manualButton.addEventListener("click", () => {
  takeOnePhoto();
});

captureButton.addEventListener("click", autoCapture);
retakeButton.addEventListener("click", retakeLastPhoto);
layoutSelect.addEventListener("change", changeLayout);
downloadButton.addEventListener("click", downloadPhotos);

frameButton.addEventListener("click", () => {
  alert("Phần chọn khung sẽ được làm ở bước tiếp theo.");
});

/* Tắt camera khi đóng trang */
window.addEventListener("beforeunload", () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
  }
});

/* Khởi động */
renderPhotos();
startCamera();
