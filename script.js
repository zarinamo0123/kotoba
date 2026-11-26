let works = [];
let positions = new Map();

let selectedAuthor = "";
let searchText = "";
let mode = "mine";
let selectedWork = "";
let relatedOnly = false;
const collapsed = new Set();

let zoom = 1;
let offsetX = 0;
let offsetY = 0;

const NS = "http://www.w3.org/2000/svg";
const mobile = window.matchMedia("(max-width: 700px)");

const CARD_WIDTH = 230;
const CARD_HEIGHT = 80;
const GAP = 20;

let workMap = new Map();
let childMap = new Map();

function svgElement(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);

  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, value);
  });

  return el;
}

function buildMaps() {
  workMap = new Map();
  childMap = new Map();

  works.forEach(w => {
    workMap.set(w.id, w);

    if (w.verified !== true) return;

    if (!childMap.has(w.parent)) {
      childMap.set(w.parent, []);
    }

    childMap.get(w.parent).push(w);
  });
}

function children(id) {
  return childMap.get(id) || [];
}

function descendants(id, found = new Set()) {
  const stack = [id];

  while (stack.length) {
    const current = stack.pop();

    if (found.has(current)) continue;

    found.add(current);

    children(current).forEach(w => {
      stack.push(w.id);
    });
  }

  return found;
}

function ancestors(id) {
  const found = new Set();

  let work = workMap.get(id);

  while (work && !found.has(work.id)) {
    found.add(work.id);

    if (!work.verified) break;

    work = workMap.get(work.parent);
  }

  return found;
}

function layout() {
  positions.clear();

  const root = works.find(
    w => !w.parent && w.verified === true
  );

  if (!root) return;

  const weights = new Map();
  const levels = new Map();
  const visiting = new Set();

  function getWeight(id) {
    if (weights.has(id)) {
      return weights.get(id);
    }

    if (visiting.has(id)) return 0;

    visiting.add(id);

    let weight = 1;

    children(id).forEach(child => {
      weight += getWeight(child.id);
    });

    visiting.delete(id);
    weights.set(id, weight);

    return weight;
  }

  getWeight(root.id);

  function place(work, depth, start, end) {
    if (positions.has(work.id)) return;

    const angle = (start + end) / 2;

    positions.set(work.id, {
      depth,
      angle,
      x: 0,
      y: 0
    });

    if (!levels.has(depth)) {
      levels.set(depth, []);
    }

    levels.get(depth).push(work.id);

    const list = children(work.id);

    const total = list.reduce(
      (sum, child) => sum + getWeight(child.id),
      0
    );

    let cursor = start;

    list.forEach(child => {
      const span =
        (end - start) *
        getWeight(child.id) / total;

      place(
        child,
        depth + 1,
        cursor,
        cursor + span
      );

      cursor += span;
    });
  }

  place(root, 0, -Math.PI / 2, Math.PI * 1.5);

  calculateCompactLayout(levels, root.id);
}

