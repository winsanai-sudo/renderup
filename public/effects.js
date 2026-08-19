(() => {
  "use strict";

  const canvas = document.querySelector("#ambientFx");
  const loginView = document.querySelector("#loginView");
  const title = document.querySelector(".login-copy h1");
  if (!canvas || !loginView) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)");
  const colors = ["94, 231, 255", "119, 255, 182", "255, 111, 145", "255, 209, 102"];
  const pointer = { x: innerWidth / 2, y: innerHeight / 2, active: false };
  const cursor = { x: pointer.x, y: pointer.y };

  let width = 0;
  let height = 0;
  let dpr = 1;
  let points = [];
  let frameId = 0;
  let lastFrame = 0;

  const cursorRing = document.createElement("div");
  cursorRing.className = "fx-cursor";
  cursorRing.setAttribute("aria-hidden", "true");
  document.body.append(cursorRing);

  function pointCount() {
    const areaCount = Math.floor((width * height) / 17000);
    return Math.max(24, Math.min(finePointer.matches ? 72 : 34, areaCount));
  }

  function makePoint(index) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.1 + Math.random() * 0.2;
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      phase: Math.random() * Math.PI * 2,
      color: colors[index % colors.length]
    };
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = pointCount();
    points = Array.from({ length: count }, (_, index) => points[index] || makePoint(index));
    points.forEach((point) => {
      point.x = Math.min(point.x, width);
      point.y = Math.min(point.y, height);
    });
  }

  function drawNetwork(now, animate = true) {
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";

    const linkDistance = finePointer.matches ? 122 : 94;
    const pointerDistance = finePointer.matches ? 210 : 130;

    points.forEach((point, index) => {
      if (animate) {
        point.x += point.vx;
        point.y += point.vy;

        if (point.x < -10) point.x = width + 10;
        if (point.x > width + 10) point.x = -10;
        if (point.y < -10) point.y = height + 10;
        if (point.y > height + 10) point.y = -10;

        if (pointer.active) {
          const dx = point.x - pointer.x;
          const dy = point.y - pointer.y;
          const distance = Math.hypot(dx, dy) || 1;
          if (distance < pointerDistance) {
            const force = (1 - distance / pointerDistance) * 0.035;
            point.x += (dx / distance) * force * 12;
            point.y += (dy / distance) * force * 12;

            ctx.beginPath();
            ctx.moveTo(pointer.x, pointer.y);
            ctx.lineTo(point.x, point.y);
            ctx.strokeStyle = `rgba(${point.color}, ${(1 - distance / pointerDistance) * 0.2})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      for (let next = index + 1; next < points.length; next += 1) {
        const other = points[next];
        const distance = Math.hypot(point.x - other.x, point.y - other.y);
        if (distance >= linkDistance) continue;
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(other.x, other.y);
        ctx.strokeStyle = `rgba(${point.color}, ${(1 - distance / linkDistance) * 0.12})`;
        ctx.lineWidth = 0.65;
        ctx.stroke();
      }

      const pulse = 1.1 + Math.sin(now * 0.0015 + point.phase) * 0.55;
      ctx.beginPath();
      ctx.arc(point.x, point.y, pulse, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${point.color}, 0.62)`;
      ctx.fill();
    });

    ctx.globalCompositeOperation = "source-over";
  }

  function animate(now) {
    frameId = requestAnimationFrame(animate);
    if (document.hidden || now - lastFrame < 24) return;
    lastFrame = now;

    drawNetwork(now);
    cursor.x += (pointer.x - cursor.x) * 0.2;
    cursor.y += (pointer.y - cursor.y) * 0.2;
    cursorRing.style.transform = `translate3d(${cursor.x}px, ${cursor.y}px, 0)`;
  }

  function syncViewMode() {
    document.body.classList.toggle("fx-mission-active", loginView.classList.contains("hidden"));
  }

  function makeClickPulse(event) {
    const pulse = document.createElement("span");
    pulse.className = "fx-click-pulse";
    pulse.style.left = `${event.clientX}px`;
    pulse.style.top = `${event.clientY}px`;
    document.body.append(pulse);
    pulse.addEventListener("animationend", () => pulse.remove(), { once: true });
  }

  function bindTilt(element) {
    element.classList.add("fx-tilt");
    element.addEventListener("pointermove", (event) => {
      if (!finePointer.matches || reducedMotion.matches) return;
      const rect = element.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      element.style.setProperty("--fx-rotate-x", `${(0.5 - y) * 3.2}deg`);
      element.style.setProperty("--fx-rotate-y", `${(x - 0.5) * 4}deg`);
      element.style.setProperty("--fx-shine-x", `${x * 100}%`);
      element.style.setProperty("--fx-shine-y", `${y * 100}%`);
    });
    element.addEventListener("pointerleave", () => {
      element.style.setProperty("--fx-rotate-x", "0deg");
      element.style.setProperty("--fx-rotate-y", "0deg");
    });
  }

  window.addEventListener("pointermove", (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
    cursorRing.classList.add("visible");
    if (title && !loginView.classList.contains("hidden")) {
      title.style.setProperty("--fx-title-x", `${(event.clientX / width) * 100}%`);
    }
  }, { passive: true });

  window.addEventListener("pointerout", (event) => {
    if (!event.relatedTarget) {
      pointer.active = false;
      cursorRing.classList.remove("visible");
    }
  });

  window.addEventListener("pointerover", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    cursorRing.classList.toggle("hot", Boolean(target?.closest("a, button, input, label")));
  }, { passive: true });

  window.addEventListener("pointerdown", (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
    cursorRing.classList.add("down");
    if (!reducedMotion.matches) makeClickPulse(event);
  }, { passive: true });

  window.addEventListener("pointerup", () => cursorRing.classList.remove("down"), { passive: true });
  window.addEventListener("resize", resize, { passive: true });

  new MutationObserver(syncViewMode).observe(loginView, { attributes: true, attributeFilter: ["class"] });
  document.querySelectorAll(".login-panel, .week-band, .mission-panel").forEach(bindTilt);

  resize();
  syncViewMode();
  if (reducedMotion.matches) {
    drawNetwork(performance.now(), false);
  } else {
    frameId = requestAnimationFrame(animate);
  }

  reducedMotion.addEventListener("change", () => {
    cancelAnimationFrame(frameId);
    if (reducedMotion.matches) {
      drawNetwork(performance.now(), false);
    } else {
      frameId = requestAnimationFrame(animate);
    }
  });
})();
