import { ARCHITECTURE_VIEWS, ARCHITECTURE_VIEW_KEYS } from "./shared/architecture-diagrams.mjs";

const MERMAID_CDN = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";

/**
 * @param {string} src
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(el);
  });
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
    });
    root.dispatchEvent(new CustomEvent("architecture-tab", { detail: { key } }));
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activate(tab.dataset.archTab ?? "dataFlow"));
  });

  activate(tabs.find((t) => t.classList.contains("active"))?.dataset.archTab ?? ARCHITECTURE_VIEW_KEYS[0]);
}

/**
 * @param {HTMLElement} mount
 * @param {string} diagram
 */
async function renderDiagram(mount, diagram) {
  // @ts-expect-error mermaid loaded from CDN
  const mermaid = window.mermaid;
  if (!mermaid?.render) throw new Error("Mermaid unavailable");

  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    securityLevel: "loose",
    flowchart: { curve: "basis", htmlLabels: true, padding: 14 },
    themeVariables: {
      primaryColor: "#111827",
      primaryTextColor: "#e8edf5",
      primaryBorderColor: "#4d9fff",
      lineColor: "#7c5cff",
      secondaryColor: "#0c1018",
      tertiaryColor: "#06080d",
      fontFamily: "DM Sans, system-ui, sans-serif",
    },
  });

  const id = `site-arch-${mount.dataset.archPanel ?? "diagram"}-${Date.now()}`;
  const { svg } = await mermaid.render(id, diagram);
  mount.innerHTML = svg;
  const svgEl = mount.querySelector("svg");
  if (svgEl) {
    svgEl.classList.add("architecture-mermaid-svg", "architecture-mermaid-animated");
    svgEl.setAttribute("role", "img");
  }
  requestAnimationFrame(() => mount.classList.add("is-visible"));
}

/**
 * @param {HTMLElement} section
 */
function bindDiagramRenders(section) {
  const mounts = [...section.querySelectorAll("[data-arch-diagram]")];
  const rendered = new Set();

  const renderMount = async (mount) => {
    const key = mount.dataset.archDiagram;
    if (!key || rendered.has(key)) return;
    const view = ARCHITECTURE_VIEWS[key];
    if (!view) return;
    rendered.add(key);
    try {
      await renderDiagram(mount, view.diagram);
    } catch (err) {
      mount.innerHTML = `<p class="architecture-error">${err instanceof Error ? err.message : "Diagram failed"}</p>`;
    }
  };

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) void renderMount(/** @type {HTMLElement} */ (entry.target));
      });
    },
    { rootMargin: "120px 0px", threshold: 0.12 }
  );

  mounts.forEach((mount) => io.observe(mount));

  section.addEventListener("architecture-tab", (event) => {
    const key = /** @type {CustomEvent<{ key: string }>} */ (event).detail?.key;
    const mount = mounts.find((m) => m.dataset.archDiagram === key);
    if (mount) void renderMount(mount);
  });
}

export async function initArchitectureSection() {
  const section = document.getElementById("architecture");
  if (!section) return;

  initArchitectureTabs(section);

  const prefersReduced =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) section.classList.add("architecture-reduced-motion");

  try {
    await loadScript(MERMAID_CDN);
    bindDiagramRenders(section);
  } catch {
    section.querySelectorAll("[data-arch-diagram]").forEach((mount) => {
      mount.innerHTML =
        '<p class="architecture-error">Architecture diagram could not load. See the <a href="https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok#architecture">README</a>.</p>';
    });
  }
}
