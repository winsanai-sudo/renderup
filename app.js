const canvas = document.querySelector("#graphCanvas");
const ctx = canvas.getContext("2d");

const els = {
  expression: document.querySelector("#expression"),
  applyExpression: document.querySelector("#applyExpression"),
  parseStatus: document.querySelector("#parseStatus"),
  recordButton: document.querySelector("#recordButton"),
  recordButtonText: document.querySelector("#recordButtonText"),
  recordMode: document.querySelector("#recordMode"),
  recordTime: document.querySelector("#recordTime"),
  resetView: document.querySelector("#resetView"),
  aSlider: document.querySelector("#aSlider"),
  bSlider: document.querySelector("#bSlider"),
  cSlider: document.querySelector("#cSlider"),
  aValue: document.querySelector("#aValue"),
  bValue: document.querySelector("#bValue"),
  cValue: document.querySelector("#cValue"),
  vertexInfo: document.querySelector("#vertexInfo"),
  axisInfo: document.querySelector("#axisInfo"),
  interceptInfo: document.querySelector("#interceptInfo"),
  xInterceptInfo: document.querySelector("#xInterceptInfo"),
  probePoint: document.querySelector("#probePoint"),
  showRoots: document.querySelector("#showRoots"),
  showGuides: document.querySelector("#showGuides"),
  basicResult: document.querySelector("#basicResult"),
  x1Input: document.querySelector("#x1Input"),
  x2Input: document.querySelector("#x2Input"),
  ratioResult: document.querySelector("#ratioResult"),
  tangentX: document.querySelector("#tangentX"),
  useProbeForTangent: document.querySelector("#useProbeForTangent"),
  tangentResult: document.querySelector("#tangentResult"),
  integralFrom: document.querySelector("#integralFrom"),
  integralTo: document.querySelector("#integralTo"),
  integralResult: document.querySelector("#integralResult"),
  tabs: [...document.querySelectorAll(".tab")],
  toolCards: [...document.querySelectorAll(".tool-card")],
};

const colors = {
  bg: "#02040a",
  grid: "rgba(148, 163, 184, 0.13)",
  gridMajor: "rgba(148, 163, 184, 0.22)",
  axis: "rgba(238, 245, 255, 0.55)",
  graph: "#35a6ff",
  graphGlow: "rgba(53, 166, 255, 0.28)",
  yellow: "#ffe066",
  red: "#ff4d6d",
  orange: "#ff9f1c",
  purple: "#b892ff",
  green: "#6ee7b7",
  guide: "rgba(238, 245, 255, 0.42)",
  text: "#eef5ff",
  muted: "#9fafc7",
};

const state = {
  exprText: "a*x^2 + b*x + c",
  compiled: null,
  a: 1,
  b: 0,
  c: 0,
  probeX: 1,
  activeTool: "basic",
  showRoots: true,
  showGuides: true,
  view: { xMin: -6, xMax: 6, yMin: -6, yMax: 12 },
  trace: [],
  dragging: false,
  recording: null,
};

let resizeRaf = 0;
let drawRaf = 0;

function boot() {
  compileExpression(true);
  bindEvents();
  resizeCanvas();
  updateAll();
}

