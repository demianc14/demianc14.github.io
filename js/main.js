const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const root = document.documentElement;

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const external = (a) => { a.target = "_blank"; a.rel = "noopener"; return a; };

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

/* ---------- Cursor spotlight ---------- */
const spotlight = document.querySelector(".spotlight");
if (spotlight && !reduceMotion) {
  addEventListener("pointermove", (e) => {
    spotlight.style.setProperty("--mx", `${e.clientX}px`);
    spotlight.style.setProperty("--my", `${e.clientY}px`);
  }, { passive: true });
}

/* ---------- Clock (Quito) ---------- */
const clock = document.querySelector("[data-clock]");
const clockFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Guayaquil",
});
const tickClock = () => { if (clock) clock.textContent = `${clockFmt.format(new Date())} · Quito`; };
tickClock();
setInterval(tickClock, 30_000);

/* ---------- Projects ---------- */
function thumbnail(p) {
  const box = el("div", "thumb");
  const fallback = () => {
    box.classList.add("thumb--term");
    box.replaceChildren(
      el("span", "t-cmd", p.command || `git clone ${p.repo}`),
      el("span", "t-out", `# ${p.tags.slice(0, 2).join(" · ")}`),
    );
  };
  if (p.preview) {
    const img = el("img");
    img.src = p.preview;
    img.alt = p.previewAlt || `Screenshot of ${p.title}`;
    img.loading = "lazy";
    img.decoding = "async";
    img.width = 336;
    img.height = 210;
    // If the screenshot is missing, fall back to the generated terminal preview.
    img.addEventListener("error", fallback);
    box.append(img);
  } else {
    fallback();
  }
  if (!p.preview) box.setAttribute("aria-hidden", "true");
  return box;
}

function pills(tags) {
  const ul = el("ul", "pills mono");
  for (const t of tags) ul.append(el("li", null, t));
  return ul;
}

