let works = [];
let positions = new Map();
let overlapping = new Set();
let collapsed = new Set();
let branchMap = new Map();
let suppressClickUntil = 0;
const CONTROL_HEIGHT = 24;

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

function calculateLayout(layoutType) {
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

  if (layoutType === "original") {
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

  if (layoutType === "compact") {
    calculateCompactLayout(levels, root.id);
    return;
  }

  const safeDistance = Math.hypot(
    CARD_WIDTH + GAP,
    CARD_HEIGHT + CONTROL_HEIGHT + GAP
  );

  let previousRadius = 0;

  const sortedLevels = [...levels.entries()]
    .sort((a, b) => a[0] - b[0]);

  sortedLevels.forEach(([depth, ids]) => {
    if (depth === 0) return;

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

function calculateCompactLayout(levels, rootId) {
  const occupied = new Map();

  const cellWidth = CARD_WIDTH + GAP;
  const cellHeight = CARD_HEIGHT + CONTROL_HEIGHT + GAP;

  const workMap = new Map(
    works.map(w => [w.id, w])
  );

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

        if (best && (ring + 1) * 125 >= bestScore) {
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
        Math.abs(a.y - b.y) < CARD_HEIGHT + CONTROL_HEIGHT;

      if (horizontal && vertical) {
        overlapping.add(idA);
        overlapping.add(idB);
        pairs++;
      }
    }
  }

  return pairs;
}

function getBounds() {
  const points = [...positions.values()];

  const minX =
    Math.min(...points.map(p => p.x)) -
    CARD_WIDTH / 2;

  const maxX =
    Math.max(...points.map(p => p.x)) +
    CARD_WIDTH / 2;

  const minY =
    Math.min(...points.map(p => p.y)) -
    CARD_HEIGHT / 2;

  const maxY =
    Math.max(...points.map(p => p.y)) +
    CARD_HEIGHT / 2 + CONTROL_HEIGHT;

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function measureSize() {
  const bounds = getBounds();

  const area = bounds.width * bounds.height;

  const density =
    works.length *
    CARD_WIDTH *
    CARD_HEIGHT /
    area * 100;

  setResult(
    "result-width",
    Math.round(bounds.width).toLocaleString() + " px"
  );

  setResult(
    "result-height",
    Math.round(bounds.height).toLocaleString() + " px"
  );

  setResult(
    "result-area",
    (area / 1000000).toFixed(2) + " Mpx²"
  );

  setResult(
    "result-density",
    density.toFixed(2) + "%"
  );
}

function visibleWorks() {
  const visible = new Set();
  const stack = works.filter(w => !w.parent).map(w => w.id);
  while (stack.length) {
    const id = stack.pop();
    if (visible.has(id)) continue;
    visible.add(id);
    if (!collapsed.has(id)) stack.push(...(branchMap.get(id) || []));
  }
  return visible;
}

function branchControl(id) {
  const closed = collapsed.has(id);
  const g = svgElement("g", {role:"button", tabindex:0,
    "aria-label": closed ? "つづきを開く" : "枝を折りたたむ",
    "aria-expanded": String(!closed), "data-branch":id});
  g.style.cursor = "pointer";
  g.appendChild(svgElement("rect", {x:-44,y:32,width:88,height:32,rx:12,fill:"transparent"}));
  g.appendChild(svgElement("rect", {x:closed?-36:-11,y:39,width:closed?72:22,height:22,rx:11,fill:"white",stroke:closed?"#b93636":"#c9c4bd"}));
  const label = svgElement("text", {x:0,y:54,"text-anchor":"middle","font-size":12,fill:closed?"#b93636":"#888888","pointer-events":"none"});
  label.textContent = closed ? "つづき ▾" : "▴";
  g.appendChild(label);
  function toggle(e) {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "click" && Date.now() < suppressClickUntil) return;
    if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
    render();
    document.getElementById("status").textContent = "表示中：" + visibleWorks().size + " / " + works.length + "（テスト用）";
    if (e.type === "keydown") document.querySelector(`[data-branch="${id}"]`)?.focus();
  }
  g.addEventListener("click", toggle);
  g.addEventListener("keydown", e => {if(e.key === "Enter" || e.key === " ") toggle(e);});
  return g;
}

function render(measure = false) {
  if (authorView) { renderAuthorsGraph(); return; }
  const start = performance.now();

  const svg = document.getElementById("tree");

  svg.replaceChildren();

  const group = svgElement("g", {
    id: "tree-content",
    transform:
      `translate(${offsetX} ${offsetY}) scale(${zoom})`
  });

  svg.appendChild(group);
  const visible = visibleWorks();

  works.forEach(w => {
    if (!w.parent || !visible.has(w.id) || !visible.has(w.parent)) return;

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

    if (!p || !visible.has(w.id)) return;

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

    if (branchMap.has(w.id)) node.appendChild(branchControl(w.id));
    group.appendChild(node);
  });

  if (measure) {
    const elapsed = performance.now() - start;

    setResult(
      "result-render-time",
      elapsed.toFixed(2) + " ms"
    );
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
  if (authorView) { fitAuthorsGraph(); return; }
  const svg = document.getElementById("tree");

  if (!positions.size) return;

  if (!svg.clientWidth || !svg.clientHeight) return;

  const bounds = getBounds();

  zoom = Math.min(
    svg.clientWidth / (bounds.width + 50),
    svg.clientHeight / (bounds.height + 50),
    1
  );

  offsetX =
    svg.clientWidth / 2 -
    (bounds.minX + bounds.maxX) / 2 * zoom;

  offsetY =
    svg.clientHeight / 2 -
    (bounds.minY + bounds.maxY) / 2 * zoom;

  updateTransform();

  setResult(
    "result-fit-zoom",
    (zoom * 100).toFixed(3) + "%"
  );
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

  if (!el) return;

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

  const layoutType =
    document.getElementById("layout-type").value;

  const key = count + ":" + pattern;

  if (dataKey !== key) {
    works = generateWorks(count, pattern);
    dataKey = key;
  }

  if (authorView) {
    chosenAuthor=""; chosenEdge=""; authorDetails(null); buildAuthorGraph();
    document.querySelector(".test-results").hidden=true;
    document.getElementById("layout-type").disabled=true;
    document.getElementById("toggle-overlap").disabled=true;
    renderAuthorsGraph(); fitAuthorsGraph(); return;
  }
  document.querySelector(".test-results").hidden=false;
  document.getElementById("layout-type").disabled=false;
  document.getElementById("toggle-overlap").disabled=false;
  collapsed.clear();
  branchMap = new Map();
  works.forEach(w => {
    if (!w.parent) return;
    if (!branchMap.has(w.parent)) branchMap.set(w.parent, []);
    branchMap.get(w.parent).push(w.id);
  });
  const start = performance.now();

  calculateLayout(layoutType);

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

  measureSize();

  render(true);

  fitTree();

  document.getElementById("status").textContent =
    overlapping.size === 0
      ? "カードの重なりはありません。"
      : "赤いカードは他のカードと重なっています。";
}

function setupGestures(svg) {
  const pointers = new Map();
  let moved = false;
  function point(e) { const r=svg.getBoundingClientRect(); return {x:e.clientX-r.left,y:e.clientY-r.top}; }
  function capture(id) { try { svg.setPointerCapture(id); } catch {} }
  svg.addEventListener("wheel",e=>{e.preventDefault();const p=point(e);changeZoom(e.deltaY<0?1.12:1/1.12,p.x,p.y);},{passive:false});
  svg.addEventListener("pointerdown",e=>{
    if(e.pointerType==="mouse" && e.button!==0)return;
    if(!pointers.size){moved=false;suppressClickUntil=0;}
    const p=point(e);pointers.set(e.pointerId,{...p,startX:p.x,startY:p.y});
    if(pointers.size>=2){moved=true;pointers.forEach((p,id)=>capture(id));}
  });
  svg.addEventListener("pointermove",e=>{
    if(!pointers.has(e.pointerId))return;
    const before=[...pointers.values()];const prev=pointers.get(e.pointerId),p=point(e);
    pointers.set(e.pointerId,{...prev,...p});const after=[...pointers.values()];
    if(after.length===1){
      if(!moved){if(Math.hypot(p.x-prev.startX,p.y-prev.startY)<6)return;moved=true;capture(e.pointerId);offsetX+=p.x-prev.startX;offsetY+=p.y-prev.startY;}
      else {offsetX+=p.x-prev.x;offsetY+=p.y-prev.y;}
    }else{
      moved=true;const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);const c=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
      const old=d(before[0],before[1]);if(old<1)return;
      const a=c(before[0],before[1]),b=c(after[0],after[1]);
      const next=Math.max(0.000001,Math.min(4,zoom*d(after[0],after[1])/old));
      offsetX=b.x-(a.x-offsetX)*next/zoom;offsetY=b.y-(a.y-offsetY)*next/zoom;zoom=next;
    }updateTransform();
  });
  function end(e){if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);if(moved)suppressClickUntil=Date.now()+400;if(!pointers.size)moved=false;}
  ["pointerup","pointercancel","lostpointercapture"].forEach(type=>svg.addEventListener(type,end));
  window.addEventListener("pointerup",end);window.addEventListener("pointercancel",end);
  svg.addEventListener("click",e=>{if(Date.now()<suppressClickUntil){e.preventDefault();e.stopPropagation();}},true);
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
    () => { if(authorView){chosenAuthor="";chosenEdge="";authorDetails(null);renderAuthorsGraph();} fitTree(); };

  createAuthorViewControls();
  setupGestures(svg);

  window.addEventListener("resize", fitTree);

  runTest();
}


let authorView = false;
let chosenAuthor = "";
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
  const random=seededRandom(20261126);
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
      const a=nodes[i],b=nodes[j],x=b.x-a.x,y=b.y-a.y,ox=170-Math.abs(x),oy=94-Math.abs(y);
      if(ox>0&&oy>0){if(ox<oy){const k=(ox+0.1)/2*(x>=0?1:-1);a.x-=k;b.x+=k;}else{const k=(oy+0.1)/2*(y>=0?1:-1);a.y-=k;b.y+=k;}}
    }
  }
  // Final deterministic collision guard, including name labels.
  const placed=[];
  for(const p of nodes){
    const free=(x,y)=>placed.every(q=>Math.abs(q.x-x)>=170||Math.abs(q.y-y)>=94);
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
  const close=document.createElement("button");close.textContent="閉じる ×";close.style.cssText="float:right;cursor:pointer;background:white;border:1px solid #ddd;border-radius:4px;padding:5px";close.onclick=()=>{chosenEdge="";authorDetails(null);renderAuthorsGraph();};panel.append(close);
  const heading=document.createElement("strong");heading.textContent="二人をつないだ作品";panel.append(heading);
  edge.links.forEach(({parent,child})=>{
    const p=document.createElement("div");p.style.cssText="clear:both;border-top:1px solid #e2ded8;margin-top:8px;padding-top:8px";
    for(const text of ["乗っ取り元："+parent.author+"「"+parent.title+"」","↓ ことばを乗っ取り","乗っ取った作品："+child.author+"「"+child.title+"」"]){const line=document.createElement("div");line.textContent=text;p.append(line);}panel.append(p);
  });
}
function activateGraph(el,fn){el.setAttribute("role","button");el.setAttribute("tabindex","0");el.style.cursor="pointer";el.addEventListener("click",e=>{e.stopPropagation();fn();});el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();fn();}});}
function renderAuthorsGraph(){
  const svg=document.getElementById("tree");svg.replaceChildren();
  const group=svgElement("g",{id:"tree-content",transform:`translate(${offsetX} ${offsetY}) scale(${zoom})`});svg.append(group);
  const neighbors=new Set(chosenAuthor?[chosenAuthor]:[]);
  authorEdges.forEach(e=>{if(e.a===chosenAuthor)neighbors.add(e.b);if(e.b===chosenAuthor)neighbors.add(e.a);});
  const entries=[...authorEdges.entries()].sort(([,a],[,b])=>Number(a.a===chosenAuthor||a.b===chosenAuthor)-Number(b.a===chosenAuthor||b.b===chosenAuthor));
  entries.forEach(([key,e])=>{
    const a=authorPoints.get(e.a),b=authorPoints.get(e.b),active=!chosenAuthor||e.a===chosenAuthor||e.b===chosenAuthor;
    const attrs={x1:a.x,y1:a.y,x2:b.x,y2:b.y};
    const g=svgElement("g",{"aria-label":e.a+" と "+e.b+" のつながり"});
    g.append(svgElement("line",{...attrs,stroke:key===chosenEdge?"#b93636":"#a49e96","stroke-width":1.5,opacity:active?1:0.12}));
    if(active){g.append(svgElement("line",{...attrs,stroke:"transparent","stroke-width":14,"vector-effect":"non-scaling-stroke"}));activateGraph(g,()=>{chosenEdge=key;authorDetails(e);renderAuthorsGraph();});}
    group.append(g);
  });
  authorPoints.forEach((p,name)=>{
    const g=svgElement("g",{transform:`translate(${p.x} ${p.y})`,opacity:!chosenAuthor||neighbors.has(name)?1:0.22,"aria-label":name,"aria-pressed":String(name===chosenAuthor)});
    g.append(svgElement("circle",{r:25,fill:"#e9e4dc",stroke:name===chosenAuthor?"#b93636":"#bcb7b0","stroke-width":2}));
    const initial=svgElement("text",{y:5,"text-anchor":"middle","font-size":15,fill:"#555"});initial.textContent=name.replace("テスト作者", "").trim()||"作";g.append(initial);
    g.append(svgElement("rect",{x:-78,y:30,width:156,height:24,rx:4,fill:"white"}));
    const label=svgElement("text",{y:46,"text-anchor":"middle","font-size":12,fill:"#333"});label.textContent=name;g.append(label);
    activateGraph(g,()=>{chosenAuthor=chosenAuthor===name?"":name;chosenEdge="";authorDetails(null);renderAuthorsGraph();});group.append(g);
  });
  document.getElementById("status").textContent=chosenAuthor?chosenAuthor+" と直接つながった作者を表示中。線を押すと作品が分かります。":"作者を押すとつながりが強調されます。線を押すと作品が分かります。";
}
function fitAuthorsGraph(){
  const svg=document.getElementById("tree"),p=[...authorPoints.values()];if(!p.length||!svg.clientWidth||!svg.clientHeight)return;
  const minX=Math.min(...p.map(a=>a.x))-90,maxX=Math.max(...p.map(a=>a.x))+90,minY=Math.min(...p.map(a=>a.y))-45,maxY=Math.max(...p.map(a=>a.y))+75;
  zoom=Math.min(1,svg.clientWidth/(maxX-minX),svg.clientHeight/(maxY-minY));offsetX=svg.clientWidth/2-(minX+maxX)/2*zoom;offsetY=svg.clientHeight/2-(minY+maxY)/2*zoom;updateTransform();
}
function createAuthorViewControls(){
  const toolbar=document.querySelector(".toolbar");const select=document.createElement("select");select.setAttribute("aria-label","つながりの表示方法");select.add(new Option("作品のつながり","works"));select.add(new Option("作者のつながり","authors"));Object.assign(select.style,{padding:"8px",maxWidth:"100%",border:"1px solid #e2ded8",borderRadius:"5px",background:"white",color:"#333"});toolbar.prepend(select);
  const panel=document.createElement("div");panel.id="author-details";panel.hidden=true;Object.assign(panel.style,{padding:"8px 12px",maxHeight:"120px",overflow:"auto",fontSize:"13px",background:"#faf9f6",overflowWrap:"anywhere"});const viewer=document.querySelector(".viewer");viewer.style.position="relative";Object.assign(panel.style,{position:"absolute",top:"70px",right:"10px",width:"min(360px, calc(100% - 20px))",boxSizing:"border-box",maxHeight:"min(240px, 40vh)",zIndex:"5",border:"1px solid #e2ded8",borderRadius:"8px",boxShadow:"0 3px 12px #0002"});viewer.append(panel);
  select.onchange=()=>{authorView=select.value==="authors";chosenAuthor="";chosenEdge="";authorDetails(null);runTest();};
}

 document.addEventListener("DOMContentLoaded", init);
