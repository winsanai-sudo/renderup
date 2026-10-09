const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const configuredMasterCode = process.env.MASTER_CODE || "cho10-master";
const MASTER_CODE = configuredMasterCode
  .replace(/choblog([\s_-]?)9(?=\D|$)/gi, (_, separator) => `choblog${separator}10`)
  .replace(/chobl([\s_-]?)9(?=\D|$)/gi, (_, separator) => `chobl${separator}10`)
  .replace(/cho([\s_-]?)9(?=\D|$)/gi, (_, separator) => `cho${separator}10`)
  .replace(/초블([\s_-]?)9(?=\D|$)/g, (_, separator) => `초블${separator}10`);
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
const STATE_KEY = process.env.STATE_KEY || "choblog10";
const DB_PATH = path.join(DATA_DIR, `${STATE_KEY}.json`);
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || "app_state";
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const EXAM_WEEK = "exam";
const EXAM_MISSION = "examBlog";
const GROUP_LABELS = {
  junior: "주니어 팀",
  senior: "시니어 팀"
};
const GROUP_SESSIONS = {
  junior: [
    { week: 1, label: "1주차 · 일요일" },
    { week: 2, label: "2주차 · 일요일" },
    { week: 3, label: "3주차 · 일요일" },
    { week: 4, label: "4주차 · 일요일" },
    { week: 5, label: "5주차 · 일요일" }
  ],
  senior: [
    { week: 1, label: "1주차 · 일요일" },
    { week: 2, label: "2주차 · 일요일" },
    { week: 3, label: "3주차 · 일요일" },
    { week: 4, label: "4주차 · 일요일" },
    { week: 5, label: "5주차 · 일요일" }
  ]
};
const GROUP_SCHEDULES = {
  junior: ["2026-10-11", "2026-10-18", "2026-10-25", "2026-11-01", "2026-11-08"],
  senior: ["2026-10-11", "2026-10-18", "2026-10-25", "2026-11-01", "2026-11-08"]
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
  junior: [
    "경아샘",
    "봉현샘",
    "깜냥샘",
    "윤정샘",
    "초록샘",
    "선샘",
    "수경샘",
    "진기샘",
    "성민샘",
    "유현샘",
    "정민샘",
    "규보샘"
  ],
  senior: [
    "태욱샘",
    "현선샘",
    "본식샘",
    "도연샘",
    "김민호샘",
    "보미샘",
    "소연샘",
    "원표샘",
    "재하샘",
    "은영샘",
    "식훈샘",
    "매튜샘",
    "모리샘",
    "재웅샘",
    "장윤샘",
    "백화샘",
    "설지샘",
    "솩맘샘",
    "선미샘",
    "보현샘",
    "원우샘",
    "은주샘",
    "우석샘",
    "재금샘",
    "재원샘",
    "이기호샘",
    "이민호샘",
    "지훈샘",
    "슈스샘",
    "예희샘",
    "세완샘",
    "영운샘",
    "추재원샘",
    "한솔샘",
    "다겸샘",
    "혜원샘",
    "유진샘",
    "소매샘",
    "하현샘",
    "혜빈샘",
    "승빈샘"
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
    submissions: {},
    audits: {}
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
    submissions: parsed.submissions || {},
    audits: parsed.audits || {}
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
  const rows = await supabaseRequest(`${SUPABASE_TABLE}?key=eq.${encodeURIComponent(STATE_KEY)}&select=data&limit=1`, {
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
      key: STATE_KEY,
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

let dbMutationQueue = Promise.resolve();

function mutateDb(mutator) {
  const operation = dbMutationQueue.then(async () => {
    const db = await readDb();
    const result = await mutator(db);
    await saveDb(db);
    return { db, result };
  });
  dbMutationQueue = operation.catch(() => undefined);
  return operation;
}

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
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

function todayInKorea() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function currentSessionWeek(group = "junior") {
  const schedule = GROUP_SCHEDULES[group] || GROUP_SCHEDULES.junior;
  const today = todayInKorea();
  let activeWeek = 1;
  schedule.forEach((date, index) => {
    if (today >= date) activeWeek = index + 1;
  });
  return activeWeek;
}

function clientSettings(db) {
  return {
    ...db.settings,
    currentWeek: currentSessionWeek(),
    currentWeeks: {
      junior: currentSessionWeek("junior"),
      senior: currentSessionWeek("senior")
    }
  };
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function missionDateFor(group, week) {
  return (GROUP_SCHEDULES[group] || GROUP_SCHEDULES.junior)?.[week - 1] || "";
}

function missionDeadlineAt(group, week) {
  const missionDate = missionDateFor(group, week);
  return missionDate ? new Date(`${addDays(missionDate, 2)}T00:01:00+09:00`) : null;
}

function extractNaverPublishedDate(html) {
  const candidates = [
    html.match(/se_publishDate[^>]*>\s*([^<]+)/i)?.[1],
    html.match(/"publishDate"\s*:\s*"([^"]+)"/i)?.[1],
    html.match(/(?:article:published_time|datePublished)[^>]+content=["']([^"']+)/i)?.[1]
  ].filter(Boolean);

  for (const candidate of candidates) {
    const korean = candidate.match(/(20\d{2})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);
    if (korean) {
      return `${korean[1]}-${korean[2].padStart(2, "0")}-${korean[3].padStart(2, "0")}`;
    }
    const iso = candidate.match(/(20\d{2})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  return "";
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ChoblogMissionAudit/10.0)"
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchNaverPublishedDate(url) {
  const parsed = new URL(url);
  if (!/(^|\.)naver\.com$/i.test(parsed.hostname)) return "";

  let html = await fetchText(parsed.href);
  let publishedDate = extractNaverPublishedDate(html);
  if (publishedDate) return publishedDate;

  const frameSrc = html.match(/src=["']([^"']*PostView\.naver[^"']*)["']/i)?.[1];
  if (!frameSrc) return "";
  const decodedSrc = frameSrc.replace(/&amp;/g, "&");
  html = await fetchText(new URL(decodedSrc, parsed.origin).href);
  return extractNaverPublishedDate(html);
}

let auditRunPromise = null;

async function runDueAudits({ force = false } = {}) {
  if (auditRunPromise) return auditRunPromise;
  auditRunPromise = (async () => {
    const now = new Date();
    const snapshot = await readDb();
    const dueWeeks = GROUP_SESSIONS.junior
      .map((session) => session.week)
      .filter((week) => now >= missionDeadlineAt("junior", week))
      .filter((week) => {
        if (force || !snapshot.audits?.[week]) return true;
        const deadline = missionDeadlineAt("junior", week);
        return Object.values(snapshot.submissions).some(
          (item) =>
            item.mission === "mission1" &&
            item.week === week &&
            item.url &&
            !item.postDateCheckedAt &&
            deadline &&
            new Date(item.submittedAt) > deadline
        );
      });

    for (const week of dueWeeks) {
      const results = [];
      const deadline = missionDeadlineAt("junior", week);
      const candidates = Object.values(snapshot.submissions).filter(
        (item) =>
          item.mission === "mission1" &&
          item.week === week &&
          item.url &&
          (force || !item.postDateCheckedAt) &&
          deadline &&
          new Date(item.submittedAt) > deadline
      );

      for (const item of candidates) {
        try {
          const postPublishedDate = await fetchNaverPublishedDate(item.url);
          results.push({
            id: item.id,
            postPublishedDate,
            postDateStatus: postPublishedDate
              ? postPublishedDate === missionDateFor(item.group, week)
                ? "matched"
                : "mismatch"
              : "unavailable"
          });
        } catch {
          results.push({ id: item.id, postPublishedDate: "", postDateStatus: "unavailable" });
        }
      }

      const checkedAt = new Date().toISOString();
      const { db: latest } = await mutateDb((db) => {
        results.forEach((result) => {
          if (!db.submissions[result.id]) return;
          Object.assign(db.submissions[result.id], result, { postDateCheckedAt: checkedAt });
        });
        db.audits[week] = {
          week,
          missionDate: missionDateFor("junior", week),
          deadlineAt: deadline.toISOString(),
          ranAt: checkedAt,
          checkedBlogCount: results.length,
          matchedBlogCount: results.filter((item) => item.postDateStatus === "matched").length,
          unavailableBlogCount: results.filter((item) => item.postDateStatus === "unavailable").length
        };
      });
      snapshot.audits = latest.audits;
    }
    return readDb();
  })();

  try {
    return await auditRunPromise;
  } finally {
    auditRunPromise = null;
  }
}

function isLateSubmission(item) {
  if (item.postDateStatus === "matched") return false;
  const deadline = missionDeadlineAt(item.group, item.week);
  if (deadline && item.submittedAt) return new Date(item.submittedAt) > deadline;
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
    postPublishedDate: item.postPublishedDate || "",
    postDateStatus: item.postDateStatus || "",
    postDateCheckedAt: item.postDateCheckedAt || "",
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
    sendJson(res, 200, { ok: true, generation: 10, masterGeneration: 10, storage: USE_SUPABASE ? "supabase" : "file" });
    return;
  }

  if (req.method === "GET" && reqUrl.pathname === "/api/roster") {
    const db = await readDb();
    sendJson(res, 200, { roster: ROSTER, groupLabels: GROUP_LABELS, groupSessions: GROUP_SESSIONS, settings: clientSettings(db) });
    return;
  }

  if (req.method === "POST" && reqUrl.pathname === "/api/login") {
    const body = await parseBody(req);
    const group = String(body.group || "");
    const name = String(body.name || "").trim();
    const phone = normalizePhone(body.phone);

    if (!Object.keys(ROSTER).includes(group)) {
      sendJson(res, 400, { message: "주니어 팀 또는 시니어 팀을 선택해주세요." });
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

    const id = makeMemberId(group, name, phone);
    const now = new Date().toISOString();
    const { db } = await mutateDb((latest) => {
      latest.members[id] = {
        ...(latest.members[id] || {}),
        id,
        group,
        name,
        phone,
        phoneMasked: maskPhone(phone),
        firstLoginAt: latest.members[id]?.firstLoginAt || now,
        lastLoginAt: now
      };
    });
    sendJson(res, 200, {
      member: { ...db.members[id], phone: undefined },
      submissions: getMemberSubmissions(db, id).map(safePublicSubmission),
      settings: clientSettings(db)
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
      settings: clientSettings(db)
    });
    return;
  }

  if (req.method === "POST" && reqUrl.pathname === "/api/submit") {
    const body = await parseBody(req);
    const memberId = String(body.memberId || "");
    const mission = String(body.mission || "");
    const week = Number(body.week);
    if (!["mission1", "mission2"].includes(mission)) {
      sendJson(res, 400, { message: "미션을 선택해주세요." });
      return;
    }

    let missionPayload = {};
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
      missionPayload = { url };
    }

    if (mission === "mission2") {
      const checklist = body.checklist || {};
      const required = ["stay", "like", "neighbor", "secretComment"];
      const allChecked = required.every((key) => checklist[key] === true);
      if (!allChecked) {
        sendJson(res, 400, { message: "미션2의 4가지 항목을 모두 체크해주세요." });
        return;
      }
      missionPayload = { checklist: { stay: true, like: true, neighbor: true, secretComment: true } };
    }

    const { db, result: item } = await mutateDb((latest) => {
      const member = latest.members[memberId];
      if (!member) throw new ApiError(401, "로그인 후 다시 제출해주세요.");
      const maxWeek = GROUP_SESSIONS[member.group]?.length || 5;
      if (!Number.isInteger(week) || week < 1 || week > maxWeek) {
        throw new ApiError(400, `제출할 회차를 선택해주세요. ${GROUP_LABELS[member.group]}은 ${maxWeek}회까지 제출할 수 있습니다.`);
      }

      const id = makeSubmissionId(memberId, week, mission);
      if (latest.submissions[id]) {
        throw new ApiError(409, `${sessionLabel(member.group, week)} 미션은 이미 제출 하였습니다`);
      }

      const submission = {
        id,
        memberId,
        group: member.group,
        name: member.name,
        phoneMasked: member.phoneMasked,
        week,
        mission,
        submittedAt: new Date().toISOString(),
        submittedDuringWeek: currentSessionWeek(member.group),
        ...missionPayload
      };
      latest.submissions[id] = submission;
      return submission;
    });
    sendJson(res, 200, {
      message: `${sessionLabel(item.group, week)} 미션 제출 완료`,
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
    await runDueAudits();
    const db = await readDb();
    sendJson(res, 200, {
      settings: clientSettings(db),
      roster: ROSTER,
      groupLabels: GROUP_LABELS,
      groupSessions: GROUP_SESSIONS,
      groupSchedules: GROUP_SCHEDULES,
      audits: db.audits || {},
      members: Object.values(db.members).sort((a, b) => a.name.localeCompare(b.name, "ko")),
      submissions: Object.values(db.submissions)
        .filter((item) => item.mission !== EXAM_MISSION)
        .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
    });
    return;
  }

  if (req.method === "POST" && reqUrl.pathname === "/api/admin/audit") {
    if (!requireMaster(reqUrl)) {
      sendJson(res, 401, { message: "마스터 코드가 필요합니다." });
      return;
    }
    const db = await runDueAudits({ force: true });
    sendJson(res, 200, {
      message: "마감된 주차의 블로그 게시일을 다시 확인했습니다.",
      settings: clientSettings(db),
      audits: db.audits || {},
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
    if (!Number.isInteger(currentWeek) || currentWeek < 1 || currentWeek > 5) {
      sendJson(res, 400, { message: "현재 운영 주차는 1~5 사이여야 합니다." });
      return;
    }
    const { db } = await mutateDb((latest) => {
      latest.settings.currentWeek = currentWeek;
      latest.settings.updatedAt = new Date().toISOString();
    });
    sendJson(res, 200, { settings: clientSettings(db) });
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
    const { db } = await mutateDb((latest) => {
      const fresh = defaultDb();
      fresh.settings.resetAt = new Date().toISOString();
      Object.keys(latest).forEach((key) => delete latest[key]);
      Object.assign(latest, fresh);
    });
    sendJson(res, 200, { message: "모든 데이터가 초기화되었습니다.", settings: clientSettings(db) });
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
      submissions: Array.isArray(body.submissions) ? keyedById(body.submissions) : body.submissions || {},
      audits: body.audits || {}
    };
    await mutateDb((latest) => {
      Object.keys(latest).forEach((key) => delete latest[key]);
      Object.assign(latest, restored);
    });
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
      settings: clientSettings(db),
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
    sendJson(res, error.status || 500, { message: error.message || "서버 오류가 발생했습니다." });
  }
});

ensureDb()
  .then(() => {
    server.listen(PORT, HOST, () => {
      console.log(`초블10기 미션 웹사이트: http://${HOST}:${PORT}`);
      console.log(`저장소: ${USE_SUPABASE ? "Supabase" : "local file"}`);
      console.log("마스터 코드: 환경변수 또는 로컬 보안 파일 사용");
    });
    runDueAudits().catch((error) => console.error("자동 주차 점검 실패:", error.message));
    const auditTimer = setInterval(() => {
      runDueAudits().catch((error) => console.error("자동 주차 점검 실패:", error.message));
    }, 60 * 1000);
    auditTimer.unref();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

