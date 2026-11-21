const { cohort, base } = document.body.dataset;
const singleGroup = cohort === "11";
const masterKey = `choblog${cohort}-master-code`;
const orderedGroups = singleGroup ? ["all"] : ["senior", "junior"];

const state = {
  code: localStorage.getItem(masterKey) || "",
  settings: { currentWeek: 1 },
  roster: { junior: [], senior: [] },
  audits: {},
  members: [],
  submissions: [],
  reviewWeek: 1,
  settlementQuery: ""
};

const groupSessions = {
  junior: ["1주차 · 일요일", "2주차 · 일요일", "3주차 · 일요일", "4주차 · 일요일", "5주차 · 일요일"].map(
    (label, index) => ({ week: index + 1, label })
  ),
  senior: ["1주차 · 일요일", "2주차 · 일요일", "3주차 · 일요일", "4주차 · 일요일", "5주차 · 일요일"].map(
    (label, index) => ({ week: index + 1, label })
  )
};
let missionDates = [];
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
  const pathWithCode = `${base}${path.slice(1)}${joiner}code=${encodeURIComponent(state.code)}`;
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

function latestSubmissionsOnly(items) {
  const latestByMission = new Map();
  items.forEach((item) => {
    const key = `${item.group}|${item.name}|${item.week}|${item.mission}`;
    const current = latestByMission.get(key);
    if (!current || new Date(item.submittedAt) > new Date(current.submittedAt)) {
      latestByMission.set(key, item);
    }
  });
  return [...latestByMission.values()];
}

function setSubmissions(items) {
  state.submissions = latestSubmissionsOnly(
    (items || []).filter((item) => item.mission !== "examBlog")
  );
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
  const deadline = item && deadlineForWeek(item.week);
  return Boolean(deadline && !isAccepted(item, item.mission) && new Date(item.submittedAt) > deadline);
}

function submissionsFor(group, name, week) {
  return state.submissions
    .filter((item) => item.group === group && item.name === name && item.week === week)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
}

function submissionFor(group, name, week, mission) {
  return submissionsFor(group, name, week).find((item) => item.mission === mission);
}

function expectedMembers() {
  return orderedGroups.flatMap((group) =>
    (state.roster[group] || []).map((name) => ({
      group,
      name,
      member: state.members.find((item) => item.group === group && item.name === name) || null
    }))
  );
}