function bindEvents() {
  els.applyExpression.addEventListener("click", () => {
    compileExpression(false);
    updateAll();
  });

  els.expression.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      compileExpression(false);
      updateAll();
    }
  });

  [els.aSlider, els.bSlider, els.cSlider].forEach((slider) => {
    slider.addEventListener("input", () => {
      readSliders();
      addTracePoint();
      updateAll();
    });
  });

  [els.showRoots, els.showGuides].forEach((input) => {
    input.addEventListener("change", () => {
      state.showRoots = els.showRoots.checked;
      state.showGuides = els.showGuides.checked;
      updateAll();
    });
  });

  [els.x1Input, els.x2Input, els.tangentX, els.integralFrom, els.integralTo].forEach((input) => {
    input.addEventListener("input", updateAll);
  });

  els.useProbeForTangent.addEventListener("click", () => {
    els.tangentX.value = formatNumber(state.probeX, 3);
    activateTool("tangent");
    updateAll();
  });

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activateTool(tab.dataset.tool);
      updateAll();
    });
  });

  els.resetView.addEventListener("click", () => {
    state.view = { xMin: -6, xMax: 6, yMin: -6, yMax: 12 };
    state.trace = [];
    updateAll();
  });

  els.recordButton.addEventListener("click", () => {
    if (state.recording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  canvas.addEventListener("pointerdown", (event) => {
    state.dragging = true;
    canvas.setPointerCapture(event.pointerId);
    setProbeFromPointer(event);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.dragging) return;
    setProbeFromPointer(event);
  });

  canvas.addEventListener("pointerup", (event) => {
    state.dragging = false;
    canvas.releasePointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointercancel", () => {
    state.dragging = false;
  });

  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      resizeCanvas();
      updateAll();
    });
  });
}

function activateTool(tool) {
  state.activeTool = tool;
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tool === tool));
  els.toolCards.forEach((card) => card.classList.toggle("active", card.id === `tool-${tool}`));
}

function readSliders() {
  state.a = Number(els.aSlider.value);
  state.b = Number(els.bSlider.value);
  state.c = Number(els.cSlider.value);
  els.aValue.textContent = formatNumber(state.a, 2);
  els.bValue.textContent = formatNumber(state.b, 2);
  els.cValue.textContent = formatNumber(state.c, 2);
}

function compileExpression(initial) {
  const text = els.expression.value.trim() || "a*x^2 + b*x + c";
  try {
    state.compiled = math.compile(text);
    state.exprText = text;
    els.parseStatus.textContent = initial ? "f(x) = a*x^2 + b*x + c" : `f(x) = ${text}`;
    els.parseStatus.classList.remove("error");
  } catch (error) {
    els.parseStatus.textContent = `식 오류: ${error.message}`;
    els.parseStatus.classList.add("error");
  }
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function updateAll() {
  readSliders();
  updateViewToFunction();
  updateInfo();
  updateToolText();
  scheduleDraw();
}

function scheduleDraw() {
  cancelAnimationFrame(drawRaf);
  drawRaf = requestAnimationFrame(draw);
}

function scope(x) {
  return {
    x,
    a: state.a,
    b: state.b,
    c: state.c,
    pi: Math.PI,
    e: Math.E,
  };
}

function f(x) {
  if (!state.compiled) return NaN;
  try {
    const value = state.compiled.evaluate(scope(x));
    if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
    if (value && typeof value.valueOf === "function") {
      const primitive = value.valueOf();
      return typeof primitive === "number" && Number.isFinite(primitive) ? primitive : NaN;
    }
  } catch {
    return NaN;
  }
  return NaN;
}

function derivative(x) {
  const h = 1e-4 * Math.max(1, Math.abs(x));
  const y1 = f(x + h);
  const y0 = f(x - h);
  if (!Number.isFinite(y1) || !Number.isFinite(y0)) return NaN;
  return (y1 - y0) / (2 * h);
}

function integral(a, b, steps = 600) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return 0;
  const n = Math.max(2, steps + (steps % 2));
  const from = Math.min(a, b);
  const to = Math.max(a, b);
  const h = (to - from) / n;
  let sum = f(from) + f(to);
  if (!Number.isFinite(sum)) return NaN;
  for (let i = 1; i < n; i += 1) {
    const y = f(from + h * i);
    if (!Number.isFinite(y)) return NaN;
    sum += y * (i % 2 === 0 ? 2 : 4);
  }
  const signed = (sum * h) / 3;
  return a <= b ? signed : -signed;
}

