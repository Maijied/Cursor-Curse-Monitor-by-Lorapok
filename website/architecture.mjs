import { ARCHITECTURE_WORKFLOWS } from "./shared/architecture-workflows.mjs";
import { ARCHITECTURE_VIEW_KEYS } from "./shared/architecture-diagrams.mjs";
import { renderWorkflow, restartWorkflowSimulation } from "./architecture-workflow-renderer.mjs";

/**
 * @param {HTMLElement} mount
 */
function showDiagramSkeleton(mount) {
  mount.innerHTML = `
    <div class="architecture-diagram-skeleton" aria-live="polite">
      <div class="architecture-diagram-skeleton-grid" aria-hidden="true">
        <span class="architecture-diagram-skeleton-node"></span>
        <span class="architecture-diagram-skeleton-node"></span>
        <span class="architecture-diagram-skeleton-node architecture-diagram-skeleton-node--wide"></span>
        <span class="architecture-diagram-skeleton-node"></span>
      </div>
      <div class="architecture-diagram-skeleton-line"></div>
      <div class="architecture-diagram-skeleton-line architecture-diagram-skeleton-line--short"></div>
      <p class="architecture-diagram-skeleton-label">Building workflow simulation…</p>
    </div>`;
  mount.classList.remove("is-visible");
}

/**
 * @param {HTMLElement} root
 */
function initArchitectureTabs(root) {
  const tabs = [...root.querySelectorAll("[data-arch-tab]")];
  const panels = [...root.querySelectorAll("[data-arch-panel]")];
  if (!tabs.length || !panels.length) return;

  const activate = (key) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.archTab === key;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    panels.forEach((panel) => {
      const active = panel.dataset.archPanel === key;
      panel.hidden = !active;
      panel.classList.toggle("active", active);
      if (active) {
        panel.classList.remove("architecture-panel--enter");
        void panel.offsetWidth;
        panel.classList.add("architecture-panel--enter");
      }
    });
    root.dispatchEvent(new CustomEvent("architecture-tab", { detail: { key } }));
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activate(tab.dataset.archTab ?? "dataFlow"));
  });

  activate(tabs.find((t) => t.classList.contains("active"))?.dataset.archTab ?? ARCHITECTURE_VIEW_KEYS[0]);
}

/**
 * @param {HTMLElement} section
 * @param {boolean} reducedMotion
 */
function bindWorkflowRenders(section, reducedMotion) {
  const mounts = [...section.querySelectorAll("[data-arch-diagram]")];
  /** @type {Map<string, () => void>} */
  const cleanups = new Map();
  const rendered = new Set();

  const renderMount = (mount) => {
    const key = mount.dataset.archDiagram;
    if (!key) return;

    if (rendered.has(key) && mount.querySelector(".arch-flow")) {
      restartWorkflowSimulation(mount);
      requestAnimationFrame(() => mount.classList.add("is-visible"));
      return;
    }
    if (rendered.has(key)) return;

    const view = ARCHITECTURE_WORKFLOWS[key];
    if (!view) return;

    rendered.add(key);
    showDiagramSkeleton(mount);

    requestAnimationFrame(() => {
      cleanups.get(key)?.();
      const cleanup = renderWorkflow(mount, key, reducedMotion);
      cleanups.set(key, cleanup);
    });
  };

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) renderMount(/** @type {HTMLElement} */ (entry.target));
      });
    },
    { rootMargin: "120px 0px", threshold: 0.12 }
  );

  mounts.forEach((mount) => io.observe(mount));

  section.addEventListener("architecture-tab", (event) => {
    const key = /** @type {CustomEvent<{ key: string }>} */ (event).detail?.key;
    const mount = mounts.find((m) => m.dataset.archDiagram === key);
    if (mount) renderMount(mount);
  });
}

export function initArchitectureSection() {
  const section = document.getElementById("architecture");
  if (!section) return;

  initArchitectureTabs(section);

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) section.classList.add("architecture-reduced-motion");

  bindWorkflowRenders(section, prefersReduced);
}
