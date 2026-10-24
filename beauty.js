"use strict";

/*
 * NoHa · Làm đẹp tự động "Đẹp tự nhiên"
 *
 * - Nhận diện khuôn mặt bằng MediaPipe Face Landmarker chạy ngay trên thiết bị
 *   (WASM + WebGL). Ảnh không được gửi lên bất kỳ máy chủ nào; chỉ thư viện và
 *   file mô hình được tải về một lần rồi trình duyệt lưu cache.
 * - Từ 478 điểm mốc của mỗi khuôn mặt, vẽ mặt nạ theo vùng:
 *     R = vùng da (trừ mắt, lông mày, môi), G = môi, B = má hồng.
 * - Shader WebGL chỉ xử lý trong mặt nạ: làm mịn giữ biên (bilateral),
 *   nâng sáng nhẹ giữ sắc độ, tô môi và má bằng soft-light. Phần ngoài
 *   khuôn mặt, mắt, tóc, lông mày giữ nguyên điểm ảnh gốc.
 * - Không bóp mặt, không to mắt: hình học khuôn mặt không bị thay đổi.
 */
window.NohaBeauty = (() => {
  const MEDIAPIPE_VERSION = "0.10.35";

  const MEDIAPIPE_URL =
    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;

  const MODEL_URL = new URL(
    "assets/models/face_landmarker.task",
    document.baseURI
  ).href;

  const STORAGE_KEY = "noha.beauty.enabled";
  const MAX_FACES = 6;
  const LIVE_MAX_SIDE = 960;
  const MASK_MAX_SIDE = 448;

  // Thiết bị quá chậm: mỗi khung làm đẹp tốn hơn ~130 ms (dưới ~7 fps)
  const SLOW_FRAME_COST_MS = 130;

  /*
   * Mức hiệu ứng "Đẹp tự nhiên", chọn sau khi so sánh trước/sau trên ảnh
   * chân dung da sáng, da tối và ảnh ghép hai người. Làm mịn đặt dưới mức
   * xóa hết lỗ chân lông; má hồng 0.22 gần như không thấy nên tăng lên 0.5.
   * Cần thử thêm với camera điện thoại thật và ánh sáng yếu.
   */
  const LOOK = {
    smooth: 0.6,
    rangeSigma: 0.075,
    radiusScale: 0.022,
    brighten: 0.07,
    lip: 0.42,
    lipColor: [0.86, 0.3, 0.4],
    blush: 0.5,
    blushColor: [0.98, 0.42, 0.5]
  };

  // Chỉ số điểm mốc theo MediaPipe Face Mesh
  const FACE_OVAL = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
  ];

  const LEFT_EYE = [
    362, 382, 381, 380, 374, 373, 390, 249,
    263, 466, 388, 387, 386, 385, 384, 398
  ];

  const RIGHT_EYE = [
    33, 7, 163, 144, 145, 153, 154, 155,
    133, 173, 157, 158, 159, 160, 161, 246
  ];

  const LEFT_BROW = [336, 296, 334, 293, 300, 276, 283, 282, 295, 285];
  const RIGHT_BROW = [107, 66, 105, 63, 70, 46, 53, 52, 65, 55];

  const LIPS_OUTER = [
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375,
    291, 409, 270, 269, 267, 0, 37, 39, 40, 185
  ];

  const LIPS_INNER = [
    78, 95, 88, 178, 87, 14, 317, 402, 318, 324,
    308, 415, 310, 311, 312, 13, 82, 81, 80, 191
  ];

  // Mỗi má lấy trung điểm của hai điểm mốc dưới gò má
  const CHEEKS = [
    [50, 205],
    [280, 425]
  ];

  const TAP_COUNT = 24;

  const VERTEX_SHADER = `
    attribute vec2 a_position;
    varying vec2 v_uv;

    void main() {
      // Lật dọc ngay trong shader thay vì UNPACK_FLIP_Y_WEBGL,
      // vì một số trình duyệt di động bỏ qua cờ này với video
      v_uv = vec2(a_position.x * 0.5 + 0.5, 0.5 - a_position.y * 0.5);
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const FRAGMENT_SHADER = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif

    #define TAP_COUNT ${TAP_COUNT}

    varying vec2 v_uv;

    uniform sampler2D u_image;
    uniform sampler2D u_mask;
    uniform vec2 u_texel;
    uniform vec2 u_maskTexel;
    uniform float u_radius;
    uniform float u_feather;
    uniform float u_smooth;
    uniform float u_sigma;
    uniform float u_brighten;
    uniform float u_lip;
    uniform float u_blush;
    uniform vec3 u_lipColor;
    uniform vec3 u_blushColor;
    uniform vec3 u_taps[TAP_COUNT];

    vec3 featheredMask(vec2 uv) {
      vec2 d = u_maskTexel * u_feather;
      vec3 m = texture2D(u_mask, uv).rgb * 0.2;

      m += texture2D(u_mask, uv + vec2(d.x, 0.0)).rgb * 0.1;
      m += texture2D(u_mask, uv - vec2(d.x, 0.0)).rgb * 0.1;
      m += texture2D(u_mask, uv + vec2(0.0, d.y)).rgb * 0.1;
      m += texture2D(u_mask, uv - vec2(0.0, d.y)).rgb * 0.1;
      m += texture2D(u_mask, uv + d).rgb * 0.1;
      m += texture2D(u_mask, uv - d).rgb * 0.1;
      m += texture2D(u_mask, uv + vec2(d.x, -d.y)).rgb * 0.1;
      m += texture2D(u_mask, uv + vec2(-d.x, d.y)).rgb * 0.1;

      return m;
    }

    // Loại tóc, tròng mắt, kính, râu... còn sót trong vùng mặt theo sắc độ YCbCr
    float skinLikelihood(vec3 c) {
      float y = dot(c, vec3(0.299, 0.587, 0.114));
      float cb = 0.5 - 0.168736 * c.r - 0.331264 * c.g + 0.5 * c.b;
      float cr = 0.5 + 0.5 * c.r - 0.418688 * c.g - 0.081312 * c.b;

      float crOk =
        smoothstep(0.505, 0.535, cr) *
        (1.0 - smoothstep(0.69, 0.73, cr));

      float cbOk =
        smoothstep(0.26, 0.30, cb) *
        (1.0 - smoothstep(0.51, 0.55, cb));

      float lumOk = smoothstep(0.05, 0.14, y);

      return crOk * cbOk * lumOk;
    }

    vec3 edgePreservingSmooth(vec2 uv, vec3 center) {
      vec3 sum = center;
      float weightSum = 1.0;
      float rangeScale = -0.5 / (u_sigma * u_sigma);

      for (int i = 0; i < TAP_COUNT; i++) {
        vec3 tap = u_taps[i];
        vec3 color = texture2D(
          u_image,
          uv + tap.xy * u_radius * u_texel
        ).rgb;

        vec3 diff = color - center;
        float weight = tap.z * exp(dot(diff, diff) * rangeScale);

        sum += color * weight;
        weightSum += weight;
      }

      return sum / weightSum;
    }

    vec3 softLight(vec3 base, vec3 blend) {
      vec3 dark = 2.0 * base * blend + base * base * (1.0 - 2.0 * blend);
      vec3 light = sqrt(base) * (2.0 * blend - 1.0) + 2.0 * base * (1.0 - blend);

      return mix(dark, light, step(0.5, blend));
    }

    void main() {
      vec3 original = texture2D(u_image, v_uv).rgb;
      vec3 mask = featheredMask(v_uv);
      vec3 color = original;

      float skin = mask.r * skinLikelihood(original);

      if (skin > 0.004) {
        vec3 smoothed = edgePreservingSmooth(v_uv, original);
        color = mix(original, smoothed, skin * u_smooth);

        // Nâng sáng: nửa nhân (giữ sắc), nửa cộng đều (tránh da ngả cam)
        float luma = dot(color, vec3(0.299, 0.587, 0.114));
        float lifted = luma + (1.0 - luma) * u_brighten * skin;
        vec3 scaled = color * (lifted / max(luma, 0.002));
        vec3 shifted = color + (lifted - luma);
        color = clamp(mix(scaled, shifted, 0.5), 0.0, 1.0);
      }

      if (mask.g > 0.004) {
        color = mix(color, softLight(color, u_lipColor), mask.g * u_lip);
      }

      float blush = mask.b * mask.r;

      if (blush > 0.004) {
        color = mix(color, softLight(color, u_blushColor), blush * u_blush);
      }

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `;

  let state = "idle";
  let enabled = readPreference();
  let autoDisabled = false;
  let landmarker = null;
  let loadPromise = null;
  let lastTimestamp = 0;
  let imageModeBusy = false;
  let exclusiveQueue = Promise.resolve();
  let liveRenderer = null;
  let stillRenderer = null;

  const listeners = new Set();

  const live = {
    video: null,
    stage: null,
    rafId: 0,
    faces: [],
    lastDetectAt: 0,
    detectInterval: 0,
    avgDetect: 0,
    avgCost: 0,
    measuredFrames: 0,
    measurePausedUntil: 0,
    visible: false
  };

  function readPreference() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === null ? true : saved === "1";
    } catch {
      return true;
    }
  }

  function savePreference(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      // Trình duyệt chặn bộ nhớ: chỉ không nhớ lựa chọn
    }
  }

  function getStatus() {
    return {
      state,
      enabled,
      autoDisabled,
      active: isActive()
    };
  }

  function emit(reason) {
    const status = getStatus();

    listeners.forEach(listener => {
      try {
        listener(status, reason);
      } catch (error) {
        console.warn(error);
      }
    });
  }

  function onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function isActive() {
    return (
      enabled &&
      !autoDisabled &&
      state === "ready" &&
      Boolean(landmarker)
    );
  }

  function hasWebGL() {
    try {
      const canvas = document.createElement("canvas");
      return Boolean(
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl")
      );
    } catch {
      return false;
    }
  }

  function nextTimestamp() {
    lastTimestamp = Math.max(
      performance.now(),
      lastTimestamp + 1
    );

    return lastTimestamp;
  }

  function fitSize(width, height, maxSide) {
    const scale = Math.min(1, maxSide / Math.max(width, height));

    return {
      width: Math.max(2, Math.round(width * scale)),
      height: Math.max(2, Math.round(height * scale))
    };
  }

  function sourceSize(source) {
    return {
      width:
        source.videoWidth ||
        source.naturalWidth ||
        source.width,
      height:
        source.videoHeight ||
        source.naturalHeight ||
        source.height
    };
  }

  function median(values) {
    if (!values.length) {
      return 0;
    }

    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  function buildTaps() {
    // 3 vòng × 8 điểm, xoay lệch nhau để phủ đều; trọng số không gian Gauss
    const taps = new Float32Array(TAP_COUNT * 3);
    const rings = [0.34, 0.67, 1];

    rings.forEach((distance, ring) => {
      for (let i = 0; i < 8; i++) {
        const angle =
          (i / 8) * Math.PI * 2 +
          ring * (Math.PI / 8);

        const offset = (ring * 8 + i) * 3;

        taps[offset] = Math.cos(angle) * distance;
        taps[offset + 1] = Math.sin(angle) * distance;
        taps[offset + 2] = Math.exp(
          -(distance * distance) / (2 * 0.55 * 0.55)
        );
      }
    });

    return taps;
  }

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader lỗi: ${message}`);
    }

    return shader;
  }

  function createTexture(gl) {
    const texture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    return texture;
  }

  function tracePath(context, landmarks, indices, width, height) {
    context.beginPath();

    indices.forEach((landmarkIndex, order) => {
      const point = landmarks[landmarkIndex];
      const x = point.x * width;
      const y = point.y * height;

      if (order === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });

    context.closePath();
  }

  function createRenderer() {
    const canvas = document.createElement("canvas");

    const contextOptions = {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true
    };

    const gl =
      canvas.getContext("webgl", contextOptions) ||
      canvas.getContext("experimental-webgl", contextOptions);

    if (!gl) {
      return null;
    }

    const program = gl.createProgram();

    gl.attachShader(
      program,
      compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
    );

    gl.attachShader(
      program,
      compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    );

    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }

    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const positionLocation =
      gl.getAttribLocation(program, "a_position");

    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const uniform = name => gl.getUniformLocation(program, name);

    const locations = {
      image: uniform("u_image"),
      mask: uniform("u_mask"),
      texel: uniform("u_texel"),
      maskTexel: uniform("u_maskTexel"),
      radius: uniform("u_radius"),
      feather: uniform("u_feather"),
      smooth: uniform("u_smooth"),
      sigma: uniform("u_sigma"),
      brighten: uniform("u_brighten"),
      lip: uniform("u_lip"),
      blush: uniform("u_blush"),
      lipColor: uniform("u_lipColor"),
      blushColor: uniform("u_blushColor"),
      taps: uniform("u_taps[0]")
    };

    gl.uniform1i(locations.image, 0);
    gl.uniform1i(locations.mask, 1);
    gl.uniform3fv(locations.taps, buildTaps());
    gl.uniform1f(locations.smooth, LOOK.smooth);
    gl.uniform1f(locations.sigma, LOOK.rangeSigma);
    gl.uniform1f(locations.brighten, LOOK.brighten);
    gl.uniform1f(locations.lip, LOOK.lip);
    gl.uniform1f(locations.blush, LOOK.blush);
    gl.uniform3fv(locations.lipColor, LOOK.lipColor);
    gl.uniform3fv(locations.blushColor, LOOK.blushColor);

    const imageTexture = createTexture(gl);
    const maskTexture = createTexture(gl);

    const maskCanvas = document.createElement("canvas");
    const maskContext = maskCanvas.getContext("2d");

    canvas.addEventListener("webglcontextlost", event => {
      event.preventDefault();
      handleFailure(new Error("Mất ngữ cảnh WebGL"));
    });

    function drawMask(faces, srcWidth, srcHeight) {
      const scale = Math.min(
        1,
        MASK_MAX_SIDE / Math.max(srcWidth, srcHeight)
      );

      const width = Math.max(2, Math.round(srcWidth * scale));
      const height = Math.max(2, Math.round(srcHeight * scale));

      if (maskCanvas.width !== width || maskCanvas.height !== height) {
        maskCanvas.width = width;
        maskCanvas.height = height;
      }

      const ctx = maskContext;
      const valid = faces.filter(face => face?.length >= 468);

      const faceWidths = valid.map(face =>
        Math.hypot(
          (face[454].x - face[234].x) * width,
          (face[454].y - face[234].y) * height
        )
      );

      ctx.globalCompositeOperation = "source-over";
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);

      // Lượt 1: toàn bộ khuôn mặt là vùng da
      ctx.fillStyle = "rgb(255,0,0)";

      valid.forEach(face => {
        tracePath(ctx, face, FACE_OVAL, width, height);
        ctx.fill();
      });

      // Lượt 2: khoét mắt, lông mày, miệng (nới rộng để giữ nguyên mi và viền)
      valid.forEach((face, index) => {
        const faceWidth = faceWidths[index];

        ctx.fillStyle = "#000";
        ctx.strokeStyle = "#000";

        ctx.lineWidth = faceWidth * 0.05;

        [LEFT_EYE, RIGHT_EYE].forEach(indices => {
          tracePath(ctx, face, indices, width, height);
          ctx.fill();
          ctx.stroke();
        });

        ctx.lineWidth = faceWidth * 0.035;

        [LEFT_BROW, RIGHT_BROW].forEach(indices => {
          tracePath(ctx, face, indices, width, height);
          ctx.fill();
          ctx.stroke();
        });

        ctx.lineWidth = faceWidth * 0.02;
        tracePath(ctx, face, LIPS_OUTER, width, height);
        ctx.fill();
        ctx.stroke();

        // Môi: vành ngoài trừ khe miệng (không tô lên răng)
        ctx.fillStyle = "rgb(0,255,0)";
        tracePath(ctx, face, LIPS_OUTER, width, height);
        ctx.fill();

        ctx.fillStyle = "#000";
        ctx.lineWidth = faceWidth * 0.01;
        tracePath(ctx, face, LIPS_INNER, width, height);
        ctx.fill();
        ctx.stroke();
      });

      // Lượt 3: má hồng tỏa mềm ở gò má
      ctx.globalCompositeOperation = "lighter";

      valid.forEach((face, index) => {
        const radius = faceWidths[index] * 0.14;

        CHEEKS.forEach(([a, b]) => {
          const x = ((face[a].x + face[b].x) / 2) * width;
          const y = ((face[a].y + face[b].y) / 2) * height;

          const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
          gradient.addColorStop(0, "rgba(0,0,255,1)");
          gradient.addColorStop(0.55, "rgba(0,0,255,0.5)");
          gradient.addColorStop(1, "rgba(0,0,255,0)");

          ctx.fillStyle = gradient;
          ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        });
      });

      ctx.globalCompositeOperation = "source-over";

      const typicalFaceWidth = median(faceWidths);

      return {
        width,
        height,
        radius: Math.min(
          16,
          Math.max(1.5, (typicalFaceWidth / scale) * LOOK.radiusScale)
        ),
        feather: Math.min(5, Math.max(1, typicalFaceWidth * 0.03))
      };
    }

    function render(source, width, height, faces) {
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const size = sourceSize(source);
      const mask = drawMask(faces, size.width, size.height);

      gl.viewport(0, 0, width, height);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imageTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, maskTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskCanvas);

      gl.uniform2f(locations.texel, 1 / size.width, 1 / size.height);
      gl.uniform2f(locations.maskTexel, 1 / mask.width, 1 / mask.height);
      gl.uniform1f(locations.radius, mask.radius);
      gl.uniform1f(locations.feather, mask.feather);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      return canvas;
    }

    return {
      canvas,
      render
    };
  }

  async function createLandmarker(vision, fileset, delegate) {
    return vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate
      },
      runningMode: "VIDEO",
      numFaces: MAX_FACES,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false
    });
  }

  function load() {
    if (loadPromise) {
      return loadPromise;
    }

    if (!hasWebGL()) {
      state = "unsupported";
      emit("unsupported");
      return Promise.resolve(false);
    }

    state = "loading";
    emit("loading");

    loadPromise = (async () => {
      const vision = await import(`${MEDIAPIPE_URL}/vision_bundle.mjs`);

      const fileset =
        await vision.FilesetResolver.forVisionTasks(`${MEDIAPIPE_URL}/wasm`);

      try {
        landmarker = await createLandmarker(vision, fileset, "GPU");
      } catch (gpuError) {
        console.warn("Face Landmarker GPU lỗi, chuyển sang CPU:", gpuError);
        landmarker = await createLandmarker(vision, fileset, "CPU");
      }

      liveRenderer = createRenderer();
      stillRenderer = createRenderer();

      if (!liveRenderer || !stillRenderer) {
        throw new Error("WebGL không khả dụng");
      }

      liveRenderer.canvas.className = "beauty-canvas";
      liveRenderer.canvas.setAttribute("aria-hidden", "true");

      state = "ready";
      emit("ready");
      syncLiveLoop();

      return true;
    })().catch(error => {
      console.warn("Không tải được chế độ làm đẹp:", error);

      landmarker = null;
      state = hasWebGL() ? "error" : "unsupported";
      emit("error");

      return false;
    });

    return loadPromise;
  }

  function handleFailure(error) {
    console.warn("Tắt làm đẹp do lỗi:", error);

    autoDisabled = true;
    stopLoop();
    emit("error");
  }

  function setLiveCanvasVisible(visible) {
    const canvas = liveRenderer?.canvas;

    if (!canvas) {
      return;
    }

    if (visible && live.stage && canvas.parentNode !== live.stage) {
      live.video.insertAdjacentElement("afterend", canvas);
    }

    canvas.classList.toggle(
      "mirror-preview",
      Boolean(live.video?.classList.contains("mirror-preview"))
    );

    canvas.hidden = !visible;
    live.visible = visible;
  }

  function isElementShown(element) {
    return Boolean(
      element?.isConnected &&
      element.getClientRects().length
    );
  }

  function liveTick(now) {
    live.rafId = requestAnimationFrame(liveTick);

    const video = live.video;

    if (
      !video ||
      video.readyState < 2 ||
      !video.videoWidth ||
      !isElementShown(live.stage)
    ) {
      return;
    }

    const frameStarted = performance.now();

    try {
      if (
        !imageModeBusy &&
        now - live.lastDetectAt >= live.detectInterval
      ) {
        const started = performance.now();
        const result = landmarker.detectForVideo(video, nextTimestamp());
        const cost = performance.now() - started;

        live.faces = result?.faceLandmarks || [];
        live.lastDetectAt = now;
        live.avgDetect = live.avgDetect
          ? live.avgDetect * 0.9 + cost * 0.1
          : cost;

        // Máy yếu: nhận diện thưa hơn, vẫn vẽ mỗi khung với điểm mốc gần nhất
        live.detectInterval =
          live.avgDetect > 40 ? live.avgDetect * 1.5 : 0;
      }

      const size = fitSize(video.videoWidth, video.videoHeight, LIVE_MAX_SIDE);

      liveRenderer.render(video, size.width, size.height, live.faces);
      setLiveCanvasVisible(true);
    } catch (error) {
      handleFailure(error);
      return;
    }

    /*
     * Chỉ đo thời gian của chính bước làm đẹp (không tính lúc chụp, ghép
     * khung...) và chỉ trong vài giây đầu. Sau đó không tự tắt nữa để màn
     * hình camera không đổi đột ngột khi đang chụp.
     */
    if (frameStarted >= live.measurePausedUntil) {
      const cost = performance.now() - frameStarted;

      live.avgCost = live.avgCost
        ? live.avgCost * 0.9 + cost * 0.1
        : cost;

      live.measuredFrames++;
    }

    if (
      live.measuredFrames > 30 &&
      live.measuredFrames < 120 &&
      live.avgCost > SLOW_FRAME_COST_MS
    ) {
      autoDisabled = true;
      stopLoop();
      emit("slow");
    }
  }

  function startLoop() {
    if (live.rafId) {
      return;
    }

    live.avgCost = 0;
    live.measuredFrames = 0;
    live.rafId = requestAnimationFrame(liveTick);
  }

  function stopLoop() {
    cancelAnimationFrame(live.rafId);
    live.rafId = 0;
    live.faces = [];
    setLiveCanvasVisible(false);
  }

  function syncLiveLoop() {
    if (isActive() && live.video) {
      startLoop();
    } else {
      stopLoop();
    }
  }

  /* Gắn video camera để hiển thị hiệu ứng trực tiếp */
  function attachLive(video, stage) {
    live.video = video;
    live.stage = stage;

    if (enabled && !autoDisabled) {
      load();
    }

    syncLiveLoop();
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    autoDisabled = false;
    savePreference(enabled);

    if (enabled && state === "error") {
      loadPromise = null;
    }

    if (enabled && (live.video || state === "ready")) {
      load();
    }

    syncLiveLoop();
    emit("toggle");
  }

  /*
   * Làm đẹp đúng khung hình hiện tại của camera (nhận diện lại ngay lúc chụp).
   * Trả về canvas đã xử lý, hoặc null để nơi gọi dùng ảnh gốc.
   */
  function renderVideoFrame(video, maxSide = 1280) {
    if (!isActive() || imageModeBusy || !video?.videoWidth) {
      return null;
    }

    // Lúc chụp máy bận hơn bình thường: không tính vào đo tốc độ
    live.measurePausedUntil = performance.now() + 1500;

    try {
      const result = landmarker.detectForVideo(video, nextTimestamp());
      const size = fitSize(video.videoWidth, video.videoHeight, maxSide);

      return stillRenderer.render(
        video,
        size.width,
        size.height,
        result?.faceLandmarks || []
      );
    } catch (error) {
      console.warn("Không làm đẹp được khung hình:", error);
      return null;
    }
  }

  function runExclusive(task) {
    const run = exclusiveQueue.then(task, task);
    exclusiveQueue = run.catch(() => {});
    return run;
  }

  /* Làm đẹp ảnh tải lên từ thiết bị. Trả về canvas mới hoặc null. */
  async function processImage(image, maxSide = 1600) {
    if (!enabled || autoDisabled) {
      return null;
    }

    const loaded = await load();

    if (!loaded || !isActive()) {
      return null;
    }

    return runExclusive(async () => {
      const size = sourceSize(image);
      const target = fitSize(size.width, size.height, maxSide);

      // Vẽ qua canvas 2D để ảnh đúng chiều xoay EXIF trước khi nhận diện
      const source = document.createElement("canvas");
      source.width = target.width;
      source.height = target.height;
      source.getContext("2d").drawImage(image, 0, 0, target.width, target.height);

      imageModeBusy = true;

      try {
        await landmarker.setOptions({ runningMode: "IMAGE" });

        const result = landmarker.detect(source);

        stillRenderer.render(
          source,
          target.width,
          target.height,
          result?.faceLandmarks || []
        );

        const output = document.createElement("canvas");
        output.width = target.width;
        output.height = target.height;
        output.getContext("2d").drawImage(stillRenderer.canvas, 0, 0);

        return output;
      } catch (error) {
        console.warn("Không làm đẹp được ảnh tải lên:", error);
        return null;
      } finally {
        try {
          await landmarker.setOptions({ runningMode: "VIDEO" });
        } catch (error) {
          handleFailure(error);
        }

        live.lastDetectAt = 0;
        imageModeBusy = false;
      }
    });
  }

  return {
    attachLive,
    setEnabled,
    load,
    onChange,
    getStatus,
    isActive,
    renderVideoFrame,
    processImage,

    get liveCanvas() {
      return live.visible ? liveRenderer?.canvas || null : null;
    }
  };
})();