function fitQuadratic() {
  const ym = f(-1);
  const y0 = f(0);
  const yp = f(1);
  if (![ym, y0, yp].every(Number.isFinite)) return null;

  const A = (yp + ym - 2 * y0) / 2;
  const B = (yp - ym) / 2;
  const C = y0;
  const tests = [-4, -2, 2, 4];
  const ok = tests.every((x) => {
    const actual = f(x);
    const expected = A * x * x + B * x + C;
    const tolerance = 1e-4 * Math.max(1, Math.abs(actual), Math.abs(expected));
    return Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance;
  });

  return ok ? { A, B, C } : null;
}

function getRoots() {
  const fit = fitQuadratic();
  if (fit) {
    const { A, B, C } = fit;
    if (Math.abs(A) < 1e-9) {
      if (Math.abs(B) < 1e-9) return [];
      return [{ x: -C / B, y: 0 }];
    }
    const d = B * B - 4 * A * C;
    if (d < -1e-9) return [];
    if (Math.abs(d) <= 1e-9) return [{ x: -B / (2 * A), y: 0 }];
    const rootD = Math.sqrt(d);
    return [
      { x: (-B - rootD) / (2 * A), y: 0 },
      { x: (-B + rootD) / (2 * A), y: 0 },
    ].sort((p, q) => p.x - q.x);
  }

  return scanRoots(state.view.xMin, state.view.xMax, 900);
}

function scanRoots(xMin, xMax, count) {
  const roots = [];
  let lastX = xMin;
  let lastY = f(lastX);
  for (let i = 1; i <= count; i += 1) {
    const x = xMin + ((xMax - xMin) * i) / count;
    const y = f(x);
    if (Number.isFinite(lastY) && Number.isFinite(y)) {
      if (Math.abs(y) < 1e-5) {
        pushUniqueRoot(roots, x);
      } else if (lastY * y < 0) {
        pushUniqueRoot(roots, bisectRoot(lastX, x));
      }
    }
    lastX = x;
    lastY = y;
  }
  return roots.map((x) => ({ x, y: 0 }));
}

function bisectRoot(left, right) {
  let lo = left;
  let hi = right;
  let yLo = f(lo);
  for (let i = 0; i < 38; i += 1) {
    const mid = (lo + hi) / 2;
    const yMid = f(mid);
    if (!Number.isFinite(yMid)) break;
    if (Math.abs(yMid) < 1e-8) return mid;
    if (yLo * yMid <= 0) {
      hi = mid;
    } else {
      lo = mid;
      yLo = yMid;
    }
  }
  return (lo + hi) / 2;
}

function pushUniqueRoot(roots, x) {
  if (!roots.some((root) => Math.abs(root - x) < 0.025)) roots.push(x);
}

function getSpecialPoints() {
  const fit = fitQuadratic();
  const yIntercept = f(0);
  const roots = getRoots();

  if (fit && Math.abs(fit.A) > 1e-9) {
    const vx = -fit.B / (2 * fit.A);
    const vy = f(vx);
    return {
      quadratic: true,
      fit,
      vertex: { x: vx, y: vy },
      axisX: vx,
      yIntercept: Number.isFinite(yIntercept) ? { x: 0, y: yIntercept } : null,
      roots,
      extrema: [],
    };
  }

  return {
    quadratic: false,
    fit,
    vertex: null,
    axisX: null,
    yIntercept: Number.isFinite(yIntercept) ? { x: 0, y: yIntercept } : null,
    roots,
    extrema: scanExtrema(state.view.xMin, state.view.xMax, 560),
  };
}

function scanExtrema(xMin, xMax, count) {
  const points = [];
  let prevX = xMin;
  let prevD = derivative(prevX);
  for (let i = 1; i <= count; i += 1) {
    const x = xMin + ((xMax - xMin) * i) / count;
    const d = derivative(x);
    if (Number.isFinite(prevD) && Number.isFinite(d) && prevD * d < 0) {
      const refined = bisectDerivative(prevX, x);
      const y = f(refined);
      if (Number.isFinite(y)) points.push({ x: refined, y });
    }
    prevX = x;
    prevD = d;
  }
  return points.filter((point, index) => points.findIndex((other) => Math.abs(other.x - point.x) < 0.08) === index);
}