function calculateCompactLayout(levels, rootId) {
  const occupied = new Map();

  const cellWidth = CARD_WIDTH + GAP;
  const cellHeight = CARD_HEIGHT + GAP + 32;

  function cellKey(x, y) {
    return (
      Math.floor(x / cellWidth) + ":" +
      Math.floor(y / cellHeight)
    );
  }

  function isFree(x, y) {
    const cx = Math.floor(x / cellWidth);
    const cy = Math.floor(y / cellHeight);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key =
          (cx + dx) + ":" + (cy + dy);

        const nearby = occupied.get(key) || [];

        for (const p of nearby) {
          if (
            Math.abs(x - p.x) < cellWidth &&
            Math.abs(y - p.y) < cellHeight
          ) {
            return false;
          }
        }
      }
    }

    return true;
  }

  function reserve(x, y) {
    const key = cellKey(x, y);

    if (!occupied.has(key)) {
      occupied.set(key, []);
    }

    occupied.get(key).push({ x, y });
  }

  const root = positions.get(rootId);

  root.x = 0;
  root.y = 0;

  reserve(0, 0);

  const sortedLevels = [...levels.entries()]
    .sort((a, b) => a[0] - b[0]);

  sortedLevels.forEach(([depth, ids]) => {
    if (depth === 0) return;

    ids.sort((a, b) =>
      positions.get(a).angle -
      positions.get(b).angle
    );

    ids.forEach(id => {
      const p = positions.get(id);
      const work = workMap.get(id);
      const parent = positions.get(work.parent);

      if (!parent) return;

      const preferredAngle = p.angle;

      const parentRadius = Math.hypot(
        parent.x,
        parent.y
      );

      let best = null;
      let bestScore = Infinity;

      for (let ring = 1; ring <= 24; ring++) {
        const radius = ring * 125;

        const samples = Math.max(
          12,
          Math.ceil(2 * Math.PI * radius / 70)
        );

        for (let i = 0; i < samples; i++) {
          const angle =
            preferredAngle +
            i * Math.PI * 2 / samples;

          const x =
            parent.x + Math.cos(angle) * radius;

          const y =
            parent.y + Math.sin(angle) * radius;

          if (!isFree(x, y)) continue;

          const globalRadius = Math.hypot(x, y);

          if (globalRadius < parentRadius + 40) {
            continue;
          }

          const angleDifference = Math.abs(
            Math.atan2(
              Math.sin(angle - preferredAngle),
              Math.cos(angle - preferredAngle)
            )
          );

          const score =
            radius +
            globalRadius * 0.15 +
            angleDifference * 90;

          if (score < bestScore) {
            bestScore = score;
            best = { x, y };
          }
        }

        if (
          best &&
          (ring + 1) * 125 >= bestScore
        ) {
          break;
        }
      }

      if (!best) {
        let radius = Math.max(
          parentRadius + 270,
          depth * 260
        );

        while (!best) {
          const x =
            Math.cos(preferredAngle) * radius;

          const y =
            Math.sin(preferredAngle) * radius;

          if (isFree(x, y)) {
            best = { x, y };
          } else {
            radius += 270;
          }
        }
      }

      p.x = best.x;
      p.y = best.y;

      reserve(p.x, p.y);
    });
  });

  // 系譜につながっていない作品は外側に配置
  const pending = works.filter(
    w => !positions.has(w.id)
  );

  if (pending.length) {
    const existing = [...positions.values()];

    const maxRadius = Math.max(
      0,
      ...existing.map(p => Math.hypot(p.x, p.y))
    );

    pending.forEach((w, i) => {
      const angle =
        i * Math.PI * 2 / pending.length;

      let radius = maxRadius + 300;

      while (true) {
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        if (isFree(x, y)) {
          positions.set(w.id, {
            depth: -1,
            angle,
            x,
            y
          });

          reserve(x, y);
          break;
        }

        radius += 270;
      }
    });
  }
}

function highlighted() {
  if (!selectedAuthor) {
    return new Set(works.map(w => w.id));
  }

  const result = new Set();

  works
    .filter(w => w.author === selectedAuthor && (!selectedWork || w.id === selectedWork))
    .forEach(w => {
      result.add(w.id);

      if (mode === "direct") children(w.id).forEach(c => result.add(c.id));

      if (mode === "journey") {
        descendants(w.id).forEach(id => {
          result.add(id);
        });
      }

      if (mode === "roots") {
        ancestors(w.id).forEach(id => {
          result.add(id);
        });
      }
    });

  return result;
}

function visibleWorks() {
  const hidden = new Set();
  collapsed.forEach(id => {
    descendants(id).forEach(child => { if (child !== id) hidden.add(child); });
  });
  const active = highlighted();
  return new Set(works.filter(w => !hidden.has(w.id) && (!selectedAuthor || !relatedOnly || active.has(w.id))).map(w => w.id));
}

function revealSelection() {
  if (!selectedAuthor) return;
  highlighted().forEach(id => {
    ancestors(id).forEach(parent => { if (parent !== id) collapsed.delete(parent); });
  });
}

