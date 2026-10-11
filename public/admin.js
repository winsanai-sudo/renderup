const state = {
  code: localStorage.getItem("choblog10-master-code") || "",
  settings: { currentWeek: 1 },
  roster: { junior: [], senior: [] },
  audits: {},
  members: [],
  submissions: [],
  reviewWeek: 1
};

const groupSessions = {
  junior: ["1주차 · 일요일", "2주차 · 일요일", "3주차 · 일요일", "4주차 · 일요일", "5주차 · 일요일"].map(
    (label, index) => ({ week: index + 1, label })
  ),
  senior: ["1주차 · 일요일", "2주차 · 일요일", "3주차 · 일요일", "4주차 · 일요일", "5주차 · 일요일"].map(
    (label, index) => ({ week: index + 1, label })
  )
};
const missionDates = ["2026-10-11", "2026-10-18", "2026-10-25", "2026-11-01", "2026-11-08"];
const allWeeks = [1, 2, 3, 4, 5];

const $ = (selector) => document.querySelector(selector);
const toast = $("#toast");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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
  return group === "senior" ? "시니어 팀" : "주니어 팀";
}

function sessionsFor(group) {
  return groupSessions[group] || groupSessions.junior;
}

function missionLabel(mission) {
  return mission === "mission1" ? "미션1" : "미션2";
}

function submissionWeekLabel(item) {
  return sessionsFor(item.group).find((session) => session.week === item.week)?.label || `${item.week}주차`;
}

function deadlineForWeek(week) {
  const missionDate = missionDates[week - 1];
  if (!missionDate) return null;
  return new Date(new Date(`${missionDate}T23:59:59+09:00`).getTime() + 24 * 60 * 60 * 1000);
}

function isClosedWeek(week) {
  const deadline = deadlineForWeek(week);
  return Boolean(deadline && new Date() >= deadline);
}

function isOnTime(item) {
  const deadline = item && deadlineForWeek(item.week);
  return Boolean(item && deadline && new Date(item.submittedAt) <= deadline);
}

function isAccepted(item, mission) {
  if (!item) return false;
  if (isOnTime(item)) return true;
  return mission === "mission1" && item.postDateStatus === "matched";
}

function isLate(item) {
  return Boolean(item && !isAccepted(item, item.mission) && new Date(item.submittedAt) > deadlineForWeek(item.week));
}

function submissionsFor(group, name, week) {
  return state.submissions
    .filter((item) => item.group === group && item.name === name && item.week === week)
    .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
}

function submissionFor(group, name, week, mission) {
  return submissionsFor(group, name, week).find((item) => item.mission === mission);
}

function expectedMembers() {
  return ["senior", "junior"].flatMap((group) =>
    (state.roster[group] || []).map((name) => ({
      group,
      name,
      member: state.members.find((item) => item.group === group && item.name === name) || null
    }))
  );
}

function failureRows(week) {
  if (!isClosedWeek(week)) return [];
  const groupOrder = { senior: 0, junior: 1 };
  return expectedMembers()
    .map(({ group, name }) => {
      const mission1 = submissionFor(group, name, week, "mission1");
      const mission2 = submissionFor(group, name, week, "mission2");
      const complete = isAccepted(mission1, "mission1") && isAccepted(mission2, "mission2");
      const hasLate = isLate(mission1) || isLate(mission2);
      return { group, name, mission1, mission2, complete, hasLate };
    })
    .filter((item) => !item.complete)
    .sort((a, b) => groupOrder[a.group] - groupOrder[b.group] || Number(b.hasLate) - Number(a.hasLate) || a.name.localeCompare(b.name, "ko"));
}

function missionStatus(item, mission) {
  if (!item) return '<span class="status-chip late">미제출</span>';
  if (isOnTime(item)) return '<span class="status-chip done">완료</span>';
  if (mission === "mission1" && item.postDateStatus === "matched") {
    return `<span class="status-chip win">게시일 인정</span><small class="status-detail">${escapeHtml(item.postPublishedDate)}</small>`;
  }
  if (mission === "mission1" && item.postDateStatus === "mismatch") {
    return `<span class="status-chip late">지각</span><small class="status-detail">게시일 ${escapeHtml(item.postPublishedDate)}</small>`;
  }
  if (mission === "mission1" && item.postDateStatus === "unavailable") {
    return '<span class="status-chip late">지각</span><small class="status-detail">게시일 확인 필요</small>';
  }
  return '<span class="status-chip late">지각 제출</span>';
}