function bisectDerivative(left, right) {
  let lo = left;
  let hi = right;
  let dLo = derivative(lo);
  for (let i = 0; i < 34; i += 1) {
    const mid = (lo + hi) / 2;
    const dMid = derivative(mid);
    if (!Number.isFinite(dMid)) break;
    if (Math.abs(dMid) < 1e-6) return mid;
    if (dLo * dMid <= 0) {
      hi = mid;
    } else {
      lo = mid;
      dLo = dMid;
    }
  }
  return (lo + hi) / 2;
}

function updateViewToFunction() {
  const xMin = state.view.xMin;
  const xMax = state.view.xMax;
  const values = [0, f(0), f(state.probeX)];
  const fit = fitQuadratic();
  if (fit && Math.abs(fit.A) > 1e-9) {
    values.push(f(-fit.B / (2 * fit.A)));
  }
  for (let i = 0; i <= 160; i += 1) {
    const x = xMin + ((xMax - xMin) * i) / 160;
    const y = f(x);
    if (Number.isFinite(y)) values.push(y);
  }
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return;

  let yMin = Math.min(...finite);
  let yMax = Math.max(...finite);
  if (Math.abs(yMax - yMin) < 1) {
    yMin -= 4;
    yMax += 4;
  }
  const pad = Math.max(1.5, (yMax - yMin) * 0.14);
  yMin -= pad;
  yMax += pad;
  if (yMin > 0) yMin = -1;
  if (yMax < 0) yMax = 1;
  state.view.yMin = yMin;
  state.view.yMax = yMax;
}

function updateInfo() {
  const special = getSpecialPoints();
  const yText = special.yIntercept ? `(0, ${formatNumber(special.yIntercept.y, 3)})` : "-";
  els.interceptInfo.textContent = yText;

  if (special.quadratic) {
    els.vertexInfo.textContent = `(${formatNumber(special.vertex.x, 3)}, ${formatNumber(special.vertex.y, 3)})`;
    els.axisInfo.textContent = `x = ${formatNumber(special.axisX, 3)}`;
  } else if (special.extrema.length) {
    const p = special.extrema[0];
    els.vertexInfo.textContent = `극값≈(${formatNumber(p.x, 3)}, ${formatNumber(p.y, 3)})`;
    els.axisInfo.textContent = "-";
  } else {
    els.vertexInfo.textContent = "-";
    els.axisInfo.textContent = "-";
  }

  if (special.roots.length) {
    els.xInterceptInfo.textContent = special.roots.map((p) => `(${formatNumber(p.x, 3)}, 0)`).join(", ");
  } else {
    els.xInterceptInfo.textContent = "없음";
  }
}

function updateToolText() {
  const probeY = f(state.probeX);
  els.probePoint.textContent = `x = ${formatNumber(state.probeX, 3)}, y = ${formatNumber(probeY, 3)}`;
  els.basicResult.textContent = `f(${formatNumber(state.probeX, 3)}) = ${formatNumber(probeY, 3)}`;

  const x1 = Number(els.x1Input.value);
  const x2 = Number(els.x2Input.value);
  const y1 = f(x1);
  const y2 = f(x2);
  if ([x1, x2, y1, y2].every(Number.isFinite) && x1 !== x2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    els.ratioResult.textContent = `Δx = ${formatNumber(dx, 3)}, Δy = ${formatNumber(dy, 3)}, Δy/Δx = ${formatNumber(dy / dx, 3)}`;
  } else {
    els.ratioResult.textContent = "계산할 수 없음";
  }

  const tx = Number(els.tangentX.value);
  const ty = f(tx);
  const m = derivative(tx);
  if ([tx, ty, m].every(Number.isFinite)) {
    const intercept = ty - m * tx;
    els.tangentResult.textContent = `y = ${formatNumber(m, 3)}x ${signedText(intercept, 3)}`;
  } else {
    els.tangentResult.textContent = "계산할 수 없음";
  }

  const from = Number(els.integralFrom.value);
  const to = Number(els.integralTo.value);
  const value = integral(from, to);
  els.integralResult.textContent = Number.isFinite(value)
    ? `∫[${formatNumber(from, 2)}, ${formatNumber(to, 2)}] f(x) dx ≈ ${formatNumber(value, 5)}`
    : "계산할 수 없음";
}

