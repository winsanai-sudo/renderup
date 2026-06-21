const canvas = document.querySelector("#graphCanvas");
const ctx = canvas.getContext("2d");

const els = {
  expression: document.querySelector("#expression"),
  expressionG: document.querySelector("#expressionG"),
  applyExpression: document.querySelector("#applyExpression"),
  applyExpressionG: document.querySelector("#applyExpressionG"),
  parseStatus: document.querySelector("#parseStatus"),
  parseStatusG: document.querySelector("#parseStatusG"),
  enableG: document.querySelector("#enableG"),
  recordButton: document.querySelector("#recordButton"),
  recordButtonText: document.querySelector("#recordButtonText"),
  recordMode: document.querySelector("#recordMode"),
  recordTime: document.querySelector("#recordTime"),
  saveImage: document.querySelector("#saveImage"),
  resetView: document.querySelector("#resetView"),
  probeMode: document.querySelector("#probeMode"),
  panMode: document.querySelector("#panMode"),
  shareLink: document.querySelector("#shareLink"),
  shareStatus: document.querySelector("#shareStatus"),
  aSlider: document.querySelector("#aSlider"),
  bSlider: document.querySelector("#bSlider"),
  cSlider: document.querySelector("#cSlider"),
  aValue: document.querySelector("#aValue"),
  bValue: document.querySelector("#bValue"),
  cValue: document.querySelector("#cValue"),
  autoFit: document.querySelector("#autoFit"),
  gridStep: document.querySelector("#gridStep"),
  graphColor: document.querySelector("#graphColor"),
  zoomIn: document.querySelector("#zoomIn"),
  zoomOut: document.querySelector("#zoomOut"),
  vertexInfo: document.querySelector("#vertexInfo"),
  axisInfo: document.querySelector("#axisInfo"),
  interceptInfo: document.querySelector("#interceptInfo"),
  xInterceptInfo: document.querySelector("#xInterceptInfo"),
  probePoint: document.querySelector("#probePoint"),
  showRoots: document.querySelector("#showRoots"),
  showGuides: document.querySelector("#showGuides"),
  showSpecials: document.querySelector("#showSpecials"),
  showRiemann: document.querySelector("#showRiemann"),
  basicResult: document.querySelector("#basicResult"),
  x1Input: document.querySelector("#x1Input"),
  x2Input: document.querySelector("#x2Input"),
  ratioResult: document.querySelector("#ratioResult"),
  tangentX: document.querySelector("#tangentX"),
  useProbeForTangent: document.querySelector("#useProbeForTangent"),
  tangentResult: document.querySelector("#tangentResult"),
  intersectionResult: document.querySelector("#intersectionResult"),
  integralFrom: document.querySelector("#integralFrom"),
  integralTo: document.querySelector("#integralTo"),
  integralResult: document.querySelector("#integralResult"),
  tabs: [...document.querySelectorAll(".tab")],
  toolCards: [...document.querySelectorAll(".tool-card")],
  presets: [...document.querySelectorAll("[data-preset]")],
};

const allowedSymbols = new Set(["x", "a", "b", "c", "pi", "e"]);
const allowedFunctions = new Set([
  "sqrt",
  "abs",
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "log",
  "ln",
  "exp",
  "min",
  "max",
]);

const colors = {
  bg: "#02040a",
  grid: "rgba(148, 163, 184, 0.13)",
  axis: "rgba(238, 245, 255, 0.58)",
  graph: "#35a6ff",
  graphGlow: "rgba(53, 166, 255, 0.25)",
  graphG: "#b892ff",
  yellow: "#ffe066",
  red: "#ff4d6d",
  orange: "#ff9f1c",
  purple: "#b892ff",
  green: "#6ee7b7",
  guide: "rgba(238, 245, 255, 0.42)",
  text: "#eef5ff",
  muted: "#9fafc7",
};