function successCount(group, name) {
  return allWeeks.filter((week) => {
    const mission1 = submissionFor(group, name, week, "mission1");
    const mission2 = submissionFor(group, name, week, "mission2");
    return isAccepted(mission1, "mission1") && isAccepted(mission2, "mission2");
  }).length;
}

function weekCell(group, name, week) {
  const mission1 = submissionFor(group, name, week, "mission1");
  const mission2 = submissionFor(group, name, week, "mission2");
  const m1 = isAccepted(mission1, "mission1");
  const m2 = isAccepted(mission2, "mission2");
  const late = isLate(mission1) || isLate(mission2);
  const cls = m1 && m2 ? "complete" : m1 || m2 ? "partial" : "";
  const label = m1 && m2 ? "성공" : m1 ? "M1" : m2 ? "M2" : "-";
  return `<span class="week-cell ${cls} ${late ? "late" : ""}">${label}${late ? " · 지각" : ""}</span>`;
}

function renderKpis() {
  const latestClosedWeek = [...allWeeks].reverse().find(isClosedWeek) || 1;
  const failures = failureRows(latestClosedWeek);
  const recognized = state.submissions.filter((item) => item.postDateStatus === "matched").length;
  const rosterCount = Object.values(state.roster).reduce((sum, names) => sum + names.length, 0);
  $("#kpiGrid").innerHTML = [
    ["전체 명단", `${rosterCount}명`],
    ["접속 완료", `${state.members.length}명`],
    [`${latestClosedWeek}주차 보완`, isClosedWeek(latestClosedWeek) ? `${failures.length}명` : "마감 전"],
    ["게시일 인정", `${recognized}건`],
    ["전체 제출", `${state.submissions.length}건`]
  ]
    .map(([label, value]) => `<article class="kpi-card"><span>${label}</span><strong>${value}</strong></article>`)
    .join("");
}

function renderFailures() {
  const week = state.reviewWeek;
  const rows = failureRows(week);
  const audit = state.audits?.[week];
  if (!isClosedWeek(week)) {
    $("#auditStatus").textContent = `${week}주차는 ${fmtDate(deadlineForWeek(week))} 이후에 자동으로 점검됩니다.`;
  } else if (audit) {
    $("#auditStatus").textContent = `${fmtDate(audit.ranAt)} 점검 · 늦은 블로그 ${audit.checkedBlogCount}건 확인 · 게시일 인정 ${audit.matchedBlogCount}건`;
  } else {
    $("#auditStatus").textContent = "마감 점검을 준비하고 있습니다.";
  }

  if (!isClosedWeek(week)) {
    $("#failuresTable").innerHTML = '<tr><td colspan="6">마감 후 시니어 팀과 주니어 팀의 보완 대상이 표시됩니다.</td></tr>';
    return;
  }

  $("#failuresTable").innerHTML = ["senior", "junior"]
    .map((group) => {
      const items = rows.filter((item) => item.group === group);
      const groupRows = items.length
        ? items
            .map((item) => {
              const blog = item.mission1?.url
                ? `<a class="content-link" href="${escapeHtml(item.mission1.url)}" target="_blank" rel="noopener">글 확인</a>`
                : "-";
              return `
                <tr class="${item.hasLate ? "late-row" : ""}">
                  <td><span class="status-chip ${item.hasLate ? "late" : "pending"}">${item.hasLate ? "지각 우선" : "미제출"}</span></td>
                  <td>${groupLabel(item.group)}</td>
                  <td><strong>${escapeHtml(item.name)}</strong></td>
                  <td>${missionStatus(item.mission1, "mission1")}</td>
                  <td>${missionStatus(item.mission2, "mission2")}</td>
                  <td>${blog}</td>
                </tr>
              `;
            })
            .join("")
        : '<tr><td colspan="6">보완 대상이 없습니다.</td></tr>';

      return `
        <tr class="submission-group-row">
          <td colspan="6"><strong>${groupLabel(group)}</strong><span>${items.length}명</span></td>
        </tr>
        ${groupRows}
      `;
    })
    .join("");
}

function renderMembers() {
  const members = expectedMembers();
  $("#memberCountBadge").textContent = `${members.length}명`;
  $("#membersTable").innerHTML = members
    .map(({ group, name, member }) => `
      <tr>
        <td>${groupLabel(group)}</td>
        <td>${escapeHtml(name)}</td>
        <td>${escapeHtml(member?.phoneMasked || "미접속")}</td>
        <td><strong>${successCount(group, name)}/5</strong></td>
        ${allWeeks.map((week) => `<td>${weekCell(group, name, week)}</td>`).join("")}
      </tr>
    `)
    .join("");
}