async function startRecording() {
  if (!window.MediaRecorder) {
    setRecordingNotice("미지원");
    els.basicResult.textContent = "이 브라우저에서는 녹화를 지원하지 않습니다.";
    return;
  }

  els.recordButton.disabled = true;
  setRecordingNotice("준비중");

  try {
    const { stream, mode } = await createRecordingStream();
    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const session = {
      recorder,
      stream,
      chunks: [],
      startedAt: Date.now(),
      timer: 0,
      mode,
      stopping: false,
    };

    state.recording = session;
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data && event.data.size > 0) session.chunks.push(event.data);
    });
    recorder.addEventListener("stop", () => finishRecording(session));
    stream.getTracks().forEach((track) => {
      track.addEventListener("ended", () => {
        if (state.recording === session) stopRecording(false);
      });
    });

    recorder.start(250);
    session.timer = window.setInterval(updateRecordingClock, 500);
    setRecordingActive(true, mode);
    updateRecordingClock();
  } catch (error) {
    state.recording = null;
    setRecordingNotice("오류");
    els.basicResult.textContent = `녹화를 시작할 수 없습니다: ${error.message}`;
  } finally {
    els.recordButton.disabled = false;
  }
}

async function createRecordingStream() {
  if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      });
      return { stream, mode: "화면" };
    } catch {
      if (canvas.captureStream) {
        els.basicResult.textContent = "화면 선택이 취소되어 그래프 영역만 녹화합니다.";
        return { stream: canvas.captureStream(30), mode: "그래프" };
      }
      throw new Error("화면 녹화 권한이 필요합니다.");
    }
  }

  if (canvas.captureStream) {
    return { stream: canvas.captureStream(30), mode: "그래프" };
  }

  throw new Error("이 브라우저에서는 화면 또는 그래프 녹화를 지원하지 않습니다.");
}

function getSupportedMimeType() {
  const types = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function stopRecording(stopTracks = true) {
  const session = state.recording;
  if (!session || session.stopping) return;
  session.stopping = true;
  window.clearInterval(session.timer);
  setRecordingActive(false, session.mode);

  if (session.recorder.state !== "inactive") {
    session.recorder.stop();
  }

  if (stopTracks) {
    session.stream.getTracks().forEach((track) => track.stop());
  }
}

function finishRecording(session) {
  if (state.recording !== session) return;

  if (session.chunks.length) {
    const type = session.recorder.mimeType || "video/webm";
    const blob = new Blob(session.chunks, { type });
    downloadRecording(blob);
    setRecordingNotice("저장됨");
  } else {
    setRecordingNotice("비어있음");
  }

  session.stream.getTracks().forEach((track) => track.stop());
  state.recording = null;
  els.recordButton.disabled = false;
  updateRecordingClock(0);
}

function downloadRecording(blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `graph-recording-${timestampForFile()}.webm`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function setRecordingActive(active, mode) {
  els.recordButton.classList.toggle("recording", active);
  els.recordButton.setAttribute("aria-pressed", String(active));
  els.recordButton.title = active ? "녹화 정지" : "녹화 시작";
  els.recordButtonText.textContent = active ? "정지" : "녹화";
  setRecordingNotice(active ? mode : "저장중");
}

function setRecordingNotice(text) {
  els.recordMode.textContent = text;
}

function updateRecordingClock(forcedSeconds) {
  const seconds = typeof forcedSeconds === "number"
    ? forcedSeconds
    : state.recording
      ? Math.floor((Date.now() - state.recording.startedAt) / 1000)
      : 0;
  const minutesText = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secondsText = String(seconds % 60).padStart(2, "0");
  els.recordTime.textContent = `${minutesText}:${secondsText}`;
}

function timestampForFile() {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ];
  return `${parts[0]}${parts[1]}${parts[2]}-${parts[3]}${parts[4]}${parts[5]}`;
}

function addTracePoint() {
  const y = f(state.probeX);
  if (!Number.isFinite(y)) return;
  state.trace.push({ x: state.probeX, y });
  if (state.trace.length > 48) state.trace.shift();
}

function setProbeFromPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const sx = event.clientX - rect.left;
  const x = fromScreenX(sx);
  state.probeX = clamp(x, state.view.xMin, state.view.xMax);
  addTracePoint();
  updateAll();
}