function refreshSelection() {
  revealSelection();
  render();
  requestAnimationFrame(fitTree);
}

function addBranchButton(node, w, active) {
  const list = children(w.id);
  if (!list.length) return;
  if (selectedAuthor && relatedOnly && !list.some(c => active.has(c.id))) return;
  const closed = collapsed.has(w.id);
  const button = svgElement("g", {role:"button", tabindex:0, "aria-label":closed ? "つづきを開く" : "枝を折りたたむ", "aria-expanded":String(!closed)});
  button.style.cursor = "pointer";
  button.appendChild(svgElement("rect", {x:-48,y:32,width:96,height:40,fill:"transparent"}));
  button.appendChild(svgElement("rect", {x:closed?-40:-12,y:40,width:closed?80:24,height:24,rx:12,fill:"white",stroke:closed?"#b93636":"#c9c4bd"}));
  const label = svgElement("text", {x:0,y:56,"text-anchor":"middle","font-size":12,fill:closed?"#b93636":"#777"});
  label.textContent = closed ? "つづき ▾" : "▴";
  button.appendChild(label);
  function toggle(e) {
    e.preventDefault(); e.stopPropagation();
    if (collapsed.has(w.id)) collapsed.delete(w.id); else collapsed.add(w.id);
    render();
  }
  button.addEventListener("click", toggle);
  button.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") toggle(e); });
  node.appendChild(button);
}

function createFocusControls() {
  const modeSelect = document.getElementById("mode");
  const option = document.createElement("option");
  option.value = "direct"; option.textContent = "ことばのバトン";
  modeSelect.insertBefore(option, modeSelect.querySelector('option[value="journey"]'));
  const panel = document.createElement("div");
  panel.id = "focus-controls";
  Object.assign(panel.style,{display:"none",flexWrap:"wrap",gap:"8px",alignItems:"center",padding:"8px 12px",borderBottom:"1px solid #e2ded8",fontSize:"13px"});
  const select = document.createElement("select");
  select.id = "focus-work"; select.setAttribute("aria-label","作品を選ぶ");
  Object.assign(select.style,{maxWidth:"100%",minWidth:"0",padding:"8px",border:"1px solid #e2ded8",borderRadius:"5px",background:"white",flex:"1"});
  select.onchange = () => { selectedWork = select.value; refreshSelection(); };
  const label = document.createElement("label");
  const check = document.createElement("input");
  check.type = "checkbox"; check.id = "related-only";
  check.onchange = () => { relatedOnly = check.checked; refreshSelection(); };
  label.append(check, " 関係する作品だけを表示");
  panel.append(select,label);
  document.querySelector(".toolbar").after(panel);
}

function syncFocusControls() {
  const panel = document.getElementById("focus-controls");
  const select = document.getElementById("focus-work");
  panel.style.display = selectedAuthor ? "flex" : "none";
  document.getElementById("mode").disabled = !selectedAuthor;
  document.getElementById("related-only").checked = relatedOnly;
  select.replaceChildren(new Option("すべての自分の作品", ""));
  works.filter(w => w.author === selectedAuthor).forEach(w => select.add(new Option(w.title,w.id)));
  select.value = selectedWork;
}