function renderSubmissions() {
  $("#submissionCountBadge").textContent = `${state.submissions.length}건`;
  const groupOrder = ["senior", "junior"];
  const groupedRows = groupOrder
    .map((group) => {
      const items = state.submissions
        .filter((item) => item.group === group)
        .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
      if (!items.length) return "";

      const rows = items.map((item) => {
        const late = isLate(item);
        const recognized = item.mission === "mission1" && item.postDateStatus === "matched" && !isOnTime(item);
        const content = item.mission === "mission1"
          ? `<a class="content-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.url)}</a>`
          : "체류1분이상 · 좋아요 · 서이추 · 비밀댓글";
        return `
          <tr class="${late ? "late-row" : ""}">
            <td><span class="status-chip ${late ? "late" : recognized ? "win" : "done"}">${late ? "지각" : recognized ? "게시일 인정" : "정상"}</span></td>
            <td>${submissionWeekLabel(item)}</td>
            <td>${missionLabel(item.mission)}</td>
            <td>${groupLabel(item.group)}</td>
            <td>${escapeHtml(item.name)}</td>
            <td>${fmtDate(item.submittedAt)}</td>
            <td>${escapeHtml(item.submittedDuringWeek)}주차</td>
            <td>${content}</td>
          </tr>
        `;
      }).join("");

      return `
        <tr class="submission-group-row">
          <td colspan="8"><strong>${groupLabel(group)}</strong><span>${items.length}건</span></td>
        </tr>
        ${rows}
      `;
    })
    .join("");

  $("#submissionsTable").innerHTML = groupedRows || '<tr><td colspan="8">아직 제출 데이터가 없습니다.</td></tr>';
}

function render() {
  $("#currentWeekLabel").textContent = `${state.settings.currentWeek || 1}주차`;
  $("#reviewWeekSelect").value = String(state.reviewWeek);
  renderKpis();
  renderFailures();
  renderMembers();
  renderSubmissions();
}

async function loadAdmin() {
  const data = await api("/api/admin");
  state.settings = data.settings;
  state.roster = data.roster || state.roster;
  state.audits = data.audits || {};
  state.members = data.members || [];
  state.submissions = (data.submissions || []).filter((item) => item.mission !== "examBlog");
  state.reviewWeek = [...allWeeks].reverse().find(isClosedWeek) || 1;
  $("#adminLogin").classList.add("hidden");
  $("#adminView").classList.remove("hidden");
  render();
}

$("#adminLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  state.code = $("#masterCodeInput").value.trim();
  try {
    await loadAdmin();
    localStorage.setItem("choblog10-master-code", state.code);
    showToast("마스터 접속 완료");
  } catch (error) {
    showMessage($("#adminLoginMessage"), error.message, "error");
  }
});

$("#reviewWeekSelect").addEventListener("change", () => {
  state.reviewWeek = Number($("#reviewWeekSelect").value);
  renderFailures();
});

$("#refreshAuditBtn").addEventListener("click", async () => {
  try {
    const data = await api("/api/admin/audit", { method: "POST", body: "{}" });
    state.settings = data.settings || state.settings;
    state.audits = data.audits || state.audits;
    state.submissions = data.submissions || state.submissions;
    render();
    showToast(data.message);
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
  const confirmText = window.prompt("10기 명단 접속 기록과 제출 데이터를 모두 삭제하려면 RESET을 입력하세요.");
  if (confirmText !== "RESET") return;
  try {
    await api("/api/admin/reset", { method: "POST", body: JSON.stringify({ confirm: "RESET" }) });
    state.members = [];
    state.submissions = [];
    state.audits = {};
    render();
    showToast("초기화 완료");
  } catch (error) {
    showToast(error.message);
  }
});

$("#adminLogoutBtn").addEventListener("click", () => {
  localStorage.removeItem("choblog10-master-code");
  state.code = "";
  $("#adminView").classList.add("hidden");
  $("#adminLogin").classList.remove("hidden");
});

if (state.code) {
  $("#masterCodeInput").value = state.code;
  loadAdmin().catch(() => {
    localStorage.removeItem("choblog10-master-code");
    state.code = "";
  });
}