const presets = {
  quadratic: { f: "a*x^2 + b*x + c", a: 1, b: 0, c: 0 },
  vertex: { f: "a*(x-b)^2 + c", a: 1, b: 0, c: 0 },
  linear: { f: "a*x + c", a: 1, b: 0, c: 0 },
  absolute: { f: "a*abs(x-b) + c", a: 1, b: 0, c: 0 },
  cubic: { f: "a*x^3 + b*x + c", a: 0.2, b: 0, c: 0 },
  rational: { f: "a/(x-b) + c", a: 1, b: 0, c: 0 },
  trig: { f: "a*sin(b*x) + c", a: 2, b: 1, c: 0 },
  sqrt: { f: "a*sqrt(x-b) + c", a: 1, b: 0, c: 0 },
};

const state = {
  compiledF: null,
  compiledG: null,
  validF: false,
  validG: false,
  exprF: "a*x^2 + b*x + c",
  exprG: "a*(x-b)^2 + c",
  useG: false,
  a: 1,
  b: 0,
  c: 0,
  probeX: 1,
  activeTool: "basic",
  interactionMode: "probe",
  showRoots: true,
  showGuides: true,
  showSpecials: true,
  showRiemann: false,
  autoFit: true,
  gridStep: "auto",
  graphColor: colors.graph,
  view: { xMin: -6, xMax: 6, yMin: -6, yMax: 12 },
  trace: [],
  pointers: new Map(),
  panStart: null,
  pinchStart: null,
  recording: null,
};

let resizeRaf = 0;
let drawRaf = 0;

function boot() {
  restoreFromUrl();
  bindEvents();
  compileExpression("f", true);
  compileExpression("g", true);
  resizeCanvas();
  updateAll();
}

function bindEvents() {
  els.applyExpression.addEventListener("click", () => {
    compileExpression("f");
    updateAll();
  });
  els.applyExpressionG.addEventListener("click", () => {
    compileExpression("g");
    updateAll();
  });
  [els.expression, els.expressionG].forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      compileExpression(input === els.expression ? "f" : "g");
      updateAll();
    });
  });

  [els.aSlider, els.bSlider, els.cSlider].forEach((slider) => {
    slider.addEventListener("input", () => {
      readControls();
      addTracePoint();
      updateAll();
    });
  });

  [
    els.enableG,
    els.showRoots,
    els.showGuides,
    els.showSpecials,
    els.showRiemann,
    els.autoFit,
    els.gridStep,
    els.graphColor,
    els.x1Input,
    els.x2Input,
    els.tangentX,
    els.integralFrom,
    els.integralTo,
  ].forEach((control) => control.addEventListener("input", updateAll));

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

  els.presets.forEach((button) => {
    button.addEventListener("click", () => applyPreset(button.dataset.preset));
  });

  els.probeMode.addEventListener("click", () => setInteractionMode("probe"));
  els.panMode.addEventListener("click", () => setInteractionMode("pan"));
  els.zoomIn.addEventListener("click", () => zoomView(0.75));
  els.zoomOut.addEventListener("click", () => zoomView(1.32));
  els.shareLink.addEventListener("click", copyShareUrl);
  els.saveImage.addEventListener("click", saveCanvasImage);
  els.resetView.addEventListener("click", resetView);
  els.recordButton.addEventListener("click", () => (state.recording ? stopRecording() : startRecording()));

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 0.88 : 1.14;
    zoomView(factor, fromScreen(event.offsetX, event.offsetY));
  }, { passive: false });

  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerup", handlePointerEnd);
  canvas.addEventListener("pointercancel", handlePointerEnd);

  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      resizeCanvas();
      updateAll();
    });
  });
}

function restoreFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("f")) els.expression.value = params.get("f");
  if (params.has("g")) els.expressionG.value = params.get("g");
  if (params.has("useG")) els.enableG.checked = params.get("useG") === "1";
  ["a", "b", "c"].forEach((key) => {
    if (params.has(key)) {
      const value = Number(params.get(key));
      if (Number.isFinite(value)) els[`${key}Slider`].value = value;
    }
  });
  if (params.has("tool")) activateTool(params.get("tool"));
}

