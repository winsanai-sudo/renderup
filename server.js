const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const MASTER_CODE = process.env.MASTER_CODE || "cho7-master";
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const configuredDataDir = process.env.DATA_DIR;
const DATA_DIR_CANDIDATES = [
  configuredDataDir,
  process.env.RENDER ? "/var/data" : null,
  path.join(ROOT, "data")
].filter(Boolean);
const DATA_DIR = DATA_DIR_CANDIDATES.find((dir) => {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}) || path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || "app_state";
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const EXAM_WEEK = "exam";
const EXAM_MISSION = "examBlog";
const GROUP_LABELS = {
  weekly1: "주1회반",
  weekly2: "주2회반"
};
const GROUP_SESSIONS = {
  weekly1: [
    { week: 1, label: "1주차 · 일요일" },
    { week: 2, label: "2주차 · 일요일" },
    { week: 3, label: "3주차 · 일요일" },
    { week: 4, label: "4주차 · 일요일" },
    { week: 5, label: "5주차 · 일요일" }
  ],
  weekly2: [
    { week: 1, label: "1회차 · 수요일" },
    { week: 2, label: "2회차 · 일요일" },
    { week: 3, label: "3회차 · 수요일" },
    { week: 4, label: "4회차 · 일요일" },
    { week: 5, label: "5회차 · 수요일" },
    { week: 6, label: "6회차 · 일요일" },
    { week: 7, label: "7회차 · 수요일" },
    { week: 8, label: "8회차 · 일요일" },
    { week: 9, label: "9회차 · 수요일" },
    { week: 10, label: "10회차 · 일요일" }
  ]
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

const ROSTER = {
  weekly1: [
    "강태욱",
    "강현선",
    "김소연",
    "김영유",
    "김후중",
    "나은영",
    "남식훈",
    "문재웅",
    "배장윤",
    "박윤정",
    "백화샘",
    "설지샘",
    "수학맘",
    "안보현",
    "안원우",
    "안은주",
    "유재금",
    "유재원",
    "이동휘",
    "이민호",
    "이지훈",
    "임슈스",
    "임예희",
    "장세완",
    "정영운",
    "조우제",
    "추재원",
    "대호샘",
    "황다겸",
    "황해룡",
    "정혜원",
    "유소매",
    "김하현",
    "송혜빈",
    "승빈샘",
    "류용수"
  ],
  weekly2: [
    "구본식",
    "김민호",
    "김보미",
    "김원표",
    "모리",
    "민하",
    "신선미",
    "우석",
    "이기호",
    "김유진",
    "룡쌤"
  ]
};

function defaultDb() {
  return {
    settings: {
      currentWeek: 1,
      resetAt: null,
      createdAt: new Date().toISOString()
    },
    members: {},
    submissions: {}
  };
}

function normalizeDbShape(db) {
  const base = defaultDb();
  const parsed = db || {};
  return {
    ...base,
    ...parsed,
    settings: { ...base.settings, ...(parsed.settings || {}) },
    members: parsed.members || {},
    submissions: parsed.submissions || {}
  };
}

function ensureFileDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    saveFileDb(defaultDb());
  }
}

function readFileDb() {
  ensureFileDb();
  try {
    return normalizeDbShape(JSON.parse(fs.readFileSync(DB_PATH, "utf8")));
  } catch {
    return defaultDb();
  }
}

function saveFileDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tempPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(tempPath, DB_PATH);
}

async function supabaseRequest(pathname, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase 저장소 오류: ${response.status} ${text}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function readSupabaseDb() {
  const rows = await supabaseRequest(`${SUPABASE_TABLE}?key=eq.db&select=data&limit=1`, {
    method: "GET"
  });
  if (Array.isArray(rows) && rows[0]?.data) {
    return normalizeDbShape(rows[0].data);
  }
  const db = defaultDb();
  await saveSupabaseDb(db);
  return db;
}

async function saveSupabaseDb(db) {
  await supabaseRequest(`${SUPABASE_TABLE}?on_conflict=key`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      key: "db",
      data: db,
      updated_at: new Date().toISOString()
    })
  });
}

async function readDb() {
  return USE_SUPABASE ? readSupabaseDb() : readFileDb();
}

