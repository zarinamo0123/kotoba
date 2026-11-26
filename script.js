
let works = [];
let positions = new Map();
let selectedAuthor = "";
let searchText = "";
let mode = "mine";
let zoom = 1;
let offsetX = 0;
let offsetY = 0;

const NS = "http://www.w3.org/2000/svg";
const mobile = window.matchMedia("(max-width: 700px)");

function svgElement(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);

  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, value);
  });

  return el;
}

function children(id) {
  return works.filter(
    w => w.parent === id && w.verified === true
  );
}

function descendants(id, found = new Set()) {
  if (found.has(id)) return found;

  found.add(id);

  children(id).forEach(w => descendants(w.id, found));

  return found;
}

function ancestors(id) {
  const found = new Set();
  let work = works.find(w => w.id === id);

  while (work && !found.has(work.id)) {
    found.add(work.id);

    if (!work.verified) break;

    work = works.find(w => w.id === work.parent);
  }

  return found;
}

function layout() {
  positions.clear();

  const root = works.find(w => !w.parent && w.verified);

  if (!root) return;

  const levels = new Map();

  function place(work, depth, start, end) {
    if (positions.has(work.id)) return;

    const angle = (start + end) / 2;

    positions.set(work.id, { depth, angle });

    levels.set(depth, (levels.get(depth) || 0) + 1);

    const list = children(work.id);

    const weights = list.map(w => descendants(w.id).size);

    const total = weights.reduce((a, b) => a + b, 0);

    let cursor = start;

    list.forEach((child, i) => {
      const span = (end - start) * weights[i] / total;

      place(child, depth + 1, cursor, cursor + span);

      cursor += span;
    });
  }

  place(root, 0, -Math.PI / 2, Math.PI * 1.5);

  const maxLevel = Math.max(...levels.keys());

  const pending = works.filter(w => !positions.has(w.id));

  pending.forEach((w, i) => {
    positions.set(w.id, {
      depth: maxLevel + 1,
      angle: i * Math.PI * 2 / pending.length
    });
  });

  const step = Math.max(
    260,
    ...Array.from(levels.entries()).map(([d, n]) =>
      d > 0 ? n * 280 / (2 * Math.PI * d) : 0
    ),
    pending.length * 280 /
      (2 * Math.PI * (maxLevel + 1))
  );

  positions.forEach(p => {
    p.x = Math.cos(p.angle) * p.depth * step;
    p.y = Math.sin(p.angle) * p.depth * step;
  });
}

function highlighted() {
  if (!selectedAuthor) {
    return new Set(works.map(w => w.id));
  }

  const result = new Set();

  works.filter(w => w.author === selectedAuthor)
    .forEach(w => {
      result.add(w.id);

      if (mode === "journey") {
        descendants(w.id).forEach(id => result.add(id));
      }

      if (mode === "roots") {
        ancestors(w.id).forEach(id => result.add(id));
      }
    });

  return result;
}

