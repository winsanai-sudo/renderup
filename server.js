const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const MASTER_CODE = process.env.MASTER_CODE || "cho7-master";
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

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
  junior: [
    "피타고라스",
    "유클리드",
    "아르키메데스",
    "탈레스",
    "히파티아",
    "알콰리즈미",
    "피보나치",
    "데카르트",
    "파스칼",
    "페르마",
    "뉴턴",
    "라이프니츠",
    "오일러",
    "라그랑주",
    "라플라스",
    "푸리에",
    "가우스",
    "소피 제르맹",
    "코시",
    "에이다 러브레이스"
  ],
  senior: [
    "리만",
    "칸토어",
    "푸앵카레",
    "힐베르트",
    "에미 뇌터",
    "라마누잔",
    "괴델",
    "튜링",
    "폰 노이만",
    "콜모고로프",
    "존 내시",
    "그로텐디크",
    "만델브로트",
    "앙드레 베유",
    "장피에르 세르",
    "줄리아 로빈슨",
    "마이클 아티야",
    "메리엄 미르자카니",
    "테렌스 타오",
    "세드릭 빌라니"
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

function ensureDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    saveDb(defaultDb());
  }
}

function readDb() {
  ensureDb();
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    return {
      ...defaultDb(),
      ...parsed,
      settings: { ...defaultDb().settings, ...(parsed.settings || {}) },
      members: parsed.members || {},
      submissions: parsed.submissions || {}
    };
  } catch {
    return defaultDb();
  }
}

function saveDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tempPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(tempPath, DB_PATH);
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
    late: item.submittedDuringWeek > item.week
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
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && reqUrl.pathname === "/api/roster") {
    const db = readDb();
    sendJson(res, 200, { roster: ROSTER, settings: db.settings });
    return;
  }

  if (req.method === "POST" && reqUrl.pathname === "/api/login") {
    const body = await parseBody(req);
    const group = String(body.group || "");
    const name = String(body.name || "").trim();
    const phone = normalizePhone(body.phone);

    if (!["junior", "senior"].includes(group)) {
      sendJson(res, 400, { message: "주니어 또는 시니어를 선택해주세요." });
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

    const db = readDb();
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
    saveDb(db);
    sendJson(res, 200, {
      member: { ...db.members[id], phone: undefined },
      submissions: getMemberSubmissions(db, id).map(safePublicSubmission),
      settings: db.settings
    });
    return;
  }

  if (req.method === "GET" && reqUrl.pathname === "/api/me") {
    const memberId = reqUrl.searchParams.get("memberId") || "";
    const db = readDb();
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
    const week = Number(body.week);
    const mission = String(body.mission || "");
    const db = readDb();
    const member = db.members[memberId];

    if (!member) {
      sendJson(res, 401, { message: "로그인 후 다시 제출해주세요." });
      return;
    }
    if (!Number.isInteger(week) || week < 1 || week > 5) {
      sendJson(res, 400, { message: "제출할 주차를 선택해주세요." });
      return;
    }
    if (!["mission1", "mission2"].includes(mission)) {
      sendJson(res, 400, { message: "미션을 선택해주세요." });
      return;
    }

    const id = makeSubmissionId(memberId, week, mission);
    if (db.submissions[id]) {
      sendJson(res, 409, { message: `${week}주차 미션은 이미 제출 하였습니다` });
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
    saveDb(db);
    sendJson(res, 200, {
      message: `${week}주차 미션 제출 완료`,
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
    const db = readDb();
    sendJson(res, 200, {
      settings: db.settings,
      members: Object.values(db.members).sort((a, b) => a.name.localeCompare(b.name, "ko")),
      submissions: Object.values(db.submissions).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
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
    if (!Number.isInteger(currentWeek) || currentWeek < 1 || currentWeek > 5) {
      sendJson(res, 400, { message: "현재 운영 주차는 1~5 사이여야 합니다." });
      return;
    }
    const db = readDb();
    db.settings.currentWeek = currentWeek;
    db.settings.updatedAt = new Date().toISOString();
    saveDb(db);
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
    saveDb(db);
    sendJson(res, 200, { message: "모든 데이터가 초기화되었습니다.", settings: db.settings });
    return;
  }

  if (req.method === "GET" && reqUrl.pathname === "/api/links") {
    const db = readDb();
    const week = Number(reqUrl.searchParams.get("week") || 0);
    const submissions = Object.values(db.submissions)
      .filter((item) => item.mission === "mission1" && item.url)
      .filter((item) => !week || item.week === week)
      .sort((a, b) => a.week - b.week || a.name.localeCompare(b.name, "ko"))
      .map(safePublicSubmission);
    sendJson(res, 200, { settings: db.settings, submissions });
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

ensureDb();
server.listen(PORT, HOST, () => {
  console.log(`초블7기 미션 웹사이트: http://${HOST}:${PORT}`);
  console.log(`마스터 코드: ${MASTER_CODE}`);
});
