const state = {
  roster: { weekly1: [], weekly2: [] },
  groupSessions: {
    weekly1: [
      "1주차 · 일요일",
      "2주차 · 일요일",
      "3주차 · 일요일",
      "4주차 · 일요일",
      "5주차 · 일요일"
    ].map((label, index) => ({ week: index + 1, label })),
    weekly2: [
      "1회차 · 수요일",
      "2회차 · 일요일",
      "3회차 · 수요일",
      "4회차 · 일요일",
      "5회차 · 수요일",
      "6회차 · 일요일",
      "7회차 · 수요일",
      "8회차 · 일요일",
      "9회차 · 수요일",
      "10회차 · 일요일"
    ].map((label, index) => ({ week: index + 1, label }))
  },
  group: "weekly1",
  selectedName: "",
  member: null,
  submissions: [],
  selectedWeek: 1,
  settings: { currentWeek: 1 }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const WEEKLY1_SCHEDULE = [
  { week: 1, date: "2026-08-23" },
  { week: 2, date: "2026-08-30" },
  { week: 3, date: "2026-09-06" },
  { week: 4, date: "2026-09-13" },
  { week: 5, date: "2026-09-20" }
];
const WEEKLY2_SCHEDULE = [
  { week: 1, date: "2026-08-19" },
  { week: 2, date: "2026-08-23" },
  { week: 3, date: "2026-08-26" },
  { week: 4, date: "2026-08-30" },
  { week: 5, date: "2026-09-02" },
  { week: 6, date: "2026-09-06" },
  { week: 7, date: "2026-09-09" },
  { week: 8, date: "2026-09-13" },
  { week: 9, date: "2026-09-16" },
  { week: 10, date: "2026-09-20" }
];

const loginView = $("#loginView");
const missionView = $("#missionView");
const rosterList = $("#rosterList");
const selectedNameBadge = $("#selectedNameBadge");
const rosterTitle = $("#rosterTitle");
const loginMessage = $("#loginMessage");
const missionMessage = $("#missionMessage");
const toast = $("#toast");

function groupLabel(group) {
  return group === "weekly2" ? "주2회반" : "주1회반";
}

function sessionsFor(group) {
  return state.groupSessions[group] || state.groupSessions.weekly1;
}

function sessionLabel(group, week) {
  return sessionsFor(group).find((item) => item.week === week)?.label || `${week}회차`;
}

function todayKstDateString() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function scheduledWeekFor(schedule, today) {
  let activeWeek = schedule[0]?.week;
  for (const session of schedule) {
    if (session.date > today) break;
    activeWeek = session.week;
  }
  return activeWeek;
}

function defaultWeekFor(group) {
  const sessions = sessionsFor(group);
  const schedule = group === "weekly2" ? WEEKLY2_SCHEDULE : WEEKLY1_SCHEDULE;
  if (schedule.length) {
    const today = todayKstDateString();
    return scheduledWeekFor(schedule, today) || sessions[0].week;
  }
  const configuredWeek = Number(state.settings.currentWeeks?.[group] || state.settings.currentWeek);
  return sessions.some((item) => item.week === configuredWeek) ? configuredWeek : sessions[0].week;
}

function missionLabel(mission) {
  if (mission === "mission1") return "미션1";
  return "미션2";
}

function fmtDate(iso) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(iso));
}

function showMessage(target, text, type = "") {
  target.textContent = text;
  target.className = `message ${type}`.trim();
}

function showToast(text) {
  toast.textContent = text;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2800);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "요청 처리에 실패했습니다.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function renderRoster() {
  const names = state.roster[state.group] || [];
  rosterTitle.textContent = `${groupLabel(state.group)} 명단`;
  selectedNameBadge.textContent = state.selectedName || "이름 선택";
  rosterList.innerHTML = names
    .map((name) => `<button type="button" class="name-btn ${name === state.selectedName ? "selected" : ""}" data-name="${name}">${name}</button>`)
    .join("");
}

function renderWeekPicker() {
  const sessions = sessionsFor(state.member?.group || state.group);
  $("#weekStatusTitle").textContent = sessionLabel(state.member?.group || state.group, state.selectedWeek);
  $("#weekPicker").innerHTML = sessions
    .map((session) => `<button type="button" class="week-btn ${session.week === state.selectedWeek ? "active" : ""}" data-week="${session.week}" aria-pressed="${session.week === state.selectedWeek}">${session.week}</button>`)
    .join("");
}

function submissionFor(week, mission) {
  return state.submissions.find((item) => item.week === week && item.mission === mission);
}

function renderProgress() {
  const weeklyProgress = sessionsFor(state.member.group)
    .map((session) => {
      const week = session.week;
      const m1 = submissionFor(week, "mission1");
      const m2 = submissionFor(week, "mission2");
      const complete = m1 && m2;
      const late = [m1, m2].some((item) => item && item.submittedDuringWeek > item.week);
      return `
        <article class="progress-card">
          <strong>${session.label}</strong>
          <div class="mini-status">
            <span class="status-chip ${m1 ? "done" : "pending"}">M1 ${m1 ? "완료" : "대기"}</span>
            <span class="status-chip ${m2 ? "done" : "pending"}">M2 ${m2 ? "완료" : "대기"}</span>
            ${complete ? `<span class="status-chip win">성공</span>` : ""}
            ${late ? `<span class="status-chip late">빨간표시</span>` : ""}
          </div>
        </article>
      `;
    })
    .join("");
  $("#progressGrid").innerHTML = weeklyProgress;
}