function failureRows(week) {
  if (!isClosedWeek(week)) return [];
  return expectedMembers()
    .map(({ group, name }) => {
      const mission1 = submissionFor(group, name, week, "mission1");
      const mission2 = submissionFor(group, name, week, "mission2");
      const complete = isAccepted(mission1, "mission1") && isAccepted(mission2, "mission2");
      const hasLate = isLate(mission1) || isLate(mission2);
      return { group, name, mission1, mission2, complete, hasLate };
    })
    .filter((item) => !item.complete)
    .sort((a, b) => orderedGroups.indexOf(a.group) - orderedGroups.indexOf(b.group) || Number(b.hasLate) - Number(a.hasLate) || a.name.localeCompare(b.name, "ko"));
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

function settlementMissionStatus(item, mission) {
  if (!item) return { label: "미제출", className: "late" };
  if (isOnTime(item)) return { label: "정상 제출", className: "done" };
  if (mission === "mission1" && item.postDateStatus === "matched") {
    return { label: `게시일 인정${item.postPublishedDate ? ` · ${item.postPublishedDate}` : ""}`, className: "win" };
  }
  if (mission === "mission1" && item.postDateStatus === "mismatch") {
    return { label: `게시일 불일치${item.postPublishedDate ? ` · ${item.postPublishedDate}` : ""}`, className: "late" };
  }
  if (mission === "mission1" && item.postDateStatus === "unavailable") {
    return { label: "게시일 확인 불가", className: "late" };
  }
  return { label: "마감 후 제출", className: "late" };
}

function settlementFailureReason(item, mission, week) {
  if (isAccepted(item, mission)) return "";
  if (!item) return mission === "mission1" ? "미션1 블로그 주소 미제출" : "미션2 체크 미제출";
  const timing = `제출 ${fmtDate(item.submittedAt)} / 마감 ${fmtDate(deadlineForWeek(week))}`;
  if (mission === "mission2") return `미션2 마감 후 제출 (${timing})`;
  if (item.postDateStatus === "mismatch") {
    const published = item.postPublishedDate || "확인된 날짜 없음";
    return `미션1 마감 후 제출 (${timing}) · 실제 게시일 ${published}, 미션일 ${missionDates[week - 1]}과 불일치`;
  }
  if (item.postDateStatus === "unavailable") {
    return `미션1 마감 후 제출 (${timing}) · 블로그 게시일 자동 확인 불가`;
  }
  return `미션1 마감 후 제출 (${timing}) · 게시일 인정 기록 없음`;
}

function settlementWeek(group, name, week) {
  const mission1 = submissionFor(group, name, week, "mission1");
  const mission2 = submissionFor(group, name, week, "mission2");
  const closed = isClosedWeek(week);
  const success = closed && isAccepted(mission1, "mission1") && isAccepted(mission2, "mission2");
  const reasons = closed
    ? [
        settlementFailureReason(mission1, "mission1", week),
        settlementFailureReason(mission2, "mission2", week)
      ].filter(Boolean)
    : [];
  const acceptedNotes = [
    mission1 && !isOnTime(mission1) && mission1.postDateStatus === "matched"
      ? `미션1 실제 게시일 ${mission1.postPublishedDate || missionDates[week - 1]} 인정`
      : ""
  ].filter(Boolean);
  return {
    week,
    closed,
    success,
    mission1,
    mission2,
    mission1Status: settlementMissionStatus(mission1, "mission1"),
    mission2Status: settlementMissionStatus(mission2, "mission2"),
    reason: closed
      ? (success ? ["두 미션 모두 인정", ...acceptedNotes].join(" · ") : reasons.join(" · "))
      : "아직 마감되지 않은 주차"
  };
}

function settlementFor(group, name) {
  const weeks = allWeeks.map((week) => settlementWeek(group, name, week));
  return {
    group,
    name,
    member: state.members.find((item) => item.group === group && item.name === name) || null,
    weeks,
    successCount: weeks.filter((item) => item.success).length,
    failureCount: weeks.filter((item) => item.closed && !item.success).length
  };
}

function settlementMissionCell(item, status, includeLink = false) {
  const link = includeLink && item?.url
    ? `<a class="settlement-blog-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">글 열기</a>`
    : "";
  return `<span class="status-chip ${status.className}">${escapeHtml(status.label)}</span>${link}`;
}

function settlementSummaryText(settlement) {
  const lines = [
    `초블${cohort}기 개인 정산 · ${settlement.name}${singleGroup ? "" : ` (${groupLabel(settlement.group)})`}`,
    `성공 ${settlement.successCount}주 / 실패 ${settlement.failureCount}주`
  ];
  settlement.weeks.forEach((item) => {
    const result = item.closed ? (item.success ? "성공" : "실패") : "진행 중";
    lines.push(`${item.week}주차 ${result} · ${item.reason}`);
  });
  return lines.join("\n");
}

function renderSettlements() {
  const settlements = expectedMembers().map(({ group, name }) => settlementFor(group, name));
  const query = state.settlementQuery.trim().replaceAll(" ", "").toLocaleLowerCase("ko-KR");
  const filtered = settlements.filter((item) =>
    item.name.replaceAll(" ", "").toLocaleLowerCase("ko-KR").includes(query)
  );

  $("#settlementNameList").innerHTML = [...new Set(settlements.map((item) => item.name))]
    .map((name) => `<option value="${escapeHtml(name)}"></option>`)
    .join("");
  $("#settlementCount").textContent = query
    ? `전체 ${settlements.length}명 중 ${filtered.length}명 검색`
    : `전체 ${settlements.length}명`;

  $("#settlementResults").innerHTML = filtered.length
    ? filtered
        .map((item) => `
          <article class="settlement-card">
            <header class="settlement-card-header">
              <div class="settlement-person">
                ${singleGroup ? "" : `<span>${groupLabel(item.group)}</span>`}
                <h3>${escapeHtml(item.name)}</h3>
                <small>${escapeHtml(item.member?.phoneMasked || "미접속")}</small>
              </div>
              <div class="settlement-summary">
                <span class="settlement-total success">성공 <strong>${item.successCount}</strong>주</span>
                <span class="settlement-total failure">실패 <strong>${item.failureCount}</strong>주</span>
                <button class="ghost-btn small-btn settlement-copy-btn" type="button" data-group="${escapeHtml(item.group)}" data-name="${escapeHtml(item.name)}">개인 정산 복사</button>
              </div>
            </header>
            <div class="table-wrap settlement-table">
              <table>
                <thead>
                  <tr>
                    <th>주차</th>
                    <th>정산 결과</th>
                    <th>미션1</th>
                    <th>미션2</th>
                    <th>실패 이유 / 확인 내용</th>
                  </tr>
                </thead>
                <tbody>
                  ${item.weeks.map((weekItem) => `
                    <tr class="${weekItem.closed && !weekItem.success ? "settlement-failure-row" : ""}">
                      <td><strong>${weekItem.week}주차</strong></td>
                      <td><span class="status-chip ${!weekItem.closed ? "pending" : weekItem.success ? "done" : "late"}">${!weekItem.closed ? "진행 중" : weekItem.success ? "성공" : "실패"}</span></td>
                      <td>${settlementMissionCell(weekItem.mission1, weekItem.mission1Status, true)}</td>
                      <td>${settlementMissionCell(weekItem.mission2, weekItem.mission2Status)}</td>
                      <td class="settlement-reason ${weekItem.success ? "success" : ""}">${escapeHtml(weekItem.reason)}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </article>
        `)
        .join("")
    : `<div class="empty-state">${settlements.length ? "검색한 이름과 일치하는 선생님이 없습니다." : "아직 등록된 참가자가 없습니다."}</div>`;
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadSettlementCsv() {
  const header = [...(singleGroup ? [] : ["팀"]), "이름", "전화번호", "주차", "정산 결과", "미션1", "미션2", "실패 이유 또는 확인 내용", "블로그 주소", "미션1 제출 시간", "미션2 제출 시간"];
  const rows = expectedMembers().flatMap(({ group, name }) => {
    const settlement = settlementFor(group, name);
    return settlement.weeks.map((item) => [
      ...(singleGroup ? [] : [groupLabel(group)]),
      name,
      settlement.member?.phoneMasked || "미접속",
      `${item.week}주차`,
      item.closed ? (item.success ? "성공" : "실패") : "진행 중",
      item.mission1Status.label,
      item.mission2Status.label,
      item.reason,
      item.mission1?.url || "",
      item.mission1?.submittedAt ? fmtDate(item.mission1.submittedAt) : "",
      item.mission2?.submittedAt ? fmtDate(item.mission2.submittedAt) : ""
    ]);
  });
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `초블${cohort}기_개인별_1-5주차_정산.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("전체 개인 정산 CSV를 내려받았습니다.");
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
  const deadline = deadlineForWeek(week);
  const columns = singleGroup ? 5 : 6;
  if (!deadline) {
    $("#auditStatus").textContent = "첫 미션 일정이 아직 등록되지 않았습니다.";
  } else if (!isClosedWeek(week)) {
    $("#auditStatus").textContent = `${week}주차는 ${fmtDate(deadline)} 이후에 자동으로 점검됩니다.`;
  } else if (audit) {
    $("#auditStatus").textContent = `${fmtDate(audit.ranAt)} 점검 · 늦은 블로그 ${audit.checkedBlogCount}건 확인 · 게시일 인정 ${audit.matchedBlogCount}건`;
  } else {
    $("#auditStatus").textContent = "마감 점검을 준비하고 있습니다.";
  }

  if (!isClosedWeek(week)) {
    $("#failuresTable").innerHTML = `<tr><td colspan="${columns}">마감 후 보완 대상이 표시됩니다.</td></tr>`;
    return;
  }

  $("#failuresTable").innerHTML = orderedGroups
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
                  ${singleGroup ? "" : `<td>${groupLabel(item.group)}</td>`}
                  <td><strong>${escapeHtml(item.name)}</strong></td>
                  <td>${missionStatus(item.mission1, "mission1")}</td>
                  <td>${missionStatus(item.mission2, "mission2")}</td>
                  <td>${blog}</td>
                </tr>
              `;
            })
            .join("")
        : `<tr><td colspan="${columns}">보완 대상이 없습니다.</td></tr>`;

      if (singleGroup) return groupRows;

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
        ${singleGroup ? "" : `<td>${groupLabel(group)}</td>`}
        <td>${escapeHtml(name)}</td>
        <td>${escapeHtml(member?.phoneMasked || "미접속")}</td>
        <td><strong>${successCount(group, name)}/5</strong></td>
        ${allWeeks.map((week) => `<td>${weekCell(group, name, week)}</td>`).join("")}
      </tr>
    `)
    .join("") || `<tr><td colspan="${singleGroup ? 8 : 9}">아직 등록된 참가자가 없습니다.</td></tr>`;
}

function renderSubmissions() {
  $("#submissionCountBadge").textContent = `${state.submissions.length}건`;
  const groupedRows = orderedGroups
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
            ${singleGroup ? "" : `<td>${groupLabel(item.group)}</td>`}
            <td>${escapeHtml(item.name)}</td>
            <td>${fmtDate(item.submittedAt)}</td>
            <td>${escapeHtml(item.submittedDuringWeek)}주차</td>
            <td>${content}</td>
          </tr>
        `;
      }).join("");

      if (singleGroup) return rows;
      return `
        <tr class="submission-group-row">
          <td colspan="8"><strong>${groupLabel(group)}</strong><span>${items.length}건</span></td>
        </tr>
        ${rows}
      `;
    })
    .join("");

  $("#submissionsTable").innerHTML = groupedRows || `<tr><td colspan="${singleGroup ? 7 : 8}">아직 제출 데이터가 없습니다.</td></tr>`;
}

function render() {
  $("#currentWeekLabel").textContent = singleGroup && !missionDates.length ? "일정 미정" : `${state.settings.currentWeek || 1}주차`;
  $("#reviewWeekSelect").value = String(state.reviewWeek);
  renderKpis();
  renderSettlements();
  renderFailures();
  renderMembers();
  renderSubmissions();
}

async function loadAdmin() {
  const data = await api("/api/admin");
  state.settings = data.settings;
  missionDates = (singleGroup ? data.groupSchedules?.all : data.groupSchedules?.junior) || [];
  state.roster = data.roster || state.roster;
  state.audits = data.audits || {};
  state.members = data.members || [];
  setSubmissions(data.submissions);
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
    localStorage.setItem(masterKey, state.code);
    showToast("마스터 접속 완료");
  } catch (error) {
    showMessage($("#adminLoginMessage"), error.message, "error");
  }
});

$("#reviewWeekSelect").addEventListener("change", () => {
  state.reviewWeek = Number($("#reviewWeekSelect").value);
  renderFailures();
});

$("#settlementSearchInput").addEventListener("input", (event) => {
  state.settlementQuery = event.target.value;
  renderSettlements();
});

$("#downloadSettlementBtn").addEventListener("click", downloadSettlementCsv);

$("#settlementResults").addEventListener("click", async (event) => {
  const button = event.target.closest(".settlement-copy-btn");
  if (!button) return;
  const settlement = settlementFor(button.dataset.group, button.dataset.name);
  const summary = settlementSummaryText(settlement);
  try {
    await navigator.clipboard.writeText(summary);
    showToast(`${settlement.name} 정산 내용을 복사했습니다.`);
  } catch {
    showToast("정산 내용 복사에 실패했습니다.");
  }
});

$("#refreshAuditBtn").addEventListener("click", async () => {
  try {
    const data = await api("/api/admin/audit", { method: "POST", body: "{}" });
    state.settings = data.settings || state.settings;
    state.audits = data.audits || state.audits;
    setSubmissions(data.submissions || state.submissions);
    render();
    showToast(data.message);
  } catch (error) {
    showToast(error.message);
  }
});

$("#copyLinksBtn").addEventListener("click", async () => {
  const url = `${window.location.origin}${base}links.html`;
  try {
    await navigator.clipboard.writeText(url);
    showToast("방문 링크 페이지 주소를 복사했습니다.");
  } catch {
    showToast(url);
  }
});

$("#resetBtn").addEventListener("click", async () => {
  const confirmText = window.prompt(`${cohort}기 명단 접속 기록과 제출 데이터를 모두 삭제하려면 RESET을 입력하세요.`);
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
  localStorage.removeItem(masterKey);
  state.code = "";
  $("#adminView").classList.add("hidden");
  $("#adminLogin").classList.remove("hidden");
});

if (state.code) {
  $("#masterCodeInput").value = state.code;
  loadAdmin().catch(() => {
    localStorage.removeItem(masterKey);
    state.code = "";
  });
}