async function saveDb(db) {
  if (USE_SUPABASE) {
    await saveSupabaseDb(db);
    return;
  }
  saveFileDb(db);
}

async function ensureDb() {
  if (USE_SUPABASE) {
    await readSupabaseDb();
    return;
  }
  ensureFileDb();
}

function keyedById(items = []) {
  return items.reduce((acc, item) => {
    if (item && item.id) {
      acc[item.id] = item;
    }
    return acc;
  }, {});
}

function send(res, status, payload, headers = {}) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": typeof payload === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, payload);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error("요청 데이터가 너무 큽니다."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("JSON 형식이 올바르지 않습니다."));
      }
    });
    req.on("error", reject);
  });
}

function normalizePhone(phone) {
  return String(phone || "").replace(/[^\d]/g, "");
}

function normalizeUrl(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function maskPhone(phone) {
  const normalized = normalizePhone(phone);
  if (normalized.length < 7) return normalized;
  return `${normalized.slice(0, 3)}-${"*".repeat(Math.max(3, normalized.length - 7))}-${normalized.slice(-4)}`;
}

function makeMemberId(group, name, phone) {
  return crypto.createHash("sha256").update(`${group}|${name}|${normalizePhone(phone)}`).digest("hex").slice(0, 18);
}

function makeSubmissionId(memberId, week, mission) {
  return `${memberId}:week${week}:${mission}`;
}

function getMemberSubmissions(db, memberId) {
  return Object.values(db.submissions)
    .filter((item) => item.memberId === memberId)
    .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
}

function isWeekComplete(db, memberId, week) {
  const mission1 = db.submissions[makeSubmissionId(memberId, week, "mission1")];
  const mission2 = db.submissions[makeSubmissionId(memberId, week, "mission2")];
  return Boolean(mission1 && mission2);
}

function sessionLabel(group, week) {
  return GROUP_SESSIONS[group]?.find((item) => item.week === week)?.label || `${week}회차`;
}

function isLateSubmission(item) {
  return Number.isInteger(item.week) && item.submittedDuringWeek > item.week;
}

function safePublicSubmission(item) {
  return {
    id: item.id,
    memberId: item.memberId,
    group: item.group,
    name: item.name,
    phoneMasked: item.phoneMasked,
    week: item.week,
    mission: item.mission,
    url: item.url || "",
    checklist: item.checklist || {},
    submittedAt: item.submittedAt,
    submittedDuringWeek: item.submittedDuringWeek,
    late: isLateSubmission(item)
  };
}

function requireMaster(reqUrl) {
  const code = reqUrl.searchParams.get("code") || "";
  return code === MASTER_CODE;
}

function serveStatic(req, res, pathname) {
  let relative = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  if (relative === "admin") relative = "admin.html";
  if (relative === "links") relative = "links.html";
  const filePath = path.resolve(PUBLIC_DIR, relative);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.stat(filePath, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      send(res, 404, "Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

async function handleApi(req, res, reqUrl) {
  if (req.method === "GET" && reqUrl.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, storage: USE_SUPABASE ? "supabase" : "file" });
    return;
  }

  if (req.method === "GET" && reqUrl.pathname === "/api/roster") {
    const db = await readDb();
    sendJson(res, 200, { roster: ROSTER, groupLabels: GROUP_LABELS, groupSessions: GROUP_SESSIONS, settings: db.settings });
    return;
  }

  if (req.method === "POST" && reqUrl.pathname === "/api/login") {
    const body = await parseBody(req);
    const group = String(body.group || "");
    const name = String(body.name || "").trim();
    const phone = normalizePhone(body.phone);

    if (!Object.keys(ROSTER).includes(group)) {
      sendJson(res, 400, { message: "주1회반 또는 주2회반을 선택해주세요." });
      return;
    }
    if (!ROSTER[group].includes(name)) {
      sendJson(res, 400, { message: "목록에서 이름을 선택해주세요." });
      return;
    }
    if (phone.length < 8) {
      sendJson(res, 400, { message: "핸드폰 번호를 정확히 입력해주세요." });
      return;
    }

    const db = await readDb();
    const id = makeMemberId(group, name, phone);
    const now = new Date().toISOString();
    db.members[id] = {
      ...(db.members[id] || {}),
      id,
      group,
      name,
      phone,
      phoneMasked: maskPhone(phone),
      firstLoginAt: db.members[id]?.firstLoginAt || now,
      lastLoginAt: now
    };
    await saveDb(db);
    sendJson(res, 200, {
      member: { ...db.members[id], phone: undefined },
      submissions: getMemberSubmissions(db, id).map(safePublicSubmission),
      settings: db.settings
    });
    return;
  }

  if (req.method === "GET" && reqUrl.pathname === "/api/me") {
    const memberId = reqUrl.searchParams.get("memberId") || "";
    const db = await readDb();
    const member = db.members[memberId];
    if (!member) {
      sendJson(res, 404, { message: "로그인 정보가 없습니다." });
      return;
    }
    sendJson(res, 200, {
      member: { ...member, phone: undefined },
      submissions: getMemberSubmissions(db, memberId).map(safePublicSubmission),
      settings: db.settings
    });
    return;
  }

  if (req.method === "POST" && reqUrl.pathname === "/api/submit") {
    const body = await parseBody(req);
    const memberId = String(body.memberId || "");
    const mission = String(body.mission || "");
    const week = Number(body.week);
    const db = await readDb();
    const member = db.members[memberId];

    if (!member) {
      sendJson(res, 401, { message: "로그인 후 다시 제출해주세요." });
      return;
    }
    const maxWeek = GROUP_SESSIONS[member.group]?.length || 5;
    if (!Number.isInteger(week) || week < 1 || week > maxWeek) {
      sendJson(res, 400, { message: `제출할 회차를 선택해주세요. ${GROUP_LABELS[member.group]}은 ${maxWeek}회까지 제출할 수 있습니다.` });
      return;
    }
    if (!["mission1", "mission2"].includes(mission)) {
      sendJson(res, 400, { message: "미션을 선택해주세요." });
      return;
    }

    const id = makeSubmissionId(memberId, week, mission);
    if (db.submissions[id]) {
      sendJson(res, 409, {
        message: `${sessionLabel(member.group, week)} 미션은 이미 제출 하였습니다`
      });
      return;
    }

    const item = {
      id,
      memberId,
      group: member.group,
      name: member.name,
      phoneMasked: member.phoneMasked,
      week,
      mission,
      submittedAt: new Date().toISOString(),
      submittedDuringWeek: Number(db.settings.currentWeek || 1)
    };

    if (mission === "mission1") {
      const url = normalizeUrl(body.url);
      if (!url) {
        sendJson(res, 400, { message: "블로그 주소를 입력해주세요." });
        return;
      }
      try {
        new URL(url);
      } catch {
        sendJson(res, 400, { message: "블로그 주소 형식을 확인해주세요." });
        return;
      }
      item.url = url;
    }

    if (mission === "mission2") {
      const checklist = body.checklist || {};
      const required = ["stay", "like", "neighbor", "secretComment"];
      const allChecked = required.every((key) => checklist[key] === true);
      if (!allChecked) {
        sendJson(res, 400, { message: "미션2의 4가지 항목을 모두 체크해주세요." });
        return;
      }
      item.checklist = {
        stay: true,
        like: true,
        neighbor: true,
        secretComment: true
      };
    }

    db.submissions[id] = item;
    await saveDb(db);
    sendJson(res, 200, {
      message: `${sessionLabel(member.group, week)} 미션 제출 완료`,
      submission: safePublicSubmission(item),
      weekComplete: isWeekComplete(db, memberId, week),
      submissions: getMemberSubmissions(db, memberId).map(safePublicSubmission)
    });
    return;
  }

  if (req.method === "GET" && reqUrl.pathname === "/api/admin") {
    if (!requireMaster(reqUrl)) {
      sendJson(res, 401, { message: "마스터 코드가 필요합니다." });
      return;
    }
    const db = await readDb();
    sendJson(res, 200, {
      settings: db.settings,
      members: Object.values(db.members).sort((a, b) => a.name.localeCompare(b.name, "ko")),
      submissions: Object.values(db.submissions)
        .filter((item) => item.mission !== EXAM_MISSION)
        .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
    });
    return;
  }

  if (req.method === "PATCH" && reqUrl.pathname === "/api/admin/settings") {
    if (!requireMaster(reqUrl)) {
      sendJson(res, 401, { message: "마스터 코드가 필요합니다." });
      return;
    }
    const body = await parseBody(req);
    const currentWeek = Number(body.currentWeek);
    if (!Number.isInteger(currentWeek) || currentWeek < 1 || currentWeek > 10) {
      sendJson(res, 400, { message: "현재 운영 회차는 1~9 사이여야 합니다." });
      return;
    }
    const db = await readDb();
    db.settings.currentWeek = currentWeek;
    db.settings.updatedAt = new Date().toISOString();
    await saveDb(db);
    sendJson(res, 200, { settings: db.settings });
    return;
  }

  if (req.method === "POST" && reqUrl.pathname === "/api/admin/reset") {
    if (!requireMaster(reqUrl)) {
      sendJson(res, 401, { message: "마스터 코드가 필요합니다." });
      return;
    }
    const body = await parseBody(req);
    if (body.confirm !== "RESET") {
      sendJson(res, 400, { message: "RESET 확인 문구가 필요합니다." });
      return;
    }
    const db = defaultDb();
    db.settings.resetAt = new Date().toISOString();
    await saveDb(db);
    sendJson(res, 200, { message: "모든 데이터가 초기화되었습니다.", settings: db.settings });
    return;
  }

  if (req.method === "POST" && reqUrl.pathname === "/api/admin/restore") {
    if (!requireMaster(reqUrl)) {
      sendJson(res, 401, { message: "마스터 코드가 필요합니다." });
      return;
    }
    const body = await parseBody(req);
    if (body.confirm !== "RESTORE") {
      sendJson(res, 400, { message: "RESTORE 확인 문구가 필요합니다." });
      return;
    }
    const restored = {
      settings: {
        ...defaultDb().settings,
        ...(body.settings || {}),
        restoredAt: new Date().toISOString()
      },
      members: Array.isArray(body.members) ? keyedById(body.members) : body.members || {},
      submissions: Array.isArray(body.submissions) ? keyedById(body.submissions) : body.submissions || {}
    };
    await saveDb(restored);
    sendJson(res, 200, {
      message: "백업 데이터가 복구되었습니다.",
      settings: restored.settings,
      members: Object.keys(restored.members).length,
      submissions: Object.keys(restored.submissions).length
    });
    return;
  }

  if (req.method === "GET" && reqUrl.pathname === "/api/links") {
    const db = await readDb();
    const weekParam = reqUrl.searchParams.get("week") || "0";
    const week = Number(weekParam);
    const memberId = reqUrl.searchParams.get("memberId") || "";
    const member = db.members[memberId];

    if (!member && !requireMaster(reqUrl)) {
      sendJson(res, 401, { message: "로그인 후 같은 반 방문 링크를 볼 수 있습니다." });
      return;
    }

    const submissions = Object.values(db.submissions)
      .filter((item) => item.mission === "mission1" && item.url)
      .filter((item) => !member || item.group === member.group)
      .filter((item) => !week || item.week === week)
      .sort((a, b) => {
        const aWeek = Number(a.week || 0);
        const bWeek = Number(b.week || 0);
        return aWeek - bWeek || a.name.localeCompare(b.name, "ko");
      })
      .map(safePublicSubmission);
    sendJson(res, 200, {
      settings: db.settings,
      memberGroup: member ? member.group : null,
      groupLabel: member ? GROUP_LABELS[member.group] : "전체",
      submissions
    });
    return;
  }

  sendJson(res, 404, { message: "API를 찾을 수 없습니다." });
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (reqUrl.pathname.startsWith("/api/")) {
      await handleApi(req, res, reqUrl);
      return;
    }
    serveStatic(req, res, reqUrl.pathname);
  } catch (error) {
    sendJson(res, 500, { message: error.message || "서버 오류가 발생했습니다." });
  }
});

ensureDb()
  .then(() => {
    server.listen(PORT, HOST, () => {
      console.log(`초블9기 미션 웹사이트: http://${HOST}:${PORT}`);
      console.log(`저장소: ${USE_SUPABASE ? "Supabase" : "local file"}`);
      console.log(`마스터 코드: ${MASTER_CODE}`);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

