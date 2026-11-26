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
  updateModeDescription();
  if(!authorView) revealSelection();
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
  const labels = {mine:"この人の作品",direct:"乗っ取られた先",journey:"乗っ取られた先の先",roots:"乗っ取ってきた道"};
  modeSelect.replaceChildren(...Object.entries(labels).map(([value,label]) => new Option(label,value)));
  modeSelect.value = mode;
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
  const workLabel = document.createElement("label");
  workLabel.htmlFor = "focus-work";
  workLabel.textContent = "たどりたい作品";
  panel.append(workLabel,select,label);
  document.querySelector(".toolbar").after(panel);
}

function syncFocusControls() {
  const panel = document.getElementById("focus-controls");
  const select = document.getElementById("focus-work");
  panel.style.display = selectedAuthor && !authorView ? "flex" : "none";
  document.getElementById("mode").disabled = !selectedAuthor;
  document.getElementById("related-only").checked = relatedOnly;
  select.replaceChildren(new Option(selectedAuthor + "のすべての作品", ""));
  works.filter(w => w.author === selectedAuthor).forEach(w => select.add(new Option(w.title,w.id)));
  select.value = selectedWork;
  updateModeDescription();
}

function updateModeDescription() {
  const description = document.getElementById("mode-description");
  if (!description) return;
  if (!selectedAuthor) {
    description.textContent = mobile.matches
      ? "「参加者を選ぶ・探す」から、気になる作者を選んでください。"
      : "参加者一覧から、気になる作者を選んでください。";
    return;
  }
  const work = workMap.get(selectedWork);
  const subject = work ? `「${work.title}」` : `${selectedAuthor}の作品`;
  const descriptions = {
    mine: `${subject}を見る。`,
    direct: `${subject}と、直接乗っ取ってくれた作品を見る。`,
    journey: `${subject}から広がった、すべての作品をたどる。`,
    roots: `${subject}の乗っ取り元を、はじまりまでさかのぼる。`
  };
  description.textContent = descriptions[mode] || descriptions.mine;
}