function render() {
  const svg = document.getElementById("tree");

  if (!svg) return;

  svg.replaceChildren();

  const group = svgElement("g", {
    transform:
      `translate(${offsetX} ${offsetY}) scale(${zoom})`
  });

  svg.appendChild(group);

  const active = highlighted();

  works.forEach(w => {
    if (!w.parent || !w.verified) return;

    const a = positions.get(w.parent);
    const b = positions.get(w.id);

    if (!a || !b) return;

    const focused =
      active.has(w.id) && active.has(w.parent);

    group.appendChild(svgElement("line", {
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      stroke:
        selectedAuthor && focused
          ? "#b93636"
          : "#bcb7b0",
      "stroke-width": 1.5,
      opacity: focused ? 1 : 0.15
    }));
  });

  works.forEach(w => {
    const p = positions.get(w.id);

    if (!p) return;

    const own = selectedAuthor === w.author;

    const node = svgElement("g", {
      transform: `translate(${p.x} ${p.y})`,
      opacity: active.has(w.id) ? 1 : 0.18
    });

    const rect = svgElement("rect", {
      x: -115,
      y: -40,
      width: 230,
      height: 80,
      rx: 8,
      fill: "#ffffff",
      stroke: own ? "#b93636" : "#c9c4bd",
      "stroke-width": own ? 2.5 : 1
    });

    node.appendChild(rect);

    const title = svgElement("text", {
      "text-anchor": "middle",
      "font-size": 13,
      "font-weight": 600,
      fill: "#333333"
    });

    const chars = Array.from(w.title);

    for (let i = 0; i < chars.length && i < 45; i += 15) {
      const line = svgElement("tspan", {
        x: 0,
        y: -22 + (i / 15) * 15
      });

      line.textContent = chars.slice(i, i + 15).join("");

      if (i === 30 && chars.length > 45) {
        line.textContent = chars.slice(i, i + 14).join("") + "…";
      }

      title.appendChild(line);
    }

    const tooltip = svgElement("title");
    tooltip.textContent = w.title;
    node.appendChild(tooltip);

    if (w.url) {
      const link = svgElement("a", {
        href: w.url,
        target: "_blank",
        rel: "noopener noreferrer"
      });

      link.appendChild(title);
      node.appendChild(link);
    } else {
      node.appendChild(title);
    }

    const author = svgElement("text", {
      x: 10,
      y: 28,
      "text-anchor": "middle",
      "font-size": 11,
      fill: "#777777"
    });

    author.textContent = w.author;

    const authorGroup = svgElement("g");

    const iconX = -Math.min(98, w.author.length * 3 + 12);

    const fallback = svgElement("circle", {
      cx: iconX,
      cy: 24,
      r: 9,
      fill: "#aaa6a0"
    });

    authorGroup.appendChild(fallback);

    if (w.icon) {
      const image = svgElement("image", {
        href: w.icon,
        x: iconX - 9,
        y: 15,
        width: 18,
        height: 18,
        preserveAspectRatio: "xMidYMid slice"
      });

      image.style.clipPath = "circle(50%)";

      authorGroup.appendChild(image);
    }

    authorGroup.appendChild(author);

    if (w.profile) {
      const link = svgElement("a", {
        href: w.profile,
        target: "_blank",
        rel: "noopener noreferrer"
      });

      link.appendChild(authorGroup);
      node.appendChild(link);
    } else {
      node.appendChild(authorGroup);
    }

    group.appendChild(node);
  });
}

function fitTree() {
  const svg = document.getElementById("tree");

  if (!svg || !positions.size) return;

  const points = [...positions.values()];

  const minX = Math.min(...points.map(p => p.x)) - 140;
  const maxX = Math.max(...points.map(p => p.x)) + 140;
  const minY = Math.min(...points.map(p => p.y)) - 65;
  const maxY = Math.max(...points.map(p => p.y)) + 65;

  zoom = Math.min(
    svg.clientWidth / (maxX - minX),
    svg.clientHeight / (maxY - minY),
    1
  );

  offsetX =
    svg.clientWidth / 2 - (minX + maxX) / 2 * zoom;

  offsetY =
    svg.clientHeight / 2 - (minY + maxY) / 2 * zoom;

  render();
}

function changeZoom(factor, x, y) {
  const svg = document.getElementById("tree");

  x = x ?? svg.clientWidth / 2;
  y = y ?? svg.clientHeight / 2;

  const next = Math.max(
    0.05,
    Math.min(4, zoom * factor)
  );

  offsetX = x - (x - offsetX) * next / zoom;
  offsetY = y - (y - offsetY) * next / zoom;

  zoom = next;

  render();
}

function setSidebarCollapsed(collapsed) {
  const sidebar = document.querySelector(".sidebar");
  const button = document.querySelector(".sidebar-toggle");

  if (!sidebar || !button) return;

  sidebar.classList.toggle("is-collapsed", collapsed);

  button.setAttribute("aria-expanded", String(!collapsed));

  const label = selectedAuthor || "参加者を選ぶ・探す";

  button.textContent =
    label + (collapsed ? "　▼" : "　▲");
}

function createSidebarToggle() {
  const sidebar = document.querySelector(".sidebar");

  if (!sidebar) return;

  const button = document.createElement("button");

  button.className = "sidebar-toggle";
  button.type = "button";
  button.setAttribute("aria-controls", "authors");

  sidebar.prepend(button);

  button.addEventListener("click", () => {
    setSidebarCollapsed(
      !sidebar.classList.contains("is-collapsed")
    );
  });

  setSidebarCollapsed(mobile.matches);

  mobile.addEventListener("change", () => {
    setSidebarCollapsed(mobile.matches);
    requestAnimationFrame(fitTree);
  });
}