function renderMissionForms() {
  const m1 = submissionFor(state.selectedWeek, "mission1");
  const m2 = submissionFor(state.selectedWeek, "mission2");
  const blogUrlInput = $("#blogUrlInput");
  const mission1Button = $("#mission1Button");
  const mission2Button = $("#mission2Button");

  blogUrlInput.value = m1?.url || "";
  blogUrlInput.disabled = Boolean(m1);
  mission1Button.textContent = m1 ? "미션1 제출 완료" : "미션1 완료";

  $$(`#mission2Form input[type="checkbox"]`).forEach((checkbox) => {
    checkbox.checked = Boolean(m2?.checklist?.[checkbox.name]);
    checkbox.disabled = Boolean(m2);
  });
  mission2Button.textContent = m2 ? "미션2 제출 완료" : "미션2 완료";
}

function renderMissionView() {
  if (!state.member) return;
  $("#memberGroup").textContent = `${groupLabel(state.member.group)} · 현재 인증 ${sessionLabel(state.member.group, state.selectedWeek)}`;
  $("#memberName").textContent = `${state.member.name} 미션 보드`;
  renderWeekPicker();
  renderProgress();
  renderMissionForms();
}

function enterMissionView(payload) {
  state.member = payload.member;
  state.submissions = payload.submissions || [];
  state.settings = payload.settings || state.settings;
  state.selectedWeek = defaultWeekFor(state.member.group);
  localStorage.setItem("choblog-member-id", state.member.id);
  loginView.classList.add("hidden");
  missionView.classList.remove("hidden");
  window.scrollTo(0, 0);
  renderMissionView();
}

async function loadRoster() {
  const data = await api("/api/roster");
  state.roster = data.roster;
  state.groupSessions = data.groupSessions || state.groupSessions;
  state.settings = data.settings || state.settings;
  renderRoster();
}

async function restoreLogin() {
  const memberId = localStorage.getItem("choblog-member-id");
  if (!memberId) return;
  try {
    const data = await api(`/api/me?memberId=${encodeURIComponent(memberId)}`);
    enterMissionView(data);
  } catch {
    localStorage.removeItem("choblog-member-id");
  }
}

function celebrate(week) {
  showToast(`${sessionLabel(state.member.group, week)} 미션 성공!!`);
  launchFireworks();
}

async function submitMission(mission, payload) {
  try {
    const data = await api("/api/submit", {
      method: "POST",
      body: JSON.stringify({
        memberId: state.member.id,
        week: state.selectedWeek,
        mission,
        ...payload
      })
    });
    state.submissions = data.submissions;
    showMessage(missionMessage, data.message, "success");
    showToast(data.message);
    renderMissionView();
    if (data.weekComplete) celebrate(state.selectedWeek);
  } catch (error) {
    const text =
      error.status === 409
        ? `${sessionLabel(state.member.group, state.selectedWeek)} 미션은 이미 제출 하였습니다`
        : error.message;
    showMessage(missionMessage, text, "error");
    showToast(text);
  }
}

function launchFireworks() {
  const canvas = $("#fireworks");
  const ctx = canvas.getContext("2d");
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const resize = () => {
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();

  const colors = ["#5ee7ff", "#77ffb6", "#ff6f91", "#ffd166", "#ffffff"];
  const particles = [];
  for (let burst = 0; burst < 6; burst += 1) {
    const x = window.innerWidth * (0.18 + Math.random() * 0.64);
    const y = window.innerHeight * (0.14 + Math.random() * 0.42);
    for (let i = 0; i < 54; i += 1) {
      const angle = (Math.PI * 2 * i) / 54;
      const speed = 2.4 + Math.random() * 4.2;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 70 + Math.random() * 28,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
  }

  let frame = 0;
  function tick() {
    frame += 1;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.globalCompositeOperation = "lighter";
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.045;
      p.life -= 1;
      ctx.globalAlpha = Math.max(0, p.life / 92);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    });
    if (frame < 100) {
      requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
  }
  tick();
}

$$(".segment").forEach((button) => {
  button.addEventListener("click", () => {
    state.group = button.dataset.group;
    state.selectedName = "";
    $$(".segment").forEach((item) => item.classList.toggle("active", item === button));
    renderRoster();
  });
});

rosterList.addEventListener("click", (event) => {
  const button = event.target.closest(".name-btn");
  if (!button) return;
  state.selectedName = button.dataset.name;
  renderRoster();
});

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage(loginMessage, "");
  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        group: state.group,
        name: state.selectedName,
        phone: $("#phoneInput").value
      })
    });
    enterMissionView(data);
    showToast(`${data.member.name}님 접속 완료`);
  } catch (error) {
    showMessage(loginMessage, error.message, "error");
  }
});

$("#weekPicker").addEventListener("click", (event) => {
  const button = event.target.closest(".week-btn");
  if (!button) return;
  state.selectedWeek = Number(button.dataset.week);
  showMessage(missionMessage, "");
  renderMissionView();
});

$("#mission1Form").addEventListener("submit", (event) => {
  event.preventDefault();
  submitMission("mission1", { url: $("#blogUrlInput").value });
});

$("#mission2Form").addEventListener("submit", (event) => {
  event.preventDefault();
  const checklist = Object.fromEntries(
    $$(`#mission2Form input[type="checkbox"]`).map((checkbox) => [checkbox.name, checkbox.checked])
  );
  submitMission("mission2", { checklist });
});

$("#logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("choblog-member-id");
  state.member = null;
  state.submissions = [];
  missionView.classList.add("hidden");
  loginView.classList.remove("hidden");
  showMessage(missionMessage, "");
});

loadRoster().then(restoreLogin).catch((error) => {
  showMessage(loginMessage, error.message, "error");
});
