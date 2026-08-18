import type { SiteData } from "../../lib/site-data";

type Node = { id: string; label: string; version: string | null; synced: boolean; warn?: boolean };

function nodeStatus(node: Node): "ok" | "warn" | "danger" {
  if (node.warn) return "warn";
  if (node.synced) return "ok";
  return "danger";
}

export default function SyncRadar({ data }: { data: SiteData }) {
  const nodes: Node[] = [
    { id: "github", label: "GitHub", version: data.github.releaseTag.replace(/^v/, ""), synced: data.github.releaseTag.replace(/^v/, "") === data.packageVersion },
    { id: "ovsx", label: "Open VSX", version: data.ovsx.version, synced: data.ovsx.version === data.packageVersion },
    { id: "vscode", label: "VS Code", version: data.vscode.version, synced: data.vscode.version === data.packageVersion },
  ];
  const drift = data.syncStatus !== "synced";

  return (
    <div className="glass-panel p-6 flex flex-col items-center">
      <h3 className="text-sm font-medium text-[var(--color-muted)] mb-4 self-start">Marketplace Sync Radar</h3>
      <svg viewBox="0 0 220 220" className="w-48 h-48" aria-label="Marketplace sync radar">
        <circle cx="110" cy="110" r="90" fill="none" stroke="var(--color-border)" strokeWidth="1" strokeDasharray={drift ? "6 4" : "none"} />
        <circle cx="110" cy="110" r="6" fill={drift ? "var(--color-warn)" : "var(--color-neon)"} className={drift ? "" : "animate-pulse-neon"} />
        {nodes.map((node, i) => {
          const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
          const x = 110 + Math.cos(angle) * 72;
          const y = 110 + Math.sin(angle) * 72;
          const status = nodeStatus(node);
          const color = status === "ok" ? "var(--color-neon)" : status === "warn" ? "var(--color-warn)" : "var(--color-danger)";
          return (
            <g key={node.id}>
              <line x1="110" y1="110" x2={x} y2={y} stroke={color} strokeWidth="1.5" opacity="0.6" />
              <circle cx={x} cy={y} r="14" fill="var(--color-bg-surface)" stroke={color} strokeWidth="2" />
              <text x={x} y={y - 22} textAnchor="middle" fill="var(--color-muted)" fontSize="9">{node.label}</text>
              <text x={x} y={y + 4} textAnchor="middle" fill="var(--color-text)" fontSize="10" fontFamily="monospace">{node.version ?? "—"}</text>
            </g>
          );
        })}
      </svg>
      <p className="text-xs text-[var(--color-muted)] mt-2 text-center">
        {drift ? "Channels diverged — check drift alert above." : "All primary channels aligned."}
      </p>
    </div>
  );
}
