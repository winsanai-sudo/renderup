const state = {
  code: localStorage.getItem("choblog-master-code") || "",
  settings: { currentWeek: 1 },
  members: [],
  submissions: []
};
const groupSessions = {
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
};
const allWeeks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const $ = (selector) => document.querySelector(selector);
const toast = $("#toast");

function showToast(text) {
  toast.textContent = text;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function showMessage(element, text, type = "") {
  element.textContent = text;
  element.className = `message ${type}`.trim();
}

async function api(path, options = {}) {
  const joiner = path.includes("?") ? "&" : "?";
  const pathWithCode = `${path}${joiner}code=${encodeURIComponent(state.code)}`;
  const response = await fetch(pathWithCode, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "요청 처리에 실패했습니다.");
  return data;
}

function fmtDate(iso) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(iso));
}

function groupLabel(group) {
  return group === "weekly2" ? "주2회반" : "주1회반";
}

function sessionsFor(group) {
  return groupSessions[group] || groupSessions.weekly1;
}

function missionLabel(mission) {
  if (mission === "mission1") return "미션1";
  return "미션2";
}

function weekLabel(week) {
  return `${week}주차`;
}

function submissionWeekLabel(item) {
  return sessionsFor(item.group).find((session) => session.week === item.week)?.label || `${item.week}회차`;
}

function isLate(item) {
  return Number.isInteger(item.week) && item.submittedDuringWeek > item.week;
}

function isBlogMission(item) {
  return item.mission === "mission1";
}

function memberSubmissions(memberId, week) {
  return state.submissions.filter((item) => item.memberId === memberId && item.week === week);
}

function weekCell(memberId, week) {
  const items = memberSubmissions(memberId, week);
  const m1 = items.some((item) => item.mission === "mission1");
  const m2 = items.some((item) => item.mission === "mission2");
  const late = items.some(isLate);
  const cls = m1 && m2 ? "complete" : m1 || m2 ? "partial" : "";
  const label = m1 && m2 ? "성공" : m1 ? "M1" : m2 ? "M2" : "-";
  return `<span class="week-cell ${cls} ${late ? "late" : ""}">${label}${late ? " · 지각" : ""}</span>`;
}

function successCount(memberId) {
  const member = state.members.find((item) => item.id === memberId);
  return sessionsFor(member?.group).filter((session) => {
    const week = session.week;
    const items = memberSubmissions(memberId, week);
    return items.some((item) => item.mission === "mission1") && items.some((item) => item.mission === "mission2");
  }).length;
}

function renderKpis() {
  const lateCount = state.submissions.filter(isLate).length;
  const completeWeeks = state.members.reduce((sum, member) => sum + successCount(member.id), 0);
  const blogLinkCount = state.submissions.filter(isBlogMission).length;
  $("#kpiGrid").innerHTML = [
    ["명단", `${state.members.length}명`],
    ["전체 제출", `${state.submissions.length}건`],
    ["성공 회차", `${completeWeeks}회`],
    ["빨간 표시", `${lateCount}건`],
    ["블로그 링크", `${blogLinkCount}개`]
  ]
    .map(([label, value]) => `<article class="kpi-card"><span>${label}</span><strong>${value}</strong></article>`)
    .join("");
}

function renderMembers() {
  $("#memberCountBadge").textContent = `${state.members.length}명`;
  $("#membersTable").innerHTML =
    state.members
      .map((member) => {
        const count = successCount(member.id);
        const maxCount = sessionsFor(member.group).length;
        return `
          <tr>
            <td>${groupLabel(member.group)}</td>
            <td>${member.name}</td>
            <td>${member.phoneMasked || ""}</td>
            <td><strong>${count}/${maxCount}</strong></td>
            ${allWeeks.map((week) => `<td>${sessionsFor(member.group).some((session) => session.week === week) ? weekCell(member.id, week) : "-"}</td>`).join("")}
          </tr>
        `;
      })
      .join("") || `<tr><td colspan="14">아직 접속한 명단이 없습니다.</td></tr>`;
}

function renderSubmissions() {
  $("#submissionCountBadge").textContent = `${state.submissions.length}건`;
  $("#submissionsTable").innerHTML =
    state.submissions
      .map((item) => {
        const late = isLate(item);
        const content = isBlogMission(item)
          ? `<a class="content-link" href="${item.url}" target="_blank" rel="noopener">${item.url}</a>`
          : "체류1분이상 · 좋아요 · 서이추 · 비밀댓글";
        return `
          <tr class="${late ? "late-row" : ""}">
            <td><span class="status-chip ${late ? "late" : "done"}">${late ? "빨간표시" : "정상"}</span></td>
            <td>${submissionWeekLabel(item)}</td>
            <td>${missionLabel(item.mission)}</td>
            <td>${groupLabel(item.group)}</td>
            <td>${item.name}</td>
            <td>${fmtDate(item.submittedAt)}</td>
            <td>${item.submittedDuringWeek}회차</td>
            <td>${content}</td>
          </tr>
        `;
      })
      .join("") || `<tr><td colspan="8">아직 제출 데이터가 없습니다.</td></tr>`;
}

function render() {
  $("#currentWeekSelect").value = String(state.settings.currentWeek || 1);
  renderKpis();
  renderMembers();
  renderSubmissions();
}

async function loadAdmin() {
  const data = await api("/api/admin");
  state.settings = data.settings;
  state.members = data.members;
  state.submissions = (data.submissions || []).filter((item) => item.mission !== "examBlog");
  $("#adminLogin").classList.add("hidden");
  $("#adminView").classList.remove("hidden");
  render();
}

$("#adminLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  state.code = $("#masterCodeInput").value.trim();
  try {
    await loadAdmin();
    localStorage.setItem("choblog-master-code", state.code);
    showToast("마스터 접속 완료");
  } catch (error) {
    showMessage($("#adminLoginMessage"), error.message, "error");
  }
});

$("#saveWeekBtn").addEventListener("click", async () => {
  const currentWeek = Number($("#currentWeekSelect").value);
  try {
    const data = await api("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({ currentWeek })
    });
    state.settings = data.settings;
    render();
    showToast(`${currentWeek}회차로 저장했습니다.`);
  } catch (error) {
    showToast(error.message);
  }
});

$("#copyLinksBtn").addEventListener("click", async () => {
  const url = `${window.location.origin}/links.html`;
  try {
    await navigator.clipboard.writeText(url);
    showToast("방문 링크 페이지 주소를 복사했습니다.");
  } catch {
    showToast(url);
  }
});

$("#resetBtn").addEventListener("click", async () => {
  const confirmText = window.prompt("모든 명단과 제출 데이터를 삭제하려면 RESET을 입력하세요.");
  if (confirmText !== "RESET") return;
  try {
    await api("/api/admin/reset", {
      method: "POST",
      body: JSON.stringify({ confirm: "RESET" })
    });
    state.members = [];
    state.submissions = [];
    state.settings.currentWeek = 1;
    render();
    showToast("초기화 완료");
  } catch (error) {
    showToast(error.message);
  }
});

$("#adminLogoutBtn").addEventListener("click", () => {
  localStorage.removeItem("choblog-master-code");
  state.code = "";
  $("#adminView").classList.add("hidden");
  $("#adminLogin").classList.remove("hidden");
});

if (state.code) {
  $("#masterCodeInput").value = state.code;
  loadAdmin().catch(() => {
    localStorage.removeItem("choblog-master-code");
    state.code = "";
  });
}
