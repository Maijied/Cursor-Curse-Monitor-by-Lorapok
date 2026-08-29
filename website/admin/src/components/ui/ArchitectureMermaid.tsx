import { useEffect, useId, useRef, useState } from "react";
import mermaid from "mermaid";

let mermaidReady = false;

function ensureMermaid() {
  if (mermaidReady) return;
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
  mermaidReady = true;
}

type ArchitectureMermaidProps = {
  diagram: string;
  className?: string;
  animate?: boolean;
};

export default function ArchitectureMermaid({
  diagram,
  className = "",
  animate = true,
}: ArchitectureMermaidProps) {
  const renderId = useId().replace(/:/g, "");
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host || !diagram.trim()) return;

    ensureMermaid();
    setStatus("loading");
    setError(null);

    (async () => {
      try {
        const { svg } = await mermaid.render(`arch-${renderId}-${Date.now()}`, diagram);
        if (cancelled) return;
        host.innerHTML = svg;
        const svgEl = host.querySelector("svg");
        if (svgEl) {
          svgEl.setAttribute("role", "img");
          svgEl.classList.add("architecture-mermaid-svg");
          if (animate) svgEl.classList.add("architecture-mermaid-animated");
        }
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Diagram render failed");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [diagram, renderId, animate]);

  return (
    <div
      className={`architecture-mermaid-host rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-3 overflow-x-auto ${className}`}
    >
      {status === "loading" ? (
        <p className="text-sm text-[var(--color-muted)] px-2 py-6 text-center" aria-live="polite">
          Rendering architecture diagram…
        </p>
      ) : null}
      {status === "error" ? (
        <p className="text-sm text-[var(--color-danger)] px-2 py-4">{error}</p>
      ) : null}
      <div ref={hostRef} className={status === "ready" ? "architecture-mermaid-inner" : "sr-only"} />
    </div>
  );
}
