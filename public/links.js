const $ = (selector) => document.querySelector(selector);
const toast = $("#toast");
const singleGroup = document.body.dataset.cohort === "11";
const base = document.body.dataset.base;
const groupSessions = {
  junior: [
    "1주차 · 일요일",
    "2주차 · 일요일",
    "3주차 · 일요일",
    "4주차 · 일요일",
    "5주차 · 일요일"
  ].map((label, index) => ({ week: index + 1, label })),
  senior: [
    "1주차 · 일요일",
    "2주차 · 일요일",
    "3주차 · 일요일",
    "4주차 · 일요일",
    "5주차 · 일요일"
  ].map((label, index) => ({ week: index + 1, label }))
};

function showToast(text) {
  toast.textContent = text;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
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

function missionLabel(mission) {
  return "미션1";
}

function weekLabel(week) {
  return `${week}주차`;
}

function submissionWeekLabel(item) {
  return (groupSessions[item.group] || groupSessions.junior).find((session) => session.week === item.week)?.label || `${item.week}주차`;
}

function isLate(item) {
  return Number.isInteger(item.week) && item.submittedDuringWeek > item.week;
}

async function loadLinks() {
  const memberId = singleGroup ? null : localStorage.getItem("choblog10-member-id");
  if (!singleGroup && !memberId) {
    renderLoginRequired();
    return;
  }

  const week = $("#weekFilter").value;
  const params = new URLSearchParams();
  if (memberId) params.set("memberId", memberId);
  if (week !== "0") params.set("week", week);
  const response = await fetch(`${base}api/links?${params}`);
  if (singleGroup && response.status === 401) {
    renderLoginRequired();
    return;
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "링크를 불러오지 못했습니다.");
  }
  const data = await response.json();
  $("#linksScopeLabel").textContent = singleGroup ? "초블11기" : `${data.groupLabel || "우리 반"} 전용 링크`;
  renderLinks(data.submissions || []);
}

async function loadCurrentWeek() {
  const memberId = singleGroup ? null : localStorage.getItem("choblog10-member-id");
  if (!singleGroup && !memberId) {
    renderLoginRequired();
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const requestedWeek = params.get("week") || "";
  if (["1", "2", "3", "4", "5"].includes(requestedWeek)) {
    $("#weekFilter").value = requestedWeek;
    return;
  }

  const response = await fetch(singleGroup ? `${base}api/me` : `${base}api/links?memberId=${encodeURIComponent(memberId)}`);
  if (singleGroup && response.status === 401) return;
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "현재 회차를 불러오지 못했습니다.");
  }

  const data = await response.json();
  const currentWeek = Number(data.settings?.currentWeek || 1);
  if (currentWeek >= 1 && currentWeek <= 5) {
    $("#weekFilter").value = String(currentWeek);
  }
}

function renderLoginRequired() {
  $("#linksScopeLabel").textContent = "로그인 필요";
  $("#linksGrid").innerHTML = `
    <div class="empty-state">
      ${singleGroup ? "로그인하면 11기 선생님들의 글을 볼 수 있습니다." : "참가자 화면에서 이름과 핸드폰 번호로 로그인하면 같은 반 선생님들의 링크만 볼 수 있습니다."}
      <br /><br />
      <a class="content-link" href="${base}">참가자 화면으로 이동</a>
    </div>
  `;
}

function renderLinks(items) {
  const grid = $("#linksGrid");
  grid.replaceChildren();
  if (!items.length) {
    grid.innerHTML = '<div class="empty-state">아직 등록된 블로그 주소가 없습니다.</div>';
    return;
  }
  for (const item of items) {
    const card = document.createElement("article");
    card.className = "link-card";
    card.innerHTML = '<div class="section-heading"><h2></h2><span></span></div><p></p><a target="_blank" rel="noopener"></a>';
    card.querySelector("h2").textContent = item.name;
    card.querySelector("span").textContent = submissionWeekLabel(item);
    const group = singleGroup ? "" : `${groupLabel(item.group)} · `;
    card.querySelector("p").textContent = `${group}${missionLabel(item.mission)} · ${fmtDate(item.submittedAt)}${isLate(item) ? " · 지각" : ""}`;
    const link = card.querySelector("a");
    if (/^https?:\/\//i.test(item.url)) link.href = item.url;
    link.textContent = item.url;
    grid.append(card);
  }
}

$("#weekFilter").addEventListener("change", () => {
  const week = $("#weekFilter").value;
  const url = new URL(window.location.href);
  if (week !== "0") {
    url.searchParams.set("week", week);
  } else {
    url.searchParams.delete("week");
  }
  window.history.replaceState({}, "", url);
  loadLinks().catch((error) => {
    showToast(error.message || "링크를 불러오지 못했습니다.");
  });
});

loadCurrentWeek()
  .then(loadLinks)
  .catch((error) => {
    showToast(error.message || "링크를 불러오지 못했습니다.");
  });