function render() {
  if(authorView){renderAuthorsGraph();return;}
  document.getElementById("status").textContent="";
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

    const dx = b.x - a.x, dy = b.y - a.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const c1 = horizontal ? {x:a.x+dx*0.5,y:a.y} : {x:a.x,y:a.y+dy*0.5};
    const c2 = horizontal ? {x:b.x-dx*0.5,y:b.y} : {x:b.x,y:b.y-dy*0.5};
    group.appendChild(svgElement("path", {
      d: `M ${a.x} ${a.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`,
      fill: "none",
      "stroke-linecap": "round",
      stroke:
        selectedAuthor && focused
          ? "#b93636"
          : "#b9ad96",
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
      rx: 11,
      fill: "#ffffff",
      stroke: own ? "#b93636" : "#c9c4bd",
      "stroke-width": own ? 2.5 : 1
    });

    node.appendChild(rect);

    const title = svgElement("text", {
      "text-anchor": "middle",
      "font-size": 16,
      "font-weight": 700,
      fill: "#333333"
    });

    // 文字数を均等に分け、最後の一文字だけの改行を防ぐ。
    const chars = Array.from(w.title);
    const shown = chars.length > 39 ? [...chars.slice(0, 38), "…"] : chars;
    const count = Math.max(1, Math.ceil(shown.length / 13));
    const fontSize = count === 3 ? 14 : 16;
    const lineHeight = count === 3 ? 15 : 18;
    title.setAttribute("font-size", fontSize);
    for (let i = 0; i < count; i++) {
      const start = Math.floor(i * shown.length / count);
      const end = Math.floor((i + 1) * shown.length / count);
      const line = svgElement("tspan", {
        x: 0,
        y: -8 + (i - (count - 1) / 2) * lineHeight
      });
      line.textContent = shown.slice(start, end).join("");
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

    const authorGroup = svgElement("g");
    const author = svgElement("text", {
      x: 0, y: 27, "text-anchor": "start",
      "font-size": 13, fill: "#777777"
    });
    const nameChars = Array.from(w.author);
    author.textContent = nameChars.length > 13 ? nameChars.slice(0, 12).join("") + "…" : w.author;
    // 実際の文字幅を測り、アイコンと名前を一組として中央に置く。
    authorGroup.appendChild(author);
    node.appendChild(authorGroup);
    group.appendChild(node);
    const measured = author.getComputedTextLength();
    const nameWidth = Math.min(176, measured || Array.from(author.textContent).length * 13);
    if (measured > 176) {
      author.setAttribute("textLength", 176);
      author.setAttribute("lengthAdjust", "spacingAndGlyphs");
    }
    const left = -(24 + 7 + nameWidth) / 2;
    const iconX = left + 12;
    author.setAttribute("x", left + 31);
    const fallback = svgElement("circle", {
      cx: iconX, cy: 23, r: 12, fill: "#aaa6a0"
    });
    authorGroup.prepend(fallback);
    if (w.icon) {
      const image = svgElement("image", {
        href: w.icon, x: iconX - 12, y: 11,
        width: 24, height: 24, preserveAspectRatio: "xMidYMid slice"
      });
      image.style.clipPath = "circle(50%)";
      authorGroup.insertBefore(image, author);
    }
    const authorTip = svgElement("title");
    authorTip.textContent = w.author;
    authorGroup.appendChild(authorTip);

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
  if(authorView){fitAuthorsGraph();return;}
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
    updateModeDescription();
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
  chosenEdge=""; authorDetails(null);
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

  allButton.textContent = authorView ? "すべての作者" : "すべての作品";

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
    externalButton.textContent=authorView?"すべての作者":"すべての作品";
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

    buildAuthorGraph();
    createAuthorViewControls();
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
      () => { if (selectedAuthor) selectAuthor(""); else { collapsed.clear(); chosenEdge=""; authorDetails(null); render(); fitTree(); } };

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

let authorView = false;

let chosenEdge = "";
let authorPoints = new Map();
let authorEdges = new Map();
function buildAuthorGraph() {
  const names = [...new Set(works.map(w => w.author))].sort((a,b)=>a.localeCompare(b,"ja",{numeric:true}));
  const byId = new Map(works.map(w=>[w.id,w]));
  authorPoints = new Map(); authorEdges = new Map();
  works.forEach(w=>{
    const parent=byId.get(w.parent);
    if(w.verified!==true || !parent || parent.verified!==true || parent.author===w.author)return;
    const pair=[parent.author,w.author].sort(); const key=JSON.stringify(pair);
    if(!authorEdges.has(key))authorEdges.set(key,{a:pair[0],b:pair[1],links:[]});
    authorEdges.get(key).links.push({parent,child:w});
  });
  layoutAuthors(names);
}
function layoutAuthors(names) {
  const n=names.length;
  if(!n)return;
  let seed=20261126; const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  const radius=Math.sqrt(n)*95;
  const nodes=names.map((name,i)=>{
    const angle=i*2.399963229728653;
    const r=radius*Math.sqrt((i+0.5)/n);
    return {name,x:r*Math.cos(angle)+random(),y:r*Math.sin(angle)*0.75+random(),dx:0,dy:0};
  });
  const map=new Map(nodes.map(p=>[p.name,p]));
  const edges=[...authorEdges.values()].map(e=>[map.get(e.a),map.get(e.b)]);
  for(let t=0;t<220;t++){
    const cap=24*(1-t/220)+1;
    for(const p of nodes){p.dx=-p.x*0.012;p.dy=-p.y*0.012;}
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
      const a=nodes[i],b=nodes[j],x=b.x-a.x,y=b.y-a.y,d=Math.max(1,Math.hypot(x,y));
      const f=18000/(d*d);
      a.dx-=x/d*f;b.dx+=x/d*f;a.dy-=y/d*f;b.dy+=y/d*f;
    }
    for(const [a,b] of edges){
      const x=b.x-a.x,y=b.y-a.y,d=Math.max(1,Math.hypot(x,y)),f=(d-185)*0.055;
      a.dx+=x/d*f;b.dx-=x/d*f;a.dy+=y/d*f;b.dy-=y/d*f;
    }
    for(const p of nodes){const d=Math.max(1,Math.hypot(p.dx,p.dy)),k=Math.min(1,cap/d);p.x+=p.dx*k;p.y+=p.dy*k;}
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
      const a=nodes[i],b=nodes[j],x=b.x-a.x,y=b.y-a.y,ox=170-Math.abs(x),oy=100-Math.abs(y);
      if(ox>0&&oy>0){if(ox<oy){const k=(ox+0.1)/2*(x>=0?1:-1);a.x-=k;b.x+=k;}else{const k=(oy+0.1)/2*(y>=0?1:-1);a.y-=k;b.y+=k;}}
    }
  }
  // Final deterministic collision guard, including name labels.
  const placed=[];
  for(const p of nodes){
    const free=(x,y)=>placed.every(q=>Math.abs(q.x-x)>=170||Math.abs(q.y-y)>=100);
    if(!free(p.x,p.y)){
      const x=p.x,y=p.y;
      search: for(let ring=1;;ring++)for(let k=0;k<ring*16;k++){
        const angle=k*2*Math.PI/(ring*16),xx=x+ring*12*Math.cos(angle),yy=y+ring*12*Math.sin(angle);
        if(free(xx,yy)){p.x=xx;p.y=yy;break search;}
      }
    }
    placed.push(p);authorPoints.set(p.name,{x:p.x,y:p.y});
  }

}
function authorDetails(edge) {
  const panel=document.getElementById("author-details");
  panel.replaceChildren(); panel.hidden=!edge;
  if(!edge)return;
  const close=document.createElement("button");close.textContent="閉じる ×";close.style.cssText="float:right;cursor:pointer;background:#fffdf8;color:#51483b;border:1px solid #ddd5c6;border-radius:4px;padding:5px";close.onclick=()=>{chosenEdge="";authorDetails(null);renderAuthorsGraph();};panel.append(close);
  const heading=document.createElement("strong");heading.textContent="二人をつないだ作品";panel.append(heading);
  edge.links.forEach(({parent,child})=>{
    const p=document.createElement("div");p.style.cssText="clear:both;border-top:1px solid #ddd5c6;margin-top:8px;padding-top:8px";
    for(const text of ["乗っ取り元："+parent.author+"「"+parent.title+"」","↓ ことばを乗っ取り","乗っ取った作品："+child.author+"「"+child.title+"」"]){const line=document.createElement("div"); const work=text.startsWith("乗っ取り元：")?parent:text.startsWith("乗っ取った作品：")?child:null; if(work&&work.url){const link=document.createElement("a");link.href=work.url;link.target="_blank";link.rel="noopener noreferrer";link.textContent=text;link.style.color="#a45c45";line.append(link);}else line.textContent=text;p.append(line);}panel.append(p);
  });
}
function activateGraph(el,fn){el.setAttribute("role","button");el.setAttribute("tabindex","0");el.style.cursor="pointer";el.addEventListener("click",e=>{e.stopPropagation();fn();});el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();fn();}});}
function renderAuthorsGraph(){
  const svg=document.getElementById("tree");svg.replaceChildren();
  const group=svgElement("g",{id:"tree-content",transform:`translate(${offsetX} ${offsetY}) scale(${zoom})`});svg.append(group);
  const neighbors=new Set(selectedAuthor?[selectedAuthor]:[]);
  authorEdges.forEach(e=>{if(e.a===selectedAuthor)neighbors.add(e.b);if(e.b===selectedAuthor)neighbors.add(e.a);});
  const entries=[...authorEdges.entries()].sort(([,a],[,b])=>Number(a.a===selectedAuthor||a.b===selectedAuthor)-Number(b.a===selectedAuthor||b.b===selectedAuthor));
  entries.forEach(([key,e])=>{
    const a=authorPoints.get(e.a),b=authorPoints.get(e.b),active=!selectedAuthor||e.a===selectedAuthor||e.b===selectedAuthor;
    const attrs={x1:a.x,y1:a.y,x2:b.x,y2:b.y};
    const g=svgElement("g",{"aria-label":e.a+" と "+e.b+" のつながり"});
    g.append(svgElement("line",{...attrs,stroke:key===chosenEdge||selectedAuthor&&active?"#a45c45":"#c8beac","stroke-width":key===chosenEdge?2.5:selectedAuthor&&active?1.7:1,opacity:active?1:0.12}));
    if(active){g.append(svgElement("line",{...attrs,stroke:"transparent","stroke-width":14,"vector-effect":"non-scaling-stroke"}));activateGraph(g,()=>{chosenEdge=key;authorDetails(e);renderAuthorsGraph();});}
    group.append(g);
  });
  authorPoints.forEach((p,name)=>{
    const g=svgElement("g",{transform:`translate(${p.x} ${p.y})`,opacity:!selectedAuthor||neighbors.has(name)?1:0.22,"aria-label":name,"aria-pressed":String(name===selectedAuthor)});
    g.append(svgElement("circle",{r:30,fill:"#e9e4dc",stroke:name===selectedAuthor?"#a45c45":"#d5cbbb","stroke-width":2}));
    const initial=svgElement("text",{y:5,"text-anchor":"middle","font-size":15,fill:"#555"});initial.textContent=Array.from(name)[0]||"?";g.append(initial); const icon=works.find(w=>w.author===name&&w.icon)?.icon; if(icon){const img=svgElement("image",{href:icon,x:-28,y:-28,width:56,height:56,preserveAspectRatio:"xMidYMid slice"});img.style.clipPath="circle(50%)";g.append(img);}
    g.append(svgElement("rect",{x:-78,y:34,width:156,height:24,rx:5,fill:"white"}));
    const label=svgElement("text",{y:50,"text-anchor":"middle","font-size":14,fill:name===selectedAuthor?"#a45c45":"#51483b"});label.textContent=Array.from(name).length>10?Array.from(name).slice(0,9).join("")+"…":name; const tip=svgElement("title");tip.textContent=name;g.append(tip);g.append(label);
    activateGraph(g,()=>{selectAuthor(selectedAuthor===name?"":name);});group.append(g);
  });
  document.getElementById("status").textContent=selectedAuthor?selectedAuthor+" と直接つながった作者を表示中。線を押すと作品が分かります。":"作者を押すとつながりが強調されます。線を押すと作品が分かります。";
}
function fitAuthorsGraph(){
  const svg=document.getElementById("tree"),p=[...authorPoints.values()];if(!p.length||!svg.clientWidth||!svg.clientHeight)return;
  const minX=Math.min(...p.map(a=>a.x))-90,maxX=Math.max(...p.map(a=>a.x))+90,minY=Math.min(...p.map(a=>a.y))-45,maxY=Math.max(...p.map(a=>a.y))+75;
  zoom=Math.min(1,svg.clientWidth/(maxX-minX),svg.clientHeight/(maxY-minY));offsetX=svg.clientWidth/2-(minX+maxX)/2*zoom;offsetY=svg.clientHeight/2-(minY+maxY)/2*zoom;updateTransform();
}
function createAuthorViewControls(){
  const toolbar=document.querySelector(".toolbar");const select=document.createElement("select");select.setAttribute("aria-label","つながりの表示方法");select.add(new Option("作品のつながり","works"));select.add(new Option("作者のつながり","authors"));Object.assign(select.style,{padding:"8px",maxWidth:"100%",border:"1px solid #e2ded8",borderRadius:"5px",background:"white",color:"#333"});toolbar.prepend(select);
  const panel=document.createElement("div");panel.id="author-details";panel.hidden=true;Object.assign(panel.style,{padding:"8px 12px",maxHeight:"120px",overflow:"auto",fontSize:"13px",background:"#fffdf8",color:"#51483b",overflowWrap:"anywhere"});const viewer=document.querySelector(".viewer");viewer.style.position="relative";Object.assign(panel.style,{position:"absolute",top:"70px",right:"10px",width:"min(360px, calc(100% - 20px))",boxSizing:"border-box",maxHeight:"min(240px, 40vh)",zIndex:"5",border:"1px solid #ddd5c6",borderRadius:"8px",boxShadow:"0 3px 12px #0002"});viewer.append(panel);
  select.onchange=()=>{authorView=select.value==="authors";chosenEdge="";authorDetails(null);document.querySelector(".mode-area").style.display=authorView?"none":"";syncFocusControls();renderAuthors();refreshSelection();};
}


document.addEventListener("DOMContentLoaded", init);
