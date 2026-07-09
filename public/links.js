const $ = (selector) => document.querySelector(selector);
const toast = $("#toast");
const groupSessions = {
  weekly1: [1, 2, 3, 4, 5].map((week) => ({ week, label: `${week}주차` })),
  weekly2: [
    "1회차 · 일요일",
    "2회차 · 수요일",
    "3회차 · 일요일",
    "4회차 · 수요일",
    "5회차 · 일요일",
    "6회차 · 수요일",
    "7회차 · 일요일",
    "8회차 · 수요일",
    "9회차 · 일요일"
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
  return group === "weekly2" ? "주2회반" : "주1회반";
}

function missionLabel(mission) {
  return mission === "examBlog" ? "시험기간 긴급" : "미션1";
}

function weekLabel(week) {
  return week === "exam" ? "시험기간" : `${week}주차`;
}

function submissionWeekLabel(item) {
  if (item.week === "exam") return "시험기간";
  return (groupSessions[item.group] || groupSessions.weekly1).find((session) => session.week === item.week)?.label || `${item.week}회차`;
}

function isLate(item) {
  return Number.isInteger(item.week) && item.submittedDuringWeek > item.week;
}

async function loadLinks() {
  const memberId = localStorage.getItem("choblog-member-id");
  if (!memberId) {
    renderLoginRequired();
    return;
  }

  const week = $("#weekFilter").value;
  const params = new URLSearchParams({ memberId });
  if (week !== "0") params.set("week", week);
  const response = await fetch(`/api/links?${params}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "링크를 불러오지 못했습니다.");
  }
  const data = await response.json();
  $("#linksScopeLabel").textContent = `${data.groupLabel || "우리 반"} 전용 링크`;
  renderLinks(data.submissions || []);
}

async function loadCurrentWeek() {
  const memberId = localStorage.getItem("choblog-member-id");
  if (!memberId) {
    renderLoginRequired();
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const requestedWeek = params.get("week") || "";
  if (requestedWeek === "exam" || ["1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(requestedWeek)) {
    $("#weekFilter").value = requestedWeek;
    return;
  }

  const response = await fetch(`/api/links?memberId=${encodeURIComponent(memberId)}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "현재 회차를 불러오지 못했습니다.");
  }

  const data = await response.json();
  const currentWeek = Number(data.settings?.currentWeek || 1);
  if (currentWeek >= 1 && currentWeek <= 9) {
    $("#weekFilter").value = String(currentWeek);
  }
}

function renderLoginRequired() {
  $("#linksScopeLabel").textContent = "로그인 필요";
  $("#linksGrid").innerHTML = `
    <div class="empty-state">
      참가자 화면에서 이름과 핸드폰 번호로 로그인하면 같은 반 선생님들의 링크만 볼 수 있습니다.
      <br /><br />
      <a class="content-link" href="/">참가자 화면으로 이동</a>
    </div>
  `;
}

function renderLinks(items) {
  $("#linksGrid").innerHTML =
    items
      .map((item) => {
        const late = isLate(item);
        return `
          <article class="link-card">
            <div class="section-heading">
              <h2>${item.name}</h2>
              <span>${submissionWeekLabel(item)}</span>
            </div>
            <p>${groupLabel(item.group)} · ${missionLabel(item.mission)} · ${fmtDate(item.submittedAt)}${late ? " · 빨간표시" : ""}</p>
            <a href="${item.url}" target="_blank" rel="noopener">${item.url}</a>
          </article>
        `;
      })
      .join("") || `<div class="empty-state">아직 등록된 블로그 주소가 없습니다.</div>`;
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