function validateExpression(text) {
  if (!window.math) throw new Error("수식 엔진을 불러오지 못했습니다.");
  if (text.length > 180) throw new Error("식은 180자 이하로 입력해 주세요.");
  const parsed = math.parse(text);
  parsed.traverse((node) => {
    if (node.type === "SymbolNode" && !allowedSymbols.has(node.name)) {
      throw new Error(`${node.name}은 사용할 수 없습니다.`);
    }
    if (node.type === "FunctionNode") {
      const name = node.fn && node.fn.name;
      if (!allowedFunctions.has(name)) throw new Error(`${name} 함수는 사용할 수 없습니다.`);
    }
    if (node.type === "ConstantNode" && !Number.isFinite(Number(node.value))) {
      throw new Error("상수는 유한한 수만 사용할 수 있습니다.");
    }
    const allowedTypes = new Set(["OperatorNode", "ConstantNode", "SymbolNode", "FunctionNode", "ParenthesisNode"]);
    if (!allowedTypes.has(node.type)) throw new Error(`${node.type} 형식은 사용할 수 없습니다.`);
  });
  return parsed.compile();
}

function compileExpression(which, silent = false) {
  const input = which === "f" ? els.expression : els.expressionG;
  const status = which === "f" ? els.parseStatus : els.parseStatusG;
  const text = input.value.trim() || (which === "f" ? "a*x^2 + b*x + c" : "a*(x-b)^2 + c");
  try {
    const compiled = validateExpression(text);
    if (which === "f") {
      state.compiledF = compiled;
      state.validF = true;
      state.exprF = text;
    } else {
      state.compiledG = compiled;
      state.validG = true;
      state.exprG = text;
    }
    status.textContent = `${which}(x) = ${text}`;
    status.classList.remove("error");
  } catch (error) {
    if (which === "f") {
      state.compiledF = null;
      state.validF = false;
    } else {
      state.compiledG = null;
      state.validG = false;
    }
    status.textContent = silent ? `${which}(x) 식을 확인해 주세요.` : `식 오류: ${error.message}`;
    status.classList.add("error");
  }
}

function applyPreset(key) {
  const preset = presets[key];
  if (!preset) return;
  els.expression.value = preset.f;
  els.aSlider.value = preset.a;
  els.bSlider.value = preset.b;
  els.cSlider.value = preset.c;
  compileExpression("f");
  state.autoFit = true;
  els.autoFit.checked = true;
  updateAll();
}

function readControls() {
  state.a = Number(els.aSlider.value);
  state.b = Number(els.bSlider.value);
  state.c = Number(els.cSlider.value);
  state.useG = els.enableG.checked;
  state.showRoots = els.showRoots.checked;
  state.showGuides = els.showGuides.checked;
  state.showSpecials = els.showSpecials.checked;
  state.showRiemann = els.showRiemann.checked;
  state.autoFit = els.autoFit.checked;
  state.gridStep = els.gridStep.value;
  state.graphColor = els.graphColor.value;
  colors.graph = state.graphColor;
  els.aValue.textContent = formatNumber(state.a, 2);
  els.bValue.textContent = formatNumber(state.b, 2);
  els.cValue.textContent = formatNumber(state.c, 2);
}

function updateAll() {
  readControls();
  if (state.autoFit) updateViewToFunction();
  updateInfo();
  updateToolText();
  scheduleDraw();
}

function scope(x) {
  return {
    x,
    a: state.a,
    b: state.b,
    c: state.c,
    pi: Math.PI,
    e: Math.E,
    ln: Math.log,
  };
}

