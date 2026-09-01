import { ARCHITECTURE_WORKFLOWS, WORKFLOW_ICONS } from "./shared/architecture-workflows.mjs";

const SIDEBAR_IDS = {
  dataFlow: "local",
  deployPipeline: "artifacts",
  edgeCases: "policy",
  scheduledOps: "schedules",
};

/**
 * @param {string} iconKey
 */
function iconSvg(iconKey) {
  const paths = WORKFLOW_ICONS[/** @type {keyof typeof WORKFLOW_ICONS} */ (iconKey)] ?? WORKFLOW_ICONS.brain;
  return `<svg class="arch-flow-node-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

/**
 * @param {import('./shared/architecture-workflows.mjs').WorkflowNode} node
 */
function nodeHtml(node) {
  return `
    <div class="arch-flow-node arch-flow-node--${node.tone}" data-flow-node="${node.id}" tabindex="-1">
      <div class="arch-flow-node-glow" aria-hidden="true"></div>
      <div class="arch-flow-node-inner">
        ${iconSvg(node.icon)}
        <div class="arch-flow-node-copy">
          <span class="arch-flow-node-label">${node.label}</span>
          ${node.sub ? `<span class="arch-flow-node-sub">${node.sub}</span>` : ""}
        </div>
      </div>
    </div>`;
}

/**
 * @param {import('./shared/architecture-workflows.mjs').WorkflowView} view
 * @param {string} viewKey
 */
function buildWorkflowMarkup(view, viewKey) {
  const sidebarId = SIDEBAR_IDS[/** @type {keyof typeof SIDEBAR_IDS} */ (viewKey)] ?? "sidebar";
  const rows = view.rows
    .map((row) => {
      const cells = row.map((node) => nodeHtml(node)).join("");
      const branchClass = row.length > 1 ? " arch-flow-row--branch" : "";
      return `<div class="arch-flow-row${branchClass}">${cells}</div>`;
    })
    .join("");

  const sidebar = view.sidebar
    ? `
    <aside class="arch-flow-sidebar" data-flow-node="${sidebarId}">
      <div class="arch-flow-sidebar-glow" aria-hidden="true"></div>
      <div class="arch-flow-sidebar-inner">
        <div class="arch-flow-sidebar-head">
          ${iconSvg("database")}
          <span class="arch-flow-sidebar-title">${view.sidebar.title}</span>
        </div>
        <ul class="arch-flow-sidebar-list">
          ${view.sidebar.items.map((item) => `<li>${item}</li>`).join("")}
        </ul>
      </div>
    </aside>`
    : "";

  return `
    <div class="arch-flow" data-flow-view="${viewKey}" role="img" aria-label="${view.ariaLabel}">
      <div class="arch-flow-grid" aria-hidden="true"></div>
      <div class="arch-flow-layout">
        <div class="arch-flow-main">${rows}</div>
        ${sidebar}
        <svg class="arch-flow-edges" aria-hidden="true"></svg>
      </div>
    </div>`;
}

/**
 * @param {DOMRect} from
 * @param {DOMRect} to
 * @param {DOMRect} stage
 * @param {boolean} [feedback]
 */
function edgePathD(from, to, stage, feedback = false) {
  const x1 = from.left + from.width / 2 - stage.left;
  const y1 = from.bottom - stage.top;
  const x2 = to.left + to.width / 2 - stage.left;
  const y2 = to.top - stage.top;

  if (feedback) {
    const bend = Math.max(48, Math.abs(x2 - x1) * 0.35);
    return `M ${x1} ${y1} C ${x1 + bend} ${y1 + 24}, ${x2 + bend} ${y2 - 24}, ${x2} ${y2}`;
  }

  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
}

/**
 * @param {HTMLElement} root
 * @param {import('./shared/architecture-workflows.mjs').WorkflowView} view
 */
function drawEdges(root, view, reducedMotion = false) {
  const stage = root.querySelector(".arch-flow-layout");
  const svg = root.querySelector(".arch-flow-edges");
  if (!stage || !svg) return;

  const stageRect = stage.getBoundingClientRect();
  const width = stage.offsetWidth;
  const height = stage.offsetHeight;
  if (width < 8 || height < 8) return;

  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const nodeMap = new Map(
    [...root.querySelectorAll("[data-flow-node]")].map((el) => [el.dataset.flowNode, el])
  );

  const gradId = `arch-edge-grad-${root.dataset.flowView}`;

  const paths = view.edges
    .map((edge, index) => {
      const fromEl = nodeMap.get(edge.from);
      const toEl = nodeMap.get(edge.to);
      if (!fromEl || !toEl) return "";

      const d = edgePathD(
        fromEl.getBoundingClientRect(),
        toEl.getBoundingClientRect(),
        stageRect,
        edge.feedback
      );
      const dash = edge.dashed ? ' stroke-dasharray="7 9"' : "";
      const cls = edge.dashed ? "arch-flow-edge arch-flow-edge--dashed" : "arch-flow-edge";
      const delay = `${index * 0.08}s`;
      const stroke = edge.dashed ? ' stroke="rgba(148, 163, 184, 0.5)"' : ` stroke="url(#${gradId})"`;

      const pulse = edge.dashed || reducedMotion
        ? ""
        : `<circle class="arch-flow-pulse" r="3.5" fill="url(#${gradId})">
            <animateMotion dur="2.4s" repeatCount="indefinite" begin="${delay}" path="${d}" />
          </circle>`;

      return `<path class="${cls}" data-edge="${edge.from}-${edge.to}" d="${d}"${stroke}${dash} />${pulse}`;
    })
    .join("");

  svg.innerHTML = `
    <defs>
      <linearGradient id="${gradId}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="rgba(77, 159, 255, 0.9)" />
        <stop offset="100%" stop-color="rgba(124, 92, 255, 0.9)" />
      </linearGradient>
    </defs>
    ${paths}`;

  if (reducedMotion) {
    svg.querySelectorAll(".arch-flow-pulse").forEach((el) => el.remove());
  }
}

/**
 * @param {HTMLElement} root
 * @param {import('./shared/architecture-workflows.mjs').WorkflowView} view
 * @param {boolean} reducedMotion
 */
function startSimulation(root, view, reducedMotion) {
  const path = view.simulationPath ?? [];
  const nodes = [...root.querySelectorAll(".arch-flow-node")];
  if (!path.length || !nodes.length) return () => {};

  const existing = Number(root.dataset.simTimer ?? "0");
  if (existing) window.clearTimeout(existing);

  let step = 0;

  const tick = () => {
    const activeId = path[step % path.length];
    nodes.forEach((node) => {
      const id = node.dataset.flowNode;
      node.classList.toggle("is-active", id === activeId);
      if (id === activeId) node.classList.add("is-visited");
    });
    const sidebar = root.querySelector(".arch-flow-sidebar");
    const stateSteps = new Set([
      "local",
      "artifacts",
      "policy",
      "schedules",
      "db",
      "kv",
      "cache",
      "guards",
      "unified",
      "croncfg",
    ]);
    sidebar?.classList.toggle("is-active", stateSteps.has(activeId));
    step += 1;
    if (!reducedMotion) {
      const timer = window.setTimeout(tick, 1400);
      root.dataset.simTimer = String(timer);
    }
  };

  if (reducedMotion) {
    nodes[0]?.classList.add("is-active");
    return () => {};
  }

  tick();
  return () => {
    const timer = Number(root.dataset.simTimer ?? "0");
    if (timer) window.clearTimeout(timer);
    delete root.dataset.simTimer;
  };
};

/**
 * @param {HTMLElement} mount
 * @param {string} viewKey
 * @param {boolean} reducedMotion
 */
export function renderWorkflow(mount, viewKey, reducedMotion) {
  const view = ARCHITECTURE_WORKFLOWS[viewKey];
  if (!view) return () => {};

  mount.innerHTML = buildWorkflowMarkup(view, viewKey);
  const root = mount.querySelector(".arch-flow");
  if (!root) return () => {};

  let stopSim = () => {};
  let raf = 0;

  const relayout = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      drawEdges(/** @type {HTMLElement} */ (root), view, reducedMotion);
      mount.classList.add("is-visible");
    });
  };

  relayout();

  const ro = new ResizeObserver(relayout);
  ro.observe(mount);

  stopSim = startSimulation(/** @type {HTMLElement} */ (root), view, reducedMotion);

  root.classList.add("arch-flow--live");
  if (reducedMotion) root.classList.add("arch-flow--reduced");

  return () => {
    ro.disconnect();
    cancelAnimationFrame(raf);
    stopSim();
  };
}

/**
 * Redraw edges after the mount becomes visible (hidden tabs start at 0×0).
 * @param {HTMLElement} mount
 */
export function relayoutWorkflow(mount) {
  const root = mount.querySelector(".arch-flow");
  if (!root) return;
  const viewKey = root.dataset.flowView;
  if (!viewKey) return;
  const view = ARCHITECTURE_WORKFLOWS[viewKey];
  if (!view) return;
  const reduced = root.classList.contains("arch-flow--reduced");
  drawEdges(/** @type {HTMLElement} */ (root), view, reduced);
  mount.classList.add("is-visible");
}

/**
 * @param {HTMLElement} mount
 */
export function restartWorkflowSimulation(mount) {
  const root = mount.querySelector(".arch-flow");
  if (!root) return;
  const viewKey = root.dataset.flowView;
  if (!viewKey) return;
  const view = ARCHITECTURE_WORKFLOWS[viewKey];
  if (!view) return;

  const reduced = root.classList.contains("arch-flow--reduced");
  const timer = Number(root.dataset.simTimer ?? "0");
  if (timer) window.clearTimeout(timer);

  mount.querySelectorAll(".arch-flow-node").forEach((n) => {
    n.classList.remove("is-active", "is-visited");
  });
  mount.querySelector(".arch-flow-sidebar")?.classList.remove("is-active");

  startSimulation(/** @type {HTMLElement} */ (root), view, reduced);
}