function createSearch() {
  const list = document.getElementById("authors");

  if (document.getElementById("author-search")) return;

  const input = document.createElement("input");

  input.id = "author-search";
  input.type = "search";
  input.placeholder = "作者名で検索";

  input.setAttribute("aria-label", "作者名で検索");

  Object.assign(input.style, {
    width: "100%",
    padding: "10px 12px",
    marginBottom: "12px",
    border: "1px solid #e2ded8",
    borderRadius: "5px",
    background: "#ffffff",
    fontSize: "13px",
    outlineColor: "#b93636"
  });

  input.addEventListener("input", () => {
    searchText = input.value;
    renderAuthors();
  });

  list.before(input);
}

function selectAuthor(name) {
  selectedAuthor = name;

  renderAuthors();

  if (mobile.matches) {
    setSidebarCollapsed(true);
  }

  render();
}

function normalizeSearch(value) {
  return value.normalize("NFKC")
    .toLocaleLowerCase("ja")
    .trim();
}

function renderAuthors() {
  const list = document.getElementById("authors");

  list.replaceChildren();

  const authors = new Map();

  works.forEach(w => {
    if (!authors.has(w.author)) {
      authors.set(w.author, {
        name: w.author,
        icon: w.icon || "",
        profile: w.profile || ""
      });
    } else {
      const data = authors.get(w.author);

      if (!data.icon && w.icon) data.icon = w.icon;

      if (!data.profile && w.profile) {
        data.profile = w.profile;
      }
    }
  });

  const names = [...authors.values()].sort(
    (a, b) => a.name.localeCompare(b.name, "ja")
  );

  const allButton = document.createElement("button");

  allButton.textContent = "すべての作品";
  allButton.className = "author-button";

  allButton.classList.toggle(
    "active",
    selectedAuthor === ""
  );

  allButton.onclick = () => selectAuthor("");

  list.appendChild(allButton);

  const query = normalizeSearch(searchText);

  const filtered = names.filter(author =>
    normalizeSearch(author.name).includes(query)
  );

  filtered.forEach(author => {
    const row = document.createElement("div");

    Object.assign(row.style, {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "7px 8px",
      borderRadius: "5px",
      flexShrink: "0",
      background:
        selectedAuthor === author.name
          ? "#f8eaea"
          : "transparent"
    });

    const iconBox = document.createElement(
      author.profile ? "a" : "span"
    );

    Object.assign(iconBox.style, {
      width: "32px",
      height: "32px",
      borderRadius: "50%",
      overflow: "hidden",
      flexShrink: "0",
      background: "#e2ded8",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      textDecoration: "none"
    });

    if (author.profile) {
      iconBox.href = author.profile;
      iconBox.target = "_blank";
      iconBox.rel = "noopener noreferrer";
      iconBox.title = author.name + "のプロフィール";

      iconBox.setAttribute(
        "aria-label",
        author.name + "のプロフィールを開く"
      );
    }

    function showFallback() {
      iconBox.replaceChildren();

      const initial = document.createElement("span");

      initial.textContent =
        Array.from(author.name)[0] || "?";

      initial.style.color = "#777777";
      initial.style.fontSize = "14px";

      iconBox.appendChild(initial);
    }

    if (author.icon) {
      const img = document.createElement("img");

      img.src = author.icon;
      img.alt = author.name;
      img.loading = "lazy";

      Object.assign(img.style, {
        width: "100%",
        height: "100%",
        objectFit: "cover"
      });

      img.onerror = showFallback;

      iconBox.appendChild(img);
    } else {
      showFallback();
    }

    const button = document.createElement("button");

    button.textContent = author.name;
    button.className = "author-button";

    Object.assign(button.style, {
      flex: "1",
      minWidth: "0",
      padding: "5px 0",
      background: "transparent",
      color:
        selectedAuthor === author.name
          ? "#b93636"
          : "#333333"
    });

    button.onclick = () => selectAuthor(author.name);

    row.appendChild(iconBox);
    row.appendChild(button);
    list.appendChild(row);
  });

  if (filtered.length === 0) {
    const message = document.createElement("p");

    message.textContent = "該当する作者がいません。";
    message.style.fontSize = "12px";
    message.style.color = "#888888";

    list.appendChild(message);
  }
}

