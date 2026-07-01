const $ = (selector) => document.querySelector(selector);
const toast = $("#toast");

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
  return group === "senior" ? "시니어" : "주니어";
}

function missionLabel(mission) {
  return mission === "examBlog" ? "시험기간 긴급" : "미션1";
}

function weekLabel(week) {
  return week === "exam" ? "시험기간" : `${week}주차`;
}

function isLate(item) {
  return Number.isInteger(item.week) && item.submittedDuringWeek > item.week;
}

async function loadLinks() {
  const week = $("#weekFilter").value;
  const response = await fetch(`/api/links${week !== "0" ? `?week=${encodeURIComponent(week)}` : ""}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "링크를 불러오지 못했습니다.");
  }
  const data = await response.json();
  renderLinks(data.submissions || []);
}

async function loadCurrentWeek() {
  const params = new URLSearchParams(window.location.search);
  const requestedWeek = params.get("week") || "";
  if (requestedWeek === "exam" || ["1", "2", "3", "4", "5"].includes(requestedWeek)) {
    $("#weekFilter").value = requestedWeek;
    return;
  }

  const response = await fetch("/api/links");
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "현재 주차를 불러오지 못했습니다.");
  }

  const data = await response.json();
  const currentWeek = Number(data.settings?.currentWeek || 1);
  if (currentWeek >= 1 && currentWeek <= 5) {
    $("#weekFilter").value = String(currentWeek);
  }
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
              <span>${weekLabel(item.week)}</span>
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
