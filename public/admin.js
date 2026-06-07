const state = {
  code: localStorage.getItem("choblog-master-code") || "",
  settings: { currentWeek: 1 },
  members: [],
  submissions: []
};

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
  return group === "senior" ? "시니어" : "주니어";
}

function missionLabel(mission) {
  return mission === "mission1" ? "미션1" : "미션2";
}

function memberSubmissions(memberId, week) {
  return state.submissions.filter((item) => item.memberId === memberId && item.week === week);
}

function weekCell(memberId, week) {
  const items = memberSubmissions(memberId, week);
  const m1 = items.some((item) => item.mission === "mission1");
  const m2 = items.some((item) => item.mission === "mission2");
  const late = items.some((item) => item.submittedDuringWeek > item.week);
  const cls = m1 && m2 ? "complete" : m1 || m2 ? "partial" : "";
  const label = m1 && m2 ? "성공" : m1 ? "M1" : m2 ? "M2" : "-";
  return `<span class="week-cell ${cls} ${late ? "late" : ""}">${label}${late ? " · 지각" : ""}</span>`;
}

function successCount(memberId) {
  return [1, 2, 3, 4, 5].filter((week) => {
    const items = memberSubmissions(memberId, week);
    return items.some((item) => item.mission === "mission1") && items.some((item) => item.mission === "mission2");
  }).length;
}

function renderKpis() {
  const lateCount = state.submissions.filter((item) => item.submittedDuringWeek > item.week).length;
  const completeWeeks = state.members.reduce((sum, member) => sum + successCount(member.id), 0);
  const mission1Count = state.submissions.filter((item) => item.mission === "mission1").length;
  $("#kpiGrid").innerHTML = [
    ["명단", `${state.members.length}명`],
    ["전체 제출", `${state.submissions.length}건`],
    ["성공 주차", `${completeWeeks}회`],
    ["빨간 표시", `${lateCount}건`],
    ["블로그 링크", `${mission1Count}개`]
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
        return `
          <tr>
            <td>${groupLabel(member.group)}</td>
            <td>${member.name}</td>
            <td>${member.phoneMasked || ""}</td>
            <td><strong>${count}/5</strong></td>
            <td>${weekCell(member.id, 1)}</td>
            <td>${weekCell(member.id, 2)}</td>
            <td>${weekCell(member.id, 3)}</td>
            <td>${weekCell(member.id, 4)}</td>
            <td>${weekCell(member.id, 5)}</td>
          </tr>
        `;
      })
      .join("") || `<tr><td colspan="9">아직 접속한 명단이 없습니다.</td></tr>`;
}

function renderSubmissions() {
  $("#submissionCountBadge").textContent = `${state.submissions.length}건`;
  $("#submissionsTable").innerHTML =
    state.submissions
      .map((item) => {
        const late = item.submittedDuringWeek > item.week;
        const content =
          item.mission === "mission1"
            ? `<a class="content-link" href="${item.url}" target="_blank" rel="noopener">${item.url}</a>`
            : "체류1분이상 · 좋아요 · 서이추 · 비밀댓글";
        return `
          <tr class="${late ? "late-row" : ""}">
            <td><span class="status-chip ${late ? "late" : "done"}">${late ? "빨간표시" : "정상"}</span></td>
            <td>${item.week}주차</td>
            <td>${missionLabel(item.mission)}</td>
            <td>${groupLabel(item.group)}</td>
            <td>${item.name}</td>
            <td>${fmtDate(item.submittedAt)}</td>
            <td>${item.submittedDuringWeek}주차</td>
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
  state.submissions = data.submissions;
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
    showToast(`${currentWeek}주차로 저장했습니다.`);
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