function setupGestures(svg) {
  const pointers = new Map();

  let moved = false;
  let suppressClickUntil = 0;

  function point(e) {
    const rect = svg.getBoundingClientRect();

    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function center(a, b) {
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2
    };
  }

  svg.addEventListener("wheel", e => {
    e.preventDefault();

    const p = point(e);

    changeZoom(
      e.deltaY < 0 ? 1.12 : 1 / 1.12,
      p.x,
      p.y
    );
  }, { passive: false });

  svg.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse" && e.button !== 0) {
      return;
    }

    if (pointers.size === 0) {
      moved = false;
      suppressClickUntil = 0;
    }

    const p = point(e);

    pointers.set(e.pointerId, {
      ...p,
      startX: p.x,
      startY: p.y
    });

    if (pointers.size >= 2) {
      moved = true;

      pointers.forEach((value, id) => {
        try {
          svg.setPointerCapture(id);
        } catch {}
      });
    }
  });

  svg.addEventListener("pointermove", e => {
    if (!pointers.has(e.pointerId)) return;

    const before = [...pointers.values()]
      .map(p => ({ ...p }));

    const previous = pointers.get(e.pointerId);
    const next = point(e);

    pointers.set(e.pointerId, {
      ...previous,
      ...next
    });

    const after = [...pointers.values()];

    if (after.length === 1) {
      if (!moved) {
        const travel = Math.hypot(
          next.x - previous.startX,
          next.y - previous.startY
        );

        if (travel < 6) return;

        moved = true;

        try {
          svg.setPointerCapture(e.pointerId);
        } catch {}

        offsetX += next.x - previous.startX;
        offsetY += next.y - previous.startY;
      } else {
        offsetX += next.x - previous.x;
        offsetY += next.y - previous.y;
      }

      render();

    } else if (after.length >= 2) {
      moved = true;

      const oldDistance = distance(before[0], before[1]);
      const newDistance = distance(after[0], after[1]);

      if (oldDistance < 1) return;

      const oldCenter = center(before[0], before[1]);
      const newCenter = center(after[0], after[1]);

      const nextZoom = Math.max(
        0.05,
        Math.min(4, zoom * newDistance / oldDistance)
      );

      const ratio = nextZoom / zoom;

      offsetX =
        newCenter.x - (oldCenter.x - offsetX) * ratio;

      offsetY =
        newCenter.y - (oldCenter.y - offsetY) * ratio;

      zoom = nextZoom;

      render();
    }
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;

    pointers.delete(e.pointerId);

    if (moved) {
      suppressClickUntil = Date.now() + 400;
    }

    if (pointers.size === 0) {
      moved = false;
    }
  }

  svg.addEventListener("pointerup", endPointer);
  svg.addEventListener("pointercancel", endPointer);
  svg.addEventListener("lostpointercapture", endPointer);

  window.addEventListener("pointerup", endPointer);
  window.addEventListener("pointercancel", endPointer);

  svg.addEventListener("click", e => {
    if (Date.now() < suppressClickUntil) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
}

async function init() {
  const svg = document.getElementById("tree");

  if (!svg) return;

  try {
    const response = await fetch("works.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("読み込み失敗");
    }

    works = await response.json();

    layout();
    createSearch();
    createSidebarToggle();
    renderAuthors();
    fitTree();

    document.getElementById("zoom-in").onclick =
      () => changeZoom(1.2);

    document.getElementById("zoom-out").onclick =
      () => changeZoom(1 / 1.2);

    document.getElementById("reset").onclick = fitTree;

    document.getElementById("mode").onchange = e => {
      mode = e.target.value;
      render();
    };

    setupGestures(svg);

    let lastWidth = svg.clientWidth;
    let lastHeight = svg.clientHeight;

    const observer = new ResizeObserver(() => {
      if (
        svg.clientWidth !== lastWidth ||
        svg.clientHeight !== lastHeight
      ) {
        lastWidth = svg.clientWidth;
        lastHeight = svg.clientHeight;
        fitTree();
      }
    });

    observer.observe(svg);

  } catch (error) {
    document.getElementById("status").textContent =
      "作品データを読み込めませんでした。";

    console.error(error);
  }
}

document.addEventListener("DOMContentLoaded", init);