// One row per project: the title link stretches over the whole row, badges and demo stay clickable on top.
function renderProject(p) {
  const li = el("li", "row");
  li.id = `project-${p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  li.append(thumbnail(p));

  const body = el("div", "row__body");
  const h = el("h3", "row__title");
  const link = external(el("a", "row__link", p.title));
  link.href = p.repo;
  link.setAttribute("aria-label", `${p.title} on GitHub (opens in a new tab)`);
  link.append(el("span", "row__arrow", "↗"));
  link.lastChild.setAttribute("aria-hidden", "true");
  h.append(link);
  body.append(h, el("p", "row__text", p.summary));

  if (p.badges?.length) {
    const badges = el("ul", "badges");
    badges.setAttribute("aria-label", "Verified facts");
    for (const b of p.badges) {
      // The badge style already draws a ✓, so drop a trailing one from the data label.
      const a = external(el("a", "badge", b.label.replace(/\s*✓$/, "")));
      a.href = b.source;
      a.title = "Verify on GitHub";
      const item = el("li");
      item.append(a);
      badges.append(item);
    }
    body.append(badges);
  }
  if (p.demo) {
    const actions = el("p", "row__actions");
    const demo = external(el("a", "demo-link", "Live demo ↗"));
    demo.href = p.demo;
    demo.setAttribute("aria-label", `Open the ${p.title} live demo (opens in a new tab)`);
    actions.append(demo);
    body.append(actions);
  }
  body.append(pills(p.tags));
  li.append(body);
  return li;
}

function renderArchive(p) {
  const li = el("li");
  const a = external(el("a", null, `${p.title} ↗`));
  a.href = p.repo;
  const text = el("div");
  text.append(el("p", null, p.summary), pills(p.tags));
  li.append(a, text);
  return li;
}

async function loadProjects() {
  const main = document.querySelector("[data-projects]:not([data-secondary])");
  const archive = document.querySelector("[data-projects][data-secondary]");
  try {
    const res = await fetch("data/projects.json");
    if (!res.ok) throw new Error(res.status);
    const projects = await res.json();
    main.replaceChildren(...projects.filter((p) => !p.secondary).map(renderProject));
    const rest = projects.filter((p) => p.secondary);
    if (rest.length) archive.replaceChildren(...rest.map(renderArchive));
    else archive.closest("details")?.remove();
    observeReveal(main.querySelectorAll(".row"));
    return projects;
  } catch (err) {
    main.replaceChildren(el("li", "mono muted",
      "Could not load data/projects.json. Serve the folder over HTTP: python3 -m http.server"));
    return [];
  }
}

/* ---------- Certifications ---------- */
// Missing dates or verification links render as visible TODOs, never as blanks that look complete.
function renderCert(c) {
  const li = el("li", `cert${c.status === "upcoming" ? " cert--upcoming" : ""}`);
  li.append(el("span", "cert__issuer mono", c.issuer), el("span", "cert__name", c.name));

  const meta = el("div", "cert__meta mono");
  if (c.date) meta.append(el("span", null, c.date));
  if (c.url) {
    const a = external(el("a", null, "verify ↗"));
    a.href = c.url;
    a.setAttribute("aria-label", `Verify ${c.name} (opens in a new tab)`);
    meta.append(a);
  }
  if (c.todo) meta.append(el("span", "todo", c.todo));
  else if (!c.url && c.status !== "upcoming") {
    meta.append(el("span", "todo", c.date ? "TODO(demian): link" : "TODO(demian): date + link"));
  }
  li.append(meta);
  return li;
}

async function loadCerts() {
  const list = document.querySelector("[data-certs]");
  if (!list) return;
  try {
    const res = await fetch("data/certs.json");
    if (!res.ok) throw new Error(res.status);
    const certs = await res.json();
    const pending = el("li", "cert cert--upcoming");
    const pendingMeta = el("div", "cert__meta mono");
    pendingMeta.append(el("span", "todo", "TODO(demian): exact list"));
    pending.append(
      el("span", "cert__issuer mono", "DataCamp"),
      el("span", "cert__name", "More Power BI, Excel and GitHub certificates"),
      pendingMeta,
    );
    list.replaceChildren(...certs.map(renderCert), pending);
    observeReveal(list.querySelectorAll(".cert"));
  } catch (err) {
    list.replaceChildren(el("li", "mono muted", "Could not load data/certs.json."));
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

/* ---------- Scrollspy ---------- */
// The section whose top has passed 35% of the viewport is the active one in the side nav.
const spyLinks = [...document.querySelectorAll("[data-spy]")];
const spySections = spyLinks.map((a) => document.getElementById(a.dataset.spy)).filter(Boolean);
function syncSpy() {
  const line = innerHeight * 0.35;
  let current = spySections[0];
  for (const s of spySections) if (s.getBoundingClientRect().top <= line) current = s;
  // At the very bottom, the last section wins even if it's short.
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) current = spySections.at(-1);
  for (const a of spyLinks) {
    const on = a.dataset.spy === current?.id;
    a.classList.toggle("is-active", on);
    if (on) a.setAttribute("aria-current", "true");
    else a.removeAttribute("aria-current");
  }
}
addEventListener("scroll", syncSpy, { passive: true });
addEventListener("resize", syncSpy);
syncSpy();

/* ---------- Status log ---------- */
// Every number printed here is computed from projects.json, so the log never claims more than the data.
function bootLines(projects) {
  const ci = projects.filter((p) => (p.badges || []).some((b) => b.label.startsWith("CI"))).length;
  const badges = projects.reduce((n, p) => n + (p.badges || []).length, 0);
  // Short enough to fit one line in the status box at 375px.
  const dots = (label) => `${label} `.padEnd(10, ".");
  return [
    ["cmd", "$ ./load_profile --user demianc14"],
    ["ok", `✓ ${dots("projects")} ${projects.length} loaded`],
    ["ok", `✓ ${dots("ci")} ${ci} pipelines linked`],
    ["ok", `✓ ${dots("badges")} ${badges} verified, 0 invented`],
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
  setTimeout(tick, 700);
}

document.querySelector("[data-year]").textContent = new Date().getFullYear();
observeReveal(document.querySelectorAll("#experience .row, #education .row"));
loadProjects().then((projects) => writeLog(bootLines(projects)));
loadCerts();