function render() {
  const svg = document.getElementById("tree");

  if (!svg) return;

  svg.replaceChildren();

  const group = svgElement("g", {
    id: "tree-content",
    transform:
      `translate(${offsetX} ${offsetY}) scale(${zoom})`
  });

  svg.appendChild(group);

  const active = highlighted();
  const visible = visibleWorks();

  // 作品同士を結ぶ線
  works.forEach(w => {
    if (!w.parent || !w.verified || !visible.has(w.id) || !visible.has(w.parent)) return;

    const a = positions.get(w.parent);
    const b = positions.get(w.id);

    if (!a || !b) return;

    const focused =
      active.has(w.id) &&
      active.has(w.parent);

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

  // 作品カード
  works.forEach(w => {
    const p = positions.get(w.id);

    if (!p || !visible.has(w.id)) return;

    const own = selectedAuthor === w.author && (!selectedWork || selectedWork === w.id);

    const node = svgElement("g", {
      transform: `translate(${p.x} ${p.y})`,
      opacity: active.has(w.id) ? 1 : 0.18
    });

    const rect = svgElement("rect", {
      x: -CARD_WIDTH / 2,
      y: -CARD_HEIGHT / 2,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
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

    for (
      let i = 0;
      i < chars.length && i < 45;
      i += 15
    ) {
      const line = svgElement("tspan", {
        x: 0,
        y: -22 + (i / 15) * 15
      });

      line.textContent =
        chars.slice(i, i + 15).join("");

      if (i === 30 && chars.length > 45) {
        line.textContent =
          chars.slice(i, i + 14).join("") + "…";
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

    const iconX = -Math.min(
      98,
      w.author.length * 3 + 12
    );

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

    addBranchButton(node, w, active);
    group.appendChild(node);
  });
}

// 拡大・縮小・移動時は座標変換だけを更新
function updateTransform() {
  const group =
    document.getElementById("tree-content");

  if (!group) return;

  group.setAttribute(
    "transform",
    `translate(${offsetX} ${offsetY}) scale(${zoom})`
  );
}

function fitTree() {
  const svg = document.getElementById("tree");

  if (!svg || !positions.size) return;

  if (!svg.clientWidth || !svg.clientHeight) return;

  const visible = visibleWorks();
  const active = highlighted();
  let points = [...positions.entries()].filter(([id]) => visible.has(id) && (!selectedAuthor || active.has(id))).map(([,p]) => p);
  if (!points.length) points = [...positions.entries()].filter(([id]) => visible.has(id)).map(([,p]) => p);
  if (!points.length) return;

  const minX =
    Math.min(...points.map(p => p.x)) - 140;

  const maxX =
    Math.max(...points.map(p => p.x)) + 140;

  const minY =
    Math.min(...points.map(p => p.y)) - 65;

  const maxY =
    Math.max(...points.map(p => p.y)) + 90;

  zoom = Math.min(
    svg.clientWidth / (maxX - minX),
    svg.clientHeight / (maxY - minY),
    1
  );

  offsetX =
    svg.clientWidth / 2 -
    (minX + maxX) / 2 * zoom;

  offsetY =
    svg.clientHeight / 2 -
    (minY + maxY) / 2 * zoom;

  updateTransform();
}

function changeZoom(factor, x, y) {
  const svg = document.getElementById("tree");

  x = x ?? svg.clientWidth / 2;
  y = y ?? svg.clientHeight / 2;

  const next = Math.max(
    0.000001,
    Math.min(4, zoom * factor)
  );

  offsetX = x - (x - offsetX) * next / zoom;
  offsetY = y - (y - offsetY) * next / zoom;

  zoom = next;

  updateTransform();
}

function setSidebarCollapsed(collapsed) {
  const sidebar =
    document.querySelector(".sidebar");

  const button =
    document.querySelector(".sidebar-toggle");

  if (!sidebar || !button) return;

  sidebar.classList.toggle(
    "is-collapsed",
    collapsed
  );

  button.setAttribute(
    "aria-expanded",
    String(!collapsed)
  );

  const label =
    selectedAuthor || "参加者を選ぶ・探す";

  button.textContent =
    label + (collapsed ? "　▼" : "　▲");
}

function createSidebarToggle() {
  const sidebar =
    document.querySelector(".sidebar");

  if (!sidebar) return;

  const button = document.createElement("button");

  button.className = "sidebar-toggle";
  button.type = "button";

  button.setAttribute("aria-controls", "authors");

  const controls = document.createElement("div");

  controls.className = "sidebar-controls";

  const allWorksButton =
    document.createElement("button");

  allWorksButton.className = "all-works-button";
  allWorksButton.type = "button";
  allWorksButton.textContent = "すべての作品";

  allWorksButton.addEventListener("click", () => {
    selectAuthor("");
  });

  controls.appendChild(button);
  controls.appendChild(allWorksButton);

  sidebar.prepend(controls);

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

  if (document.getElementById("author-search")) {
    return;
  }

  const input = document.createElement("input");

  input.id = "author-search";
  input.type = "search";
  input.placeholder = "作者名で検索";

  input.setAttribute(
    "aria-label",
    "作者名で検索"
  );

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
  selectedWork = "";
  if (!name) { collapsed.clear(); relatedOnly = false; }
  syncFocusControls();

  renderAuthors();

  if (mobile.matches) {
    setSidebarCollapsed(true);
  }

  refreshSelection();
}

function normalizeSearch(value) {
  return value
    .normalize("NFKC")
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

      if (!data.icon && w.icon) {
        data.icon = w.icon;
      }

      if (!data.profile && w.profile) {
        data.profile = w.profile;
      }
    }
  });

  const names = [...authors.values()].sort(
    (a, b) => a.name.localeCompare(b.name, "ja")
  );

  const allButton =
    document.createElement("button");

  allButton.textContent = "すべての作品";

  allButton.className =
    "author-button all-works-list-button";

  allButton.classList.toggle(
    "active",
    selectedAuthor === ""
  );

  allButton.onclick = () => selectAuthor("");

  list.appendChild(allButton);

  const externalButton =
    document.querySelector(".all-works-button");

  if (externalButton) {
    externalButton.classList.toggle(
      "active",
      selectedAuthor === ""
    );

    externalButton.setAttribute(
      "aria-pressed",
      String(selectedAuthor === "")
    );
  }

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

      iconBox.title =
        author.name + "のプロフィール";

      iconBox.setAttribute(
        "aria-label",
        author.name + "のプロフィールを開く"
      );
    }

    function showFallback() {
      iconBox.replaceChildren();

      const initial =
        document.createElement("span");

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

    const button =
      document.createElement("button");

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

    button.onclick = () => {
      selectAuthor(author.name);
    };

    row.appendChild(iconBox);
    row.appendChild(button);

    list.appendChild(row);
  });

  if (filtered.length === 0) {
    const message = document.createElement("p");

    message.textContent =
      "該当する作者がいません。";

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
    if (
      e.pointerType === "mouse" &&
      e.button !== 0
    ) {
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

      updateTransform();

    } else if (after.length >= 2) {
      moved = true;

      const oldDistance =
        distance(before[0], before[1]);

      const newDistance =
        distance(after[0], after[1]);

      if (oldDistance < 1) return;

      const oldCenter =
        center(before[0], before[1]);

      const newCenter =
        center(after[0], after[1]);

      const nextZoom = Math.max(
        0.000001,
        Math.min(
          4,
          zoom * newDistance / oldDistance
        )
      );

      const ratio = nextZoom / zoom;

      offsetX =
        newCenter.x -
        (oldCenter.x - offsetX) * ratio;

      offsetY =
        newCenter.y -
        (oldCenter.y - offsetY) * ratio;

      zoom = nextZoom;

      updateTransform();
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

  svg.addEventListener(
    "lostpointercapture",
    endPointer
  );

  window.addEventListener("pointerup", endPointer);

  window.addEventListener(
    "pointercancel",
    endPointer
  );

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
    const response = await fetch(
      "works.json",
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("読み込み失敗");
    }

    works = await response.json();

    buildMaps();
    layout();

    if (works.length && !positions.size) {
      throw new Error("起点作品が見つかりません");
    }

    createSearch();
    createFocusControls();
    syncFocusControls();
    createSidebarToggle();
    renderAuthors();

    render();
    fitTree();

    document.getElementById("zoom-in").onclick =
      () => changeZoom(1.2);

    document.getElementById("zoom-out").onclick =
      () => changeZoom(1 / 1.2);

    document.getElementById("reset").onclick =
      () => { if (selectedAuthor) selectAuthor(""); else { collapsed.clear(); render(); fitTree(); } };

    document.getElementById("mode").onchange =
      e => {
        mode = e.target.value;
        refreshSelection();
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
