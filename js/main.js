const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const root = document.documentElement;

/* ---------- Theme ---------- */
function currentTheme() {
  return root.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
}

function syncToggleLabel() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.querySelector("[data-theme-toggle]")?.setAttribute("aria-label", `Switch to ${next} theme`);
}

document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
  const next = currentTheme() === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch (e) {}
  syncToggleLabel();
});
syncToggleLabel();

/* ---------- Hero cursor glow ---------- */
const hero = document.querySelector(".hero");
if (hero && !reduceMotion) {
  hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    hero.style.setProperty("--mx", `${e.clientX - r.left}px`);
    hero.style.setProperty("--my", `${e.clientY - r.top}px`);
  });
}

/* ---------- Project cards ---------- */
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

function renderPreview(container, p) {
  if (p.preview) {
    const img = el("img");
    img.src = p.preview;
    img.alt = p.previewAlt || `Screenshot of ${p.title}`;
    img.loading = "lazy";
    img.decoding = "async";
    img.width = 960;
    img.height = 540;
    // If the screenshot is missing, fall back to the generated terminal preview.
    img.addEventListener("error", () => { img.remove(); container.append(terminalPreview(p)); });
    container.append(img);
  } else {
    container.append(terminalPreview(p));
  }
}

function terminalPreview(p) {
  const term = el("div", "term");
  term.setAttribute("aria-hidden", "true");
  term.append(el("div", "term__line", p.command || `git clone ${p.repo}`));
  term.append(el("div", "term__out", `# ${p.tags.slice(0, 3).join(" · ")}`));
  return term;
}

function renderCard(p, tpl) {
  const card = tpl.content.firstElementChild.cloneNode(true);
  renderPreview(card.querySelector(".card__preview"), p);
  card.querySelector(".card__title").textContent = p.title;
  card.querySelector(".card__summary").textContent = p.summary;

  const badges = card.querySelector(".card__badges");
  for (const b of p.badges || []) {
    const li = el("li");
    const a = el("a", "badge", b.label);
    a.href = b.source;
    a.target = "_blank";
    a.rel = "noopener";
    a.title = "Verify on GitHub";
    li.append(a);
    badges.append(li);
  }

  const tags = card.querySelector(".card__tags");
  for (const t of p.tags) tags.append(el("li", null, t));

  const repo = card.querySelector(".card__repo");
  repo.href = p.repo;
  repo.setAttribute("aria-label", `View ${p.title} on GitHub (opens in a new tab)`);

  if (p.demo) {
    const demo = el("a", "btn btn--sm", "Live demo ↗");
    demo.href = p.demo;
    demo.target = "_blank";
    demo.rel = "noopener";
    demo.setAttribute("aria-label", `Open the ${p.title} live demo (opens in a new tab)`);
    card.querySelector(".card__actions").append(demo);
  }
  return card;
}

async function loadProjects() {
  const tpl = document.getElementById("card-tpl");
  const grids = document.querySelectorAll("[data-projects]");
  try {
    const res = await fetch("data/projects.json");
    if (!res.ok) throw new Error(res.status);
    const projects = await res.json();

    for (const grid of grids) {
      const secondary = grid.hasAttribute("data-secondary");
      const list = projects.filter((p) => p.stack === grid.dataset.projects && !!p.secondary === secondary);
      grid.replaceChildren(...list.map((p) => renderCard(p, tpl)));
      if (!list.length) grid.closest("details")?.remove();
    }
    observeReveal(document.querySelectorAll(".card"));
    return projects;
  } catch (err) {
    const grid = grids[0];
    grid.replaceChildren(el("p", "mono muted",
      "Could not load data/projects.json. Serve the folder over HTTP: python3 -m http.server"));
    return [];
  }
}

/* ---------- Reveal on scroll ---------- */
function observeReveal(nodes) {
  if (reduceMotion || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    }
  }, { rootMargin: "0px 0px -8% 0px" });
  nodes.forEach((n, i) => {
    n.classList.add("reveal");
    n.style.transitionDelay = `${(i % 3) * 80}ms`;
    io.observe(n);
  });
}

/* ---------- Boot log ---------- */
// Every number printed here is computed from projects.json, so the log never claims more than the data.
function bootLines(projects) {
  const ci = projects.filter((p) => (p.badges || []).some((b) => b.label.startsWith("CI"))).length;
  const badges = projects.reduce((n, p) => n + (p.badges || []).length, 0);
  // Short enough to fit one line at 375px.
  const dots = (label) => `${label} `.padEnd(14, ".");
  return [
    ["cmd", "$ ./load_profile --user demianc14"],
    ["ok", `✓ ${dots("profile")} Quito, EC · CS @ USFQ`],
    ["ok", `✓ ${dots("projects")} ${projects.length} loaded`],
    ["ok", `✓ ${dots("ci")} ${ci} pipelines linked`],
    ["ok", `✓ ${dots("badges")} ${badges} verifiable, 0 invented`],
  ];
}

function writeLog(lines) {
  const log = document.querySelector("[data-log]");
  if (!log) return;

  const paint = (n, partial) => {
    log.replaceChildren();
    lines.slice(0, n).forEach(([cls, text]) => log.append(el("span", cls, text), "\n"));
    if (partial) log.append(el("span", partial[0], partial[1]));
    log.append(el("span", "cursor", " "));
  };

  if (reduceMotion) { paint(lines.length); return; }

  let line = 0, ch = 0;
  const tick = () => {
    if (line >= lines.length) return;
    const [cls, text] = lines[line];
    // Type the command; print status lines a chunk at a time, like real output.
    ch += cls === "cmd" ? 1 : 6;
    if (ch >= text.length) { line++; ch = 0; paint(line); setTimeout(tick, cls === "cmd" ? 260 : 140); }
    else { paint(line, [cls, text.slice(0, ch)]); setTimeout(tick, cls === "cmd" ? 28 : 16); }
  };
  tick();
}

document.querySelector("[data-year]").textContent = new Date().getFullYear();
loadProjects().then((projects) => writeLog(bootLines(projects)));