function f(x, which = "f") {
  const compiled = which === "f" ? state.compiledF : state.compiledG;
  if (!compiled) return NaN;
  try {
    const value = compiled.evaluate(scope(x));
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

function derivative(x, which = "f") {
  const h = 1e-4 * Math.max(1, Math.abs(x));
  const y1 = f(x + h, which);
  const y0 = f(x - h, which);
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

function fitQuadratic(which = "f") {
  const ym = f(-1, which);
  const y0 = f(0, which);
  const yp = f(1, which);
  if (![ym, y0, yp].every(Number.isFinite)) return null;
  const A = (yp + ym - 2 * y0) / 2;
  const B = (yp - ym) / 2;
  const C = y0;
  const tests = [-4, -2, 2, 4];
  const ok = tests.every((x) => {
    const actual = f(x, which);
    const expected = A * x * x + B * x + C;
    const tolerance = 1e-4 * Math.max(1, Math.abs(actual), Math.abs(expected));
    return Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance;
  });
  return ok ? { A, B, C } : null;
}

function getRoots(which = "f") {
  const fit = fitQuadratic(which);
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
  return scanZeros((x) => f(x, which), state.view.xMin, state.view.xMax, 900).map((x) => ({ x, y: 0 }));
}

function getIntersections() {
  if (!state.useG || !state.validF || !state.validG) return [];
  return scanZeros((x) => f(x) - f(x, "g"), state.view.xMin, state.view.xMax, 900)
    .map((x) => ({ x, y: f(x) }))
    .filter((point) => Number.isFinite(point.y));
}

function scanZeros(fn, xMin, xMax, count) {
  const roots = [];
  let lastX = xMin;
  let lastY = fn(lastX);
  for (let i = 1; i <= count; i += 1) {
    const x = xMin + ((xMax - xMin) * i) / count;
    const y = fn(x);
    if (Number.isFinite(lastY) && Number.isFinite(y)) {
      if (Math.abs(y) < 1e-4) pushUnique(roots, x);
      if (lastY * y < 0) pushUnique(roots, bisectZero(fn, lastX, x));
    }
    lastX = x;
    lastY = y;
  }
  return roots;
}

function bisectZero(fn, left, right) {
  let lo = left;
  let hi = right;
  let yLo = fn(lo);
  for (let i = 0; i < 38; i += 1) {
    const mid = (lo + hi) / 2;
    const yMid = fn(mid);
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

function pushUnique(list, x) {
  if (!Number.isFinite(x)) return;
  if (!list.some((item) => Math.abs(item - x) < 0.035)) list.push(x);
}

function getSpecialPoints() {
  const fit = fitQuadratic();
  const yIntercept = f(0);
  const roots = getRoots();
  if (fit && Math.abs(fit.A) > 1e-9) {
    const vx = -fit.B / (2 * fit.A);
    return {
      quadratic: true,
      vertex: { x: vx, y: f(vx) },
      axisX: vx,
      yIntercept: Number.isFinite(yIntercept) ? { x: 0, y: yIntercept } : null,
      roots,
    };
  }
  return {
    quadratic: false,
    vertex: null,
    axisX: null,
    yIntercept: Number.isFinite(yIntercept) ? { x: 0, y: yIntercept } : null,
    roots,
  };
}

function updateViewToFunction() {
  if (!state.validF) return;
  const xMin = state.view.xMin;
  const xMax = state.view.xMax;
  const values = [0, f(0), f(state.probeX)];
  for (let i = 0; i <= 180; i += 1) {
    const x = xMin + ((xMax - xMin) * i) / 180;
    const y = f(x);
    if (Number.isFinite(y)) values.push(y);
    if (state.useG && state.validG) {
      const yg = f(x, "g");
      if (Number.isFinite(yg)) values.push(yg);
    }
  }
  const fit = fitQuadratic();
  if (fit && Math.abs(fit.A) > 1e-9) values.push(f(-fit.B / (2 * fit.A)));
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return;
  let yMin = Math.min(...finite);
  let yMax = Math.max(...finite);
  if (Math.abs(yMax - yMin) < 1) {
    yMin -= 4;
    yMax += 4;
  }
  const pad = Math.max(1.5, (yMax - yMin) * 0.14);
  state.view.yMin = yMin - pad;
  state.view.yMax = yMax + pad;
  if (state.view.yMin > 0) state.view.yMin = -1;
  if (state.view.yMax < 0) state.view.yMax = 1;
}

function updateInfo() {
  if (!state.validF) {
    els.vertexInfo.textContent = "-";
    els.axisInfo.textContent = "-";
    els.interceptInfo.textContent = "-";
    els.xInterceptInfo.textContent = "-";
    return;
  }
  const special = getSpecialPoints();
  els.interceptInfo.textContent = special.yIntercept ? `(0, ${formatNumber(special.yIntercept.y, 3)})` : "-";
  if (special.vertex) {
    els.vertexInfo.textContent = `(${formatNumber(special.vertex.x, 3)}, ${formatNumber(special.vertex.y, 3)})`;
    els.axisInfo.textContent = `x = ${formatNumber(special.axisX, 3)}`;
  } else {
    els.vertexInfo.textContent = "-";
    els.axisInfo.textContent = "-";
  }
  els.xInterceptInfo.textContent = special.roots.length
    ? special.roots.map((p) => `(${formatNumber(p.x, 3)}, 0)`).join(", ")
    : "없음";
}

function updateToolText() {
  const probeY = f(state.probeX);
  els.probePoint.textContent = `x = ${formatNumber(state.probeX, 3)}, y = ${formatNumber(probeY, 3)}`;
  els.basicResult.textContent = Number.isFinite(probeY)
    ? `f(${formatNumber(state.probeX, 3)}) = ${formatNumber(probeY, 3)}`
    : "그래프를 계산할 수 없습니다.";

  const x1 = Number(els.x1Input.value);
  const x2 = Number(els.x2Input.value);
  const y1 = f(x1);
  const y2 = f(x2);
  if ([x1, x2, y1, y2].every(Number.isFinite) && x1 !== x2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    els.ratioResult.textContent = `Δx = ${formatNumber(dx, 3)}, Δy = ${formatNumber(dy, 3)}, 평균변화율 = ${formatNumber(dy / dx, 3)}`;
  } else {
    els.ratioResult.textContent = "계산할 수 없음";
  }

  const tx = Number(els.tangentX.value);
  const ty = f(tx);
  const m = derivative(tx);
  if ([tx, ty, m].every(Number.isFinite)) {
    els.tangentResult.textContent = `y = ${formatNumber(m, 3)}x ${signedText(ty - m * tx, 3)}`;
  } else {
    els.tangentResult.textContent = "계산할 수 없음";
  }

  const intersections = getIntersections();
  els.intersectionResult.textContent = intersections.length
    ? intersections.map((p) => `(${formatNumber(p.x, 3)}, ${formatNumber(p.y, 3)})`).join(", ")
    : state.useG ? "현재 보기 범위에서 교점이 없습니다." : "g(x)를 켜면 교점을 계산합니다.";

  const from = Number(els.integralFrom.value);
  const to = Number(els.integralTo.value);
  const value = integral(from, to);
  els.integralResult.textContent = Number.isFinite(value)
    ? `∫[${formatNumber(from, 2)}, ${formatNumber(to, 2)}] f(x) dx ≈ ${formatNumber(value, 5)}`
    : "계산할 수 없음";
}

function activateTool(tool) {
  if (!tool) return;
  state.activeTool = tool;
  els.tabs.forEach((tab) => {
    const active = tab.dataset.tool === tool;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  els.toolCards.forEach((card) => card.classList.toggle("active", card.id === `tool-${tool}`));
}

function setInteractionMode(mode) {
  state.interactionMode = mode;
  els.probeMode.classList.toggle("active", mode === "probe");
  els.panMode.classList.toggle("active", mode === "pan");
}

function resetView() {
  state.view = { xMin: -6, xMax: 6, yMin: -6, yMax: 12 };
  state.autoFit = true;
  els.autoFit.checked = true;
  state.trace = [];
  updateAll();
}

function scheduleDraw() {
  cancelAnimationFrame(drawRaf);
  drawRaf = requestAnimationFrame(draw);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function draw() {
  const { width, height } = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);
  drawGrid(width, height);
  drawIntegralArea();
  drawFunction("f", colors.graph, colors.graphGlow);
  if (state.useG && state.validG) drawFunction("g", colors.graphG, "rgba(184, 146, 255, 0.22)");
  drawSpecials();
  drawActiveTool();
  drawProbe();
}

function drawGrid(width, height) {
  const stepX = state.gridStep === "auto" ? niceStep((state.view.xMax - state.view.xMin) / 8) : Number(state.gridStep);
  const stepY = state.gridStep === "auto" ? niceStep((state.view.yMax - state.view.yMin) / 8) : Number(state.gridStep);
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
  const { width, height } = canvas.getBoundingClientRect();
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 2 || y < 2 || x > width - 34 || y > height - 14) return;
  ctx.fillStyle = "rgba(159, 175, 199, 0.78)";
  ctx.fillText(text, x, y);
}

function drawFunction(which, stroke, glow) {
  if (which === "f" && !state.validF) return;
  const { width } = canvas.getBoundingClientRect();
  const samples = Math.max(360, Math.floor(width * 1.45));
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = 7;
  ctx.strokeStyle = glow;
  traceFunctionPath(samples, which);
  ctx.stroke();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = stroke;
  traceFunctionPath(samples, which);
  ctx.stroke();
  ctx.restore();
}

function traceFunctionPath(samples, which) {
  ctx.beginPath();
  let drawing = false;
  let lastSy = 0;
  for (let i = 0; i <= samples; i += 1) {
    const x = state.view.xMin + ((state.view.xMax - state.view.xMin) * i) / samples;
    const y = f(x, which);
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
  if (!state.showSpecials || !state.validF) return;
  const special = getSpecialPoints();
  if (special.quadratic && Number.isFinite(special.axisX)) drawVerticalLine(special.axisX, colors.purple, 1.2, [5, 6]);
  if (special.yIntercept) drawPoint(special.yIntercept, colors.red, 5.5, "y절편");
  if (state.showRoots) special.roots.forEach((root) => drawPoint(root, colors.red, 5.5, "x절편"));
  if (special.vertex) drawPoint(special.vertex, colors.orange, 6, "꼭짓점");
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
  if (state.activeTool === "intersections") getIntersections().forEach((point) => drawPoint(point, colors.red, 7, "교점"));
  if (state.activeTool === "integral") drawIntegralBounds();
}

function drawRatioTool() {
  const x1 = Number(els.x1Input.value);
  const x2 = Number(els.x2Input.value);
  const y1 = f(x1);
  const y2 = f(x2);
  if (![x1, x2, y1, y2].every(Number.isFinite)) return;
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
  drawPoint({ x: x1, y: y1 }, colors.yellow, 6, "P1");
  drawPoint({ x: x2, y: y2 }, colors.yellow, 6, "P2");
}

function drawTangentTool() {
  const x = Number(els.tangentX.value);
  const y = f(x);
  const m = derivative(x);
  if (![x, y, m].every(Number.isFinite)) return;
  const left = state.view.xMin;
  const right = state.view.xMax;
  ctx.save();
  ctx.strokeStyle = colors.purple;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(toScreenX(left), toScreenY(m * (left - x) + y));
  ctx.lineTo(toScreenX(right), toScreenY(m * (right - x) + y));
  ctx.stroke();
  ctx.restore();
  drawPoint({ x, y }, colors.yellow, 6.5, "접점");
}

function drawIntegralArea() {
  if (state.activeTool !== "integral") return;
  const fromRaw = Number(els.integralFrom.value);
  const toRaw = Number(els.integralTo.value);
  if (![fromRaw, toRaw].every(Number.isFinite) || fromRaw === toRaw) return;
  const from = Math.max(Math.min(fromRaw, toRaw), state.view.xMin);
  const to = Math.min(Math.max(fromRaw, toRaw), state.view.xMax);
  if (from >= to) return;
  const steps = state.showRiemann ? 24 : 180;
  ctx.save();
  ctx.fillStyle = "rgba(110, 231, 183, 0.22)";
  ctx.strokeStyle = "rgba(110, 231, 183, 0.52)";
  ctx.lineWidth = 1;
  if (state.showRiemann) {
    const dx = (to - from) / steps;
    for (let i = 0; i < steps; i += 1) {
      const x = from + dx * i;
      const y = f(x + dx / 2);
      if (!Number.isFinite(y)) continue;
      const sx = toScreenX(x);
      const sy = toScreenY(y);
      const base = toScreenY(0);
      ctx.fillRect(sx, Math.min(sy, base), Math.abs(toScreenX(x + dx) - sx), Math.abs(base - sy));
      ctx.strokeRect(sx, Math.min(sy, base), Math.abs(toScreenX(x + dx) - sx), Math.abs(base - sy));
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(toScreenX(from), toScreenY(0));
    for (let i = 0; i <= steps; i += 1) {
      const x = from + ((to - from) * i) / steps;
      const y = f(x);
      if (Number.isFinite(y)) ctx.lineTo(toScreenX(x), toScreenY(y));
    }
    ctx.lineTo(toScreenX(to), toScreenY(0));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawIntegralBounds() {
  const from = Number(els.integralFrom.value);
  const to = Number(els.integralTo.value);
  if (![from, to].every(Number.isFinite)) return;
  drawVerticalLine(from, colors.green, 1.4, []);
  drawVerticalLine(to, colors.green, 1.4, []);
}

function drawVerticalLine(x, color, lineWidth, dash) {
  const { height } = canvas.getBoundingClientRect();
  const sx = toScreenX(x);
  if (!Number.isFinite(sx)) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(sx, 0);
  ctx.lineTo(sx, height);
  ctx.stroke();
  ctx.restore();
}

function drawHorizontalLine(y, color, lineWidth, dash) {
  const { width: canvasWidth } = canvas.getBoundingClientRect();
  const sy = toScreenY(y);
  if (!Number.isFinite(sy)) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
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
  if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx < -24 || sy < -24 || sx > width + 24 || sy > height + 24) return;
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
  ctx.save();
  ctx.font = "700 11px system-ui, sans-serif";
  const paddingX = 5;
  const textWidth = ctx.measureText(label).width;
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
  ctx.fillText(label, x + paddingX, y + boxH / 2 + 0.5);
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

function handlePointerDown(event) {
  canvas.setPointerCapture(event.pointerId);
  state.pointers.set(event.pointerId, { x: event.offsetX, y: event.offsetY });
  if (state.pointers.size >= 2) {
    const [p1, p2] = [...state.pointers.values()];
    state.pinchStart = {
      distance: distance(p1, p2),
      view: { ...state.view },
      center: fromScreen((p1.x + p2.x) / 2, (p1.y + p2.y) / 2),
    };
    state.autoFit = false;
    els.autoFit.checked = false;
    return;
  }
  if (state.interactionMode === "pan") {
    state.panStart = { x: event.offsetX, y: event.offsetY, view: { ...state.view } };
    state.autoFit = false;
    els.autoFit.checked = false;
  } else {
    setProbeFromScreen(event.offsetX);
  }
}

function handlePointerMove(event) {
  if (!state.pointers.has(event.pointerId)) return;
  state.pointers.set(event.pointerId, { x: event.offsetX, y: event.offsetY });
  if (state.pointers.size >= 2 && state.pinchStart) {
    const [p1, p2] = [...state.pointers.values()];
    const factor = state.pinchStart.distance / Math.max(1, distance(p1, p2));
    state.view = zoomedView(state.pinchStart.view, factor, state.pinchStart.center);
    updateAll();
    return;
  }
  if (state.interactionMode === "pan" && state.panStart) {
    const dx = screenDeltaXToWorld(event.offsetX - state.panStart.x);
    const dy = screenDeltaYToWorld(event.offsetY - state.panStart.y);
    state.view = {
      xMin: state.panStart.view.xMin - dx,
      xMax: state.panStart.view.xMax - dx,
      yMin: state.panStart.view.yMin - dy,
      yMax: state.panStart.view.yMax - dy,
    };
    updateAll();
  } else if (state.interactionMode === "probe") {
    setProbeFromScreen(event.offsetX);
  }
}

function handlePointerEnd(event) {
  if (state.pointers.has(event.pointerId)) state.pointers.delete(event.pointerId);
  state.panStart = null;
  state.pinchStart = null;
}

function setProbeFromScreen(screenX) {
  state.probeX = clamp(fromScreenX(screenX), state.view.xMin, state.view.xMax);
  addTracePoint();
  updateAll();
}

function addTracePoint() {
  const y = f(state.probeX);
  if (!Number.isFinite(y)) return;
  state.trace.push({ x: state.probeX, y });
  if (state.trace.length > 48) state.trace.shift();
}

function zoomView(factor, center = null) {
  state.autoFit = false;
  els.autoFit.checked = false;
  const actualCenter = center || {
    x: (state.view.xMin + state.view.xMax) / 2,
    y: (state.view.yMin + state.view.yMax) / 2,
  };
  state.view = zoomedView(state.view, factor, actualCenter);
  updateAll();
}

function zoomedView(view, factor, center) {
  const newW = (view.xMax - view.xMin) * factor;
  const newH = (view.yMax - view.yMin) * factor;
  return {
    xMin: center.x - (center.x - view.xMin) * factor,
    xMax: center.x + (view.xMax - center.x) * factor,
    yMin: center.y - (center.y - view.yMin) * factor,
    yMax: center.y + (view.yMax - center.y) * factor,
  };
}

function saveCanvasImage() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `graph-${timestampForFile()}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, "image/png");
}

async function copyShareUrl() {
  const params = new URLSearchParams();
  params.set("f", els.expression.value.trim());
  params.set("g", els.expressionG.value.trim());
  params.set("useG", els.enableG.checked ? "1" : "0");
  params.set("a", state.a);
  params.set("b", state.b);
  params.set("c", state.c);
  params.set("tool", state.activeTool);
  const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  try {
    await navigator.clipboard.writeText(url);
    els.shareStatus.textContent = "공유 링크가 복사되었습니다.";
  } catch {
    els.shareStatus.textContent = url;
  }
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
    const session = { recorder, stream, chunks: [], startedAt: Date.now(), timer: 0, mode, stopping: false };
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
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30, max: 60 } }, audio: false });
      return { stream, mode: "화면" };
    } catch {
      if (canvas.captureStream) {
        els.basicResult.textContent = "화면 선택이 취소되어 그래프 영역만 녹화합니다.";
        return { stream: canvas.captureStream(30), mode: "그래프" };
      }
      throw new Error("화면 녹화 권한이 필요합니다.");
    }
  }
  if (canvas.captureStream) return { stream: canvas.captureStream(30), mode: "그래프" };
  throw new Error("이 브라우저에서는 화면 또는 그래프 녹화를 지원하지 않습니다.");
}

function getSupportedMimeType() {
  const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function stopRecording(stopTracks = true) {
  const session = state.recording;
  if (!session || session.stopping) return;
  session.stopping = true;
  window.clearInterval(session.timer);
  setRecordingActive(false, session.mode);
  if (session.recorder.state !== "inactive") session.recorder.stop();
  if (stopTracks) session.stream.getTracks().forEach((track) => track.stop());
}

function finishRecording(session) {
  if (state.recording !== session) return;
  if (session.chunks.length) {
    const blob = new Blob(session.chunks, { type: session.recorder.mimeType || "video/webm" });
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
  els.recordTime.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
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

function fromScreen(screenX, screenY) {
  const { width, height } = canvas.getBoundingClientRect();
  return {
    x: state.view.xMin + (screenX / width) * (state.view.xMax - state.view.xMin),
    y: state.view.yMin + ((height - screenY) / height) * (state.view.yMax - state.view.yMin),
  };
}

function screenDeltaXToWorld(dx) {
  const { width } = canvas.getBoundingClientRect();
  return (dx / width) * (state.view.xMax - state.view.xMin);
}

function screenDeltaYToWorld(dy) {
  const { height } = canvas.getBoundingClientRect();
  return (-dy / height) * (state.view.yMax - state.view.yMin);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function niceStep(raw) {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
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

function timestampForFile() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
}

window.addEventListener("load", boot);
