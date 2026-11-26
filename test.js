
let works = [];
let positions = new Map();
let overlapping = new Set();

let zoom = 1;
let offsetX = 0;
let offsetY = 0;

let showOverlap = true;
let dataKey = "";

const NS = "http://www.w3.org/2000/svg";

const CARD_WIDTH = 230;
const CARD_HEIGHT = 80;
const GAP = 20;

function svgElement(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);

  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, value);
  });

  return el;
}

function seededRandom(seed) {
  let value = seed >>> 0;

  return function () {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function generateWorks(count, pattern) {
  const random = seededRandom(20261126);

  const data = [{
    id: "test-0",
    title: "乗っ取られて、嬉しい。",
    author: "テスト作者",
    parent: null,
    verified: true
  }];

  for (let i = 1; i < count; i++) {
    let parentIndex = 0;

    switch (pattern) {
      case "star":
        parentIndex = 0;
        break;

      case "chain":
        parentIndex = i - 1;
        break;

      case "balanced":
        parentIndex = Math.floor((i - 1) / 3);
        break;

      case "cluster":
        if (i < 6) {
          parentIndex = 0;
        } else if (random() < 0.7) {
          parentIndex =
            1 + Math.floor(random() * 5);
        } else {
          parentIndex = Math.floor(random() * i);
        }
        break;

      default:
        parentIndex = Math.floor(random() * i);
    }

    data.push({
      id: "test-" + i,
      title: "架空の参加作品 " + i,
      author: "テスト作者 " + (i % 40 + 1),
      parent: "test-" + parentIndex,
      verified: true
    });
  }

  return data;
}

function calculateLayout(improved) {
  positions.clear();

  const root = works.find(w => !w.parent);

  if (!root) return;

  const childMap = new Map();
  const weights = new Map();
  const levels = new Map();

  works.forEach(w => {
    if (!childMap.has(w.parent)) {
      childMap.set(w.parent, []);
    }

    childMap.get(w.parent).push(w);
  });

  function getChildren(id) {
    return childMap.get(id) || [];
  }

  function getWeight(id) {
    if (weights.has(id)) {
      return weights.get(id);
    }

    let weight = 1;

    getChildren(id).forEach(child => {
      weight += getWeight(child.id);
    });

    weights.set(id, weight);

    return weight;
  }

  getWeight(root.id);

  function place(work, depth, start, end) {
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

    const list = getChildren(work.id);

    const total = list.reduce(
      (sum, child) => sum + getWeight(child.id),
      0
    );

    let cursor = start;

    list.forEach(child => {
      const span =
        (end - start) * getWeight(child.id) / total;

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

  if (!improved) {
    const step = Math.max(
      260,
      ...Array.from(levels.entries()).map(
        ([depth, ids]) =>
          depth > 0
            ? ids.length * 280 /
              (2 * Math.PI * depth)
            : 0
      )
    );

    positions.forEach(p => {
      p.x = Math.cos(p.angle) * p.depth * step;
      p.y = Math.sin(p.angle) * p.depth * step;
    });

    return;
  }

  const safeDistance = Math.hypot(
    CARD_WIDTH + GAP,
    CARD_HEIGHT + GAP
  );

  let previousRadius = 0;

  const sortedLevels = [...levels.entries()]
    .sort((a, b) => a[0] - b[0]);

  sortedLevels.forEach(([depth, ids]) => {
    if (depth === 0) {
      return;
    }

    const angles = ids.map(
      id => positions.get(id).angle
    ).sort((a, b) => a - b);

    let minimumAngle = Math.PI * 2;

    if (angles.length > 1) {
      for (let i = 0; i < angles.length; i++) {
        const next =
          i === angles.length - 1
            ? angles[0] + Math.PI * 2
            : angles[i + 1];

        minimumAngle = Math.min(
          minimumAngle,
          next - angles[i]
        );
      }
    }

    let radius = previousRadius + safeDistance;

    if (angles.length > 1) {
      const chordRadius =
        safeDistance /
        (2 * Math.sin(minimumAngle / 2));

      radius = Math.max(radius, chordRadius);
    }

    ids.forEach(id => {
      const p = positions.get(id);

      p.x = Math.cos(p.angle) * radius;
      p.y = Math.sin(p.angle) * radius;
    });

    previousRadius = radius;
  });
}

function detectOverlaps() {
  overlapping.clear();

  let pairs = 0;

  const points = [...positions.entries()];

  for (let i = 0; i < points.length; i++) {
    const [idA, a] = points[i];

    for (let j = i + 1; j < points.length; j++) {
      const [idB, b] = points[j];

      const horizontal =
        Math.abs(a.x - b.x) < CARD_WIDTH;

      const vertical =
        Math.abs(a.y - b.y) < CARD_HEIGHT;

      if (horizontal && vertical) {
        overlapping.add(idA);
        overlapping.add(idB);
        pairs++;
      }
    }
  }

  return pairs;
}

function render(measure = false) {
  const start = performance.now();

  const svg = document.getElementById("tree");

  svg.replaceChildren();

  const group = svgElement("g", {
    id: "tree-content",
    transform:
      `translate(${offsetX} ${offsetY}) scale(${zoom})`
  });

  svg.appendChild(group);

  works.forEach(w => {
    if (!w.parent) return;

    const a = positions.get(w.parent);
    const b = positions.get(w.id);

    if (!a || !b) return;

    group.appendChild(svgElement("line", {
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      stroke: "#bcb7b0",
      "stroke-width": 1.5
    }));
  });

  works.forEach(w => {
    const p = positions.get(w.id);

    if (!p) return;

    const collision =
      showOverlap && overlapping.has(w.id);

    const node = svgElement("g", {
      transform: `translate(${p.x} ${p.y})`
    });

    const rect = svgElement("rect", {
      x: -CARD_WIDTH / 2,
      y: -CARD_HEIGHT / 2,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      rx: 8,
      fill: collision ? "#fbe1e1" : "#ffffff",
      stroke: collision ? "#b93636" : "#c9c4bd",
      "stroke-width": collision ? 3 : 1
    });

    node.appendChild(rect);

    const title = svgElement("text", {
      x: 0,
      y: -8,
      "text-anchor": "middle",
      "font-size": 13,
      "font-weight": 600,
      fill: "#333333"
    });

    title.textContent = w.title;

    node.appendChild(title);

    const icon = svgElement("circle", {
      cx: -65,
      cy: 20,
      r: 9,
      fill: "#aaa6a0"
    });

    node.appendChild(icon);

    const author = svgElement("text", {
      x: 8,
      y: 24,
      "text-anchor": "middle",
      "font-size": 11,
      fill: "#777777"
    });

    author.textContent = w.author;

    node.appendChild(author);

    const tooltip = svgElement("title");

    tooltip.textContent =
      w.title + " / " + w.author;

    node.appendChild(tooltip);

    group.appendChild(node);
  });

  if (measure) {
    const elapsed = performance.now() - start;

    document.getElementById(
      "result-render-time"
    ).textContent = elapsed.toFixed(2) + " ms";
  }
}

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

  if (!positions.size) return;

  const points = [...positions.values()];

  const minX =
    Math.min(...points.map(p => p.x)) - 140;

  const maxX =
    Math.max(...points.map(p => p.x)) + 140;

  const minY =
    Math.min(...points.map(p => p.y)) - 65;

  const maxY =
    Math.max(...points.map(p => p.y)) + 65;

  zoom = Math.min(
    svg.clientWidth / (maxX - minX),
    svg.clientHeight / (maxY - minY),
    1
  );

  offsetX =
    svg.clientWidth / 2 - (minX + maxX) / 2 * zoom;

  offsetY =
    svg.clientHeight / 2 - (minY + maxY) / 2 * zoom;

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

function setResult(id, value, good = null) {
  const el = document.getElementById(id);

  el.textContent = value;

  el.classList.remove("result-good", "result-bad");

  if (good !== null) {
    el.classList.add(
      good ? "result-good" : "result-bad"
    );
  }
}

function runTest() {
  const count = Number(
    document.getElementById("work-count").value
  );

  const pattern =
    document.getElementById("tree-pattern").value;

  const improved =
    document.getElementById("layout-type").value
      === "improved";

  const key = count + ":" + pattern;

  if (dataKey !== key) {
    works = generateWorks(count, pattern);
    dataKey = key;
  }

  const start = performance.now();

  calculateLayout(improved);

  const layoutTime = performance.now() - start;

  const pairs = detectOverlaps();

  const depth = Math.max(
    ...[...positions.values()].map(p => p.depth)
  );

  setResult("result-count", works.length);

  setResult(
    "result-overlap",
    overlapping.size,
    overlapping.size === 0
  );

  setResult(
    "result-pairs",
    pairs,
    pairs === 0
  );

  setResult("result-depth", depth);

  setResult(
    "result-time",
    layoutTime.toFixed(2) + " ms"
  );

  render(true);

  fitTree();

  document.getElementById("status").textContent =
    overlapping.size === 0
      ? "カードの重なりはありません。"
      : "赤いカードは他のカードと重なっています。";
}

function setupGestures(svg) {
  const pointers = new Map();

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

    pointers.set(e.pointerId, point(e));

    try {
      svg.setPointerCapture(e.pointerId);
    } catch {}
  });

  svg.addEventListener("pointermove", e => {
    if (!pointers.has(e.pointerId)) return;

    const before = [...pointers.values()];

    const previous = pointers.get(e.pointerId);
    const next = point(e);

    pointers.set(e.pointerId, next);

    const after = [...pointers.values()];

    if (after.length === 1) {
      offsetX += next.x - previous.x;
      offsetY += next.y - previous.y;

    } else if (after.length >= 2) {
      const oldDistance =
        distance(before[0], before[1]);

      const newDistance =
        distance(after[0], after[1]);

      if (oldDistance < 1) return;

      const oldCenter = center(before[0], before[1]);
      const newCenter = center(after[0], after[1]);

      const nextZoom = Math.max(
        0.000001,
        Math.min(4, zoom * newDistance / oldDistance)
      );

      const ratio = nextZoom / zoom;

      offsetX =
        newCenter.x - (oldCenter.x - offsetX) * ratio;

      offsetY =
        newCenter.y - (oldCenter.y - offsetY) * ratio;

      zoom = nextZoom;
    }

    updateTransform();
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
  }

  svg.addEventListener("pointerup", endPointer);
  svg.addEventListener("pointercancel", endPointer);
  svg.addEventListener("lostpointercapture", endPointer);
}

function init() {
  const svg = document.getElementById("tree");

  document.getElementById("generate").onclick =
    runTest;

  document.getElementById("layout-type").onchange =
    runTest;

  document.getElementById("toggle-overlap").onclick =
    () => {
      showOverlap = !showOverlap;
      render();
    };

  document.getElementById("zoom-in").onclick =
    () => changeZoom(1.2);

  document.getElementById("zoom-out").onclick =
    () => changeZoom(1 / 1.2);

  document.getElementById("reset").onclick =
    fitTree;

  setupGestures(svg);

  window.addEventListener("resize", fitTree);

  runTest();
}

document.addEventListener("DOMContentLoaded", init);
