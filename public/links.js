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

async function loadLinks() {
  const week = Number($("#weekFilter").value);
  const response = await fetch(`/api/links${week ? `?week=${week}` : ""}`);
  const data = await response.json();
  renderLinks(data.submissions || []);
}

function renderLinks(items) {
  $("#linksGrid").innerHTML =
    items
      .map((item) => {
        const late = item.submittedDuringWeek > item.week;
        return `
          <article class="link-card">
            <div class="section-heading">
              <h2>${item.name}</h2>
              <span>${item.week}주차</span>
            </div>
            <p>${groupLabel(item.group)} · ${fmtDate(item.submittedAt)}${late ? " · 빨간표시" : ""}</p>
            <a href="${item.url}" target="_blank" rel="noopener">${item.url}</a>
          </article>
        `;
      })
      .join("") || `<div class="empty-state">아직 등록된 블로그 주소가 없습니다.</div>`;
}

$("#weekFilter").addEventListener("change", loadLinks);

loadLinks().catch((error) => {
  showToast(error.message || "링크를 불러오지 못했습니다.");
});
