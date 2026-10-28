// Desktop mode: on wide screens with a mouse, shortcuts open draggable windows (WinBox).
// Everywhere else the same shortcuts are plain anchors that scroll to their section.
(() => {
  const WINBOX_SRC = "https://cdn.jsdelivr.net/npm/winbox@0.2.82/dist/winbox.bundle.min.js";
  const desktopQuery = matchMedia("(min-width: 900px) and (pointer: fine)");
  const root = document.documentElement;
  const hero = document.querySelector(".hero");
  const { el, slug, reduceMotion, renderCard, renderCert, ready } = window.portfolio;

  let data = { projects: [], certs: [] };
  const open = new Map();   // key -> WinBox instance, so a shortcut focuses its window instead of duplicating it
  let cascade = 0;

  /* ---------- Clock (Quito) ---------- */
  const clock = document.querySelector("[data-clock]");
  const fmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Guayaquil",
  });
  const tickClock = () => { if (clock) clock.textContent = `${fmt.format(new Date())} · Quito`; };
  tickClock();
  setInterval(tickClock, 30_000);

  /* ---------- WinBox loader ---------- */
  let winboxLoading;
  function loadWinBox() {
    if (window.WinBox) return Promise.resolve();
    winboxLoading ??= new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = WINBOX_SRC;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.append(s);
    });
    return winboxLoading;
  }

  /* ---------- Window contents ---------- */
  // Clones a page section for a window, dropping ids so the page keeps unique anchors.
  function cloneSection(selector) {
    const node = document.querySelector(selector)?.cloneNode(true);
    if (!node) return el("p", "muted", "Not found.");
    node.removeAttribute("id");
    node.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    node.querySelectorAll(".reveal").forEach((n) => n.classList.add("is-in"));
    return node;
  }

  function certList(stack) {
    const certs = data.certs.filter((c) => c.stack === stack);
    if (!certs.length) return null;
    const ul = el("ul", "certs certs--window");
    ul.append(...certs.map(renderCert));
    return ul;
  }

  function projectLauncher(projects) {
    const ul = el("ul", "launcher");
    for (const p of projects) {
      const li = el("li");
      const b = el("button", "launcher__item mono", p.title);
      b.type = "button";
      b.addEventListener("click", () => openWindow(`project:${slug(p.title)}`, b));
      li.append(b);
      ul.append(li);
    }
    return ul;
  }

  // Template from the brief (§6.2): what each Power BI / Excel case will show once it exists.
  function underConstruction(stack, label) {
    const box = el("div", "win-pad");
    box.append(
      el("p", "win-kicker mono", `~/projects/${stack}`),
      el("h2", "win-title", `${label}: under construction`),
      el("p", "muted", "Projects from the current course land here, each one following the same structure:"),
    );
    const ol = el("ol", "steps mono");
    for (const step of ["business question", "data source", "model", "screenshots", "findings", "link"]) ol.append(el("li", null, step));
    box.append(ol);
    const todo = el("p");
    todo.append(el("span", "todo", `TODO(demian): ${label} projects`));
    box.append(todo);
    const certs = certList(stack);
    if (certs) box.append(el("h3", "win-sub mono", "certifications"), certs);
    return box;
  }

  function githubWindow() {
    const box = el("div", "win-pad");
    box.append(el("p", "win-kicker mono", "~/github"), el("h2", "win-title", "Git & GitHub"));
    box.append(el("p", "muted", "Evidence that can be checked on the repos themselves:"));
    const ul = el("ul", "evidence");
    const ci = data.projects.filter((p) => (p.badges || []).some((b) => b.label.startsWith("CI")));
    for (const p of ci) {
      const li = el("li");
      const a = el("a", null, `${p.title}: GitHub Actions CI`);
      a.href = p.badges.find((b) => b.label.startsWith("CI")).source;
      a.target = "_blank";
      a.rel = "noopener";
      li.append(a);
      ul.append(li);
    }
    const priv = el("li");
    const a = el("a", null, "family-expense-bot: a test scans every object in the git history for secrets");
    a.href = "https://github.com/demianc14/family-expense-bot#readme";
    a.target = "_blank";
    a.rel = "noopener";
    priv.append(a);
    ul.append(priv);
    box.append(ul);
    const actions = el("div", "card__actions");
    const profile = el("a", "btn btn--primary btn--sm", "github.com/demianc14 ↗");
    profile.href = "https://github.com/demianc14";
    profile.target = "_blank";
    profile.rel = "noopener";
    actions.append(profile);
    box.append(actions);
    const todo = el("p");
    todo.append(el("span", "todo", "TODO(demian): DataCamp GitHub certificates"));
    box.append(todo);
    return box;
  }

  function cvWindow() {
    const box = el("div", "win-pad");
    box.append(el("p", "win-kicker mono", "~/cv.pdf"), el("h2", "win-title", "CV"));
    const todo = el("p");
    todo.append(el("span", "todo", "TODO(demian): public CV PDF (without phone number)"));
    box.append(todo, el("p", "muted", "Meanwhile, the full profile is on LinkedIn."));
    const actions = el("div", "card__actions");
    const li = el("a", "btn btn--primary btn--sm", "LinkedIn ↗");
    li.href = "https://www.linkedin.com/in/demian-cruz-28217027b/";
    li.target = "_blank";
    li.rel = "noopener";
    actions.append(li);
    box.append(actions);
    return box;
  }

  // Every shortcut key maps to a title, a size and the node to mount.
  function contentFor(key) {
    const [kind, id] = key.split(":");
    if (kind === "project") {
      const p = data.projects.find((x) => slug(x.title) === id);
      if (!p) return null;
      return { title: `~/projects/${p.title}`, width: 560, height: 640, node: renderCard(p) };
    }
    if (kind === "about") {
      const node = cloneSection("#about .about");
      return { title: "~/about.txt", width: 720, height: 560, node: wrapPad(node) };
    }
    if (kind === "experience") {
      return { title: "~/experience.log", width: 680, height: 620, node: wrapPad(cloneSection("#experience .timeline")) };
    }
    if (kind === "cv") return { title: "~/cv.pdf", width: 460, height: 300, node: cvWindow() };
    if (kind === "stack") {
      if (id === "python-ai") {
        const box = el("div", "win-pad");
        const main = data.projects.filter((p) => p.stack === "python-ai" && !p.secondary);
        box.append(
          el("p", "win-kicker mono", "~/projects/python-ai"),
          el("h2", "win-title", "Python & AI"),
          el("p", "muted", "Open a project:"),
          projectLauncher(main),
        );
        const certs = certList("python-ai");
        if (certs) box.append(el("h3", "win-sub mono", "certifications"), certs);
        return { title: "~/projects/python-ai", width: 620, height: 600, node: box };
      }
      if (id === "power-bi") return { title: "~/projects/power-bi", width: 520, height: 520, node: underConstruction("power-bi", "Power BI") };
      if (id === "excel") return { title: "~/projects/excel", width: 520, height: 520, node: underConstruction("excel", "Excel") };
      if (id === "github") return { title: "~/github", width: 560, height: 460, node: githubWindow() };
    }
    return null;
  }

  function wrapPad(node) {
    const box = el("div", "win-pad");
    box.append(node);
    return box;
  }

  /* ---------- Windows ---------- */
  // Free width to the right of the hero copy, where the featured window can sit without covering the name.
  function freeRight() {
    const copy = document.querySelector(".hero__copy");
    const minX = copy ? Math.round(copy.getBoundingClientRect().right) + 32 : 0;
    return { minX, width: innerWidth - 24 - minX };
  }

  // Featured window: tucked into the free space. Windows the visitor opens: their real size,
  // right-aligned and cascading, like a desktop.
  function placement(width, height, { avoidCopy = false } = {}) {
    const top = 72;
    const h = Math.min(height, innerHeight - top - 24);
    if (avoidCopy) {
      const free = freeRight();
      return { x: free.minX, y: top, width: Math.min(width, free.width), height: h };
    }
    const w = Math.min(width, innerWidth - 48);
    const step = (cascade++ % 5) * 28;
    return { x: Math.max(24, innerWidth - w - 24 - step), y: top + step, width: w, height: h };
  }

  async function openWindow(key, opener, { focus = true, avoidCopy = false } = {}) {
    const existing = open.get(key);
    if (existing) { existing.focus(); existing.window.focus(); return existing; }

    const content = contentFor(key);
    if (!content) return null;
    await loadWinBox();

    const pos = placement(content.width, content.height, { avoidCopy });
    const classes = ["wb-dc", "no-full", "no-min"];
    if (reduceMotion) classes.push("no-animation");

    const win = new window.WinBox({
      title: content.title,
      class: classes,
      mount: content.node,
      top: 60,
      ...pos,
      onclose() {
        open.delete(key);
        // Return focus to whatever opened the window, if it's still on screen.
        if (opener && document.contains(opener)) opener.focus();
        return false;
      },
    });

    const w = win.window;
    w.setAttribute("role", "dialog");
    w.setAttribute("aria-label", content.title);
    w.tabIndex = -1;
    for (const ctl of w.querySelectorAll(".wb-close, .wb-max")) {
      ctl.setAttribute("role", "button");
      ctl.tabIndex = 0;
      ctl.setAttribute("aria-label", ctl.classList.contains("wb-close") ? "Close window" : "Maximize window");
      ctl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ctl.click(); }
      });
    }
    open.set(key, win);
    if (focus) w.focus();
    return win;
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    for (const win of open.values()) {
      if (win.window.contains(document.activeElement)) { win.close(); return; }
    }
  });

  /* ---------- Shortcuts ---------- */
  function renderProjectIcons() {
    const list = document.querySelector("[data-desk-icons]");
    if (!list) return;
    const main = data.projects.filter((p) => !p.secondary);
    const items = main.map((p) => {
      const li = el("li");
      const a = el("a", "desk-icon");
      a.href = `#project-${slug(p.title)}`;
      a.dataset.open = `project:${slug(p.title)}`;
      a.title = p.title;
      const label = el("span", "desk-icon__label mono");
      // Allow line breaks only after separators, so labels never split mid-word.
      p.title.split(/(?<=[-_.])/).forEach((part, i) => { if (i) label.append(document.createElement("wbr")); label.append(part); });
      a.append(el("span", "desk-icon__file mono", ".py"), label);
      a.firstChild.setAttribute("aria-hidden", "true");
      li.append(a);
      return li;
    });
    list.prepend(...items);
  }

  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-open]");
    if (!trigger || !root.classList.contains("is-desktop")) return;
    e.preventDefault();
    openWindow(trigger.dataset.open, trigger);
  });

  // Windows float over the hero only; scrolling down into the page hides them until you come back.
  if (hero) {
    const syncAway = () => root.classList.toggle("desk-away", hero.getBoundingClientRect().bottom < innerHeight * 0.35);
    addEventListener("scroll", syncAway, { passive: true });
    syncAway();
  }

  function applyMode() {
    const desktop = desktopQuery.matches;
    root.classList.toggle("is-desktop", desktop);
    document.querySelectorAll("[data-open]").forEach((n) => {
      if (desktop) n.setAttribute("aria-haspopup", "dialog");
      else n.removeAttribute("aria-haspopup");
    });
    if (!desktop) for (const win of [...open.values()]) win.close(true);
  }
  desktopQuery.addEventListener("change", applyMode);

  ready.then((d) => {
    data = d;
    renderProjectIcons();
    applyMode();
    if (!desktopQuery.matches) return;
    // Show the idea right away: open one featured window once the browser is idle.
    const featured = data.projects.find((p) => p.demo) || data.projects[0];
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 600));
    idle(() => {
      if (!featured || open.size) return;
      // No focus move: keyboard users start at the top of the page as usual.
      if (freeRight().width >= 380) openWindow(`project:${slug(featured.title)}`, null, { focus: false, avoidCopy: true });
    });
  });
})();