function draw() {
  const { width, height } = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);

  drawGrid(width, height);
  drawIntegralArea();
  drawFunction(width);
  drawSpecials();
  drawActiveTool();
  drawProbe();
}

function drawGrid(width, height) {
  const stepX = niceStep((state.view.xMax - state.view.xMin) / 8);
  const stepY = niceStep((state.view.yMax - state.view.yMin) / 8);
  ctx.lineWidth = 1;
  ctx.font = "11px system-ui, sans-serif";
  ctx.textBaseline = "top";

  for (let x = Math.ceil(state.view.xMin / stepX) * stepX; x <= state.view.xMax; x += stepX) {
    const sx = toScreenX(x);
    ctx.strokeStyle = Math.abs(x) < 1e-9 ? colors.axis : colors.grid;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, height);
    ctx.stroke();
    if (Math.abs(x) > 1e-9) drawAxisLabel(formatNumber(x, 1), sx + 3, toScreenY(0) + 4);
  }

  for (let y = Math.ceil(state.view.yMin / stepY) * stepY; y <= state.view.yMax; y += stepY) {
    const sy = toScreenY(y);
    ctx.strokeStyle = Math.abs(y) < 1e-9 ? colors.axis : colors.grid;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(width, sy);
    ctx.stroke();
    if (Math.abs(y) > 1e-9) drawAxisLabel(formatNumber(y, 1), toScreenX(0) + 4, sy + 3);
  }
}

function drawAxisLabel(text, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const { width, height } = canvas.getBoundingClientRect();
  if (x < 2 || y < 2 || x > width - 28 || y > height - 14) return;
  ctx.fillStyle = "rgba(159, 175, 199, 0.78)";
  ctx.fillText(text, x, y);
}

function drawFunction(width) {
  const samples = Math.max(360, Math.floor(width * 1.45));
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = 7;
  ctx.strokeStyle = colors.graphGlow;
  traceFunctionPath(samples);
  ctx.stroke();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = colors.graph;
  traceFunctionPath(samples);
  ctx.stroke();
  ctx.restore();
}

function traceFunctionPath(samples) {
  ctx.beginPath();
  let drawing = false;
  let lastSy = 0;
  for (let i = 0; i <= samples; i += 1) {
    const x = state.view.xMin + ((state.view.xMax - state.view.xMin) * i) / samples;
    const y = f(x);
    const sx = toScreenX(x);
    const sy = toScreenY(y);
    const onscreenish = Number.isFinite(sy) && Math.abs(sy) < 20000;
    if (!Number.isFinite(y) || !onscreenish || (drawing && Math.abs(sy - lastSy) > 9000)) {
      drawing = false;
      continue;
    }
    if (!drawing) {
      ctx.moveTo(sx, sy);
      drawing = true;
    } else {
      ctx.lineTo(sx, sy);
    }
    lastSy = sy;
  }
}

function drawSpecials() {
  const special = getSpecialPoints();

  if (special.quadratic && Number.isFinite(special.axisX)) {
    drawVerticalLine(special.axisX, colors.purple, 1.25, [5, 6]);
  }

  if (special.yIntercept) {
    drawPoint(special.yIntercept, colors.red, 5.5, "y절편");
  }

  if (state.showRoots) {
    special.roots.forEach((root) => drawPoint(root, colors.red, 5.5, "x절편"));
  }

  if (special.vertex) {
    drawPoint(special.vertex, colors.orange, 6, "꼭짓점");
  }

  special.extrema.slice(0, 5).forEach((point) => drawPoint(point, colors.orange, 5.5, "극값"));
}

function drawProbe() {
  const y = f(state.probeX);
  if (!Number.isFinite(y)) return;
  const point = { x: state.probeX, y };

  if (state.showGuides) {
    drawVerticalLine(point.x, colors.guide, 1, [3, 5]);
    drawHorizontalLine(point.y, colors.guide, 1, [3, 5]);
    drawPoint({ x: point.x, y: 0 }, colors.red, 4.5, "");
    drawPoint({ x: 0, y: point.y }, colors.red, 4.5, "");
  }

  state.trace.forEach((tracePoint, index) => {
    const alpha = (index + 1) / state.trace.length;
    drawPoint(tracePoint, `rgba(255, 224, 102, ${0.12 + alpha * 0.28})`, 2.5 + alpha * 2.5, "");
  });

  drawPoint(point, colors.yellow, 7, "선택점");
}

function drawActiveTool() {
  if (state.activeTool === "ratio") drawRatioTool();
  if (state.activeTool === "tangent") drawTangentTool();
  if (state.activeTool === "integral") drawIntegralBounds();
}

function drawRatioTool() {
  const x1 = Number(els.x1Input.value);
  const x2 = Number(els.x2Input.value);
  const y1 = f(x1);
  const y2 = f(x2);
  if (![x1, x2, y1, y2].every(Number.isFinite)) return;

  const p1 = { x: x1, y: y1 };
  const p2 = { x: x2, y: y2 };
  const sx1 = toScreenX(x1);
  const sy1 = toScreenY(y1);
  const sx2 = toScreenX(x2);
  const sy2 = toScreenY(y2);

  ctx.save();
  ctx.strokeStyle = "rgba(255, 224, 102, 0.72)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(sx1, sy1);
  ctx.lineTo(sx2, sy2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 159, 28, 0.7)";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(sx1, sy1);
  ctx.lineTo(sx2, sy1);
  ctx.lineTo(sx2, sy2);
  ctx.stroke();
  ctx.restore();

  drawPoint(p1, colors.yellow, 6, "P1");
  drawPoint(p2, colors.yellow, 6, "P2");
}

function drawTangentTool() {
  const x = Number(els.tangentX.value);
  const y = f(x);
  const m = derivative(x);
  if (![x, y, m].every(Number.isFinite)) return;

  const left = state.view.xMin;
  const right = state.view.xMax;
  const yLeft = m * (left - x) + y;
  const yRight = m * (right - x) + y;

  ctx.save();
  ctx.strokeStyle = colors.purple;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(toScreenX(left), toScreenY(yLeft));
  ctx.lineTo(toScreenX(right), toScreenY(yRight));
  ctx.stroke();
  ctx.restore();

  drawPoint({ x, y }, colors.yellow, 6.5, "접점");
}

function drawIntegralArea() {
  if (state.activeTool !== "integral") return;
  const from = Number(els.integralFrom.value);
  const to = Number(els.integralTo.value);
  if (![from, to].every(Number.isFinite) || from === to) return;
  const left = Math.max(Math.min(from, to), state.view.xMin);
  const right = Math.min(Math.max(from, to), state.view.xMax);
  if (left >= right) return;

  const steps = 180;
  ctx.save();
  ctx.fillStyle = "rgba(110, 231, 183, 0.22)";
  ctx.strokeStyle = "rgba(110, 231, 183, 0.52)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(toScreenX(left), toScreenY(0));
  for (let i = 0; i <= steps; i += 1) {
    const x = left + ((right - left) * i) / steps;
    const y = f(x);
    if (Number.isFinite(y)) ctx.lineTo(toScreenX(x), toScreenY(y));
  }
  ctx.lineTo(toScreenX(right), toScreenY(0));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawIntegralBounds() {
  const from = Number(els.integralFrom.value);
  const to = Number(els.integralTo.value);
  if (![from, to].every(Number.isFinite)) return;
  drawVerticalLine(from, colors.green, 1.4, []);
  drawVerticalLine(to, colors.green, 1.4, []);
}

function drawVerticalLine(x, color, width, dash) {
  const { height } = canvas.getBoundingClientRect();
  const sx = toScreenX(x);
  if (!Number.isFinite(sx)) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(sx, 0);
  ctx.lineTo(sx, height);
  ctx.stroke();
  ctx.restore();
}

function drawHorizontalLine(y, color, width, dash) {
  const { width: canvasWidth } = canvas.getBoundingClientRect();
  const sy = toScreenY(y);
  if (!Number.isFinite(sy)) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(0, sy);
  ctx.lineTo(canvasWidth, sy);
  ctx.stroke();
  ctx.restore();
}

function drawPoint(point, color, radius, label) {
  const sx = toScreenX(point.x);
  const sy = toScreenY(point.y);
  const { width, height } = canvas.getBoundingClientRect();
  if (!Number.isFinite(sx) || !Number.isFinite(sy)) return;
  if (sx < -20 || sy < -20 || sx > width + 20 || sy > height + 20) return;

  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(sx, sy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(2, 4, 10, 0.8)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  if (label) drawPointLabel(label, sx, sy);
}

function drawPointLabel(label, sx, sy) {
  const text = label;
  ctx.save();
  ctx.font = "700 11px system-ui, sans-serif";
  const paddingX = 5;
  const textWidth = ctx.measureText(text).width;
  const boxW = textWidth + paddingX * 2;
  const boxH = 18;
  const { width, height } = canvas.getBoundingClientRect();
  let x = sx + 8;
  let y = sy - 22;
  if (x + boxW > width - 4) x = sx - boxW - 8;
  if (y < 4) y = sy + 9;
  if (y + boxH > height - 4) y = height - boxH - 4;
  ctx.fillStyle = "rgba(3, 6, 12, 0.82)";
  ctx.strokeStyle = "rgba(238, 245, 255, 0.18)";
  roundRect(x, y, boxW, boxH, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = colors.text;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + paddingX, y + boxH / 2 + 0.5);
  ctx.restore();
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function toScreenX(x) {
  const { width } = canvas.getBoundingClientRect();
  return ((x - state.view.xMin) / (state.view.xMax - state.view.xMin)) * width;
}

function toScreenY(y) {
  const { height } = canvas.getBoundingClientRect();
  return height - ((y - state.view.yMin) / (state.view.yMax - state.view.yMin)) * height;
}

function fromScreenX(screenX) {
  const { width } = canvas.getBoundingClientRect();
  return state.view.xMin + (screenX / width) * (state.view.xMax - state.view.xMin);
}

function niceStep(raw) {
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalized = raw / power;
  if (normalized < 1.5) return power;
  if (normalized < 3.5) return 2 * power;
  if (normalized < 7.5) return 5 * power;
  return 10 * power;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function signedText(value, digits) {
  if (!Number.isFinite(value)) return "";
  const sign = value < 0 ? "-" : "+";
  return `${sign} ${formatNumber(Math.abs(value), digits)}`;
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "-";
  if (Math.abs(value) < 1e-9) return "0";
  const fixed = Number(value.toFixed(digits));
  return fixed.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

window.addEventListener("load", boot);
