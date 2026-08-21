import type { SiteData } from "../../lib/site-data";

type Node = { id: string; label: string; version: string | null; synced: boolean; warn?: boolean };

function nodeStatus(node: Node): "ok" | "warn" | "danger" {
  if (node.warn) return "warn";
  if (node.synced) return "ok";
  return "danger";
}

export default function SyncRadar({ data }: { data: SiteData }) {
  const extVersion = data.browserExtension?.version ?? null;
  const nodes: Node[] = [
    {
      id: "github",
      label: "GitHub",
      version: data.github.releaseTag.replace(/^v/, ""),
      synced: data.github.releaseTag.replace(/^v/, "") === data.packageVersion,
    },
    {
      id: "ovsx",
      label: "Open VSX",
      version: data.ovsx.version,
      synced: data.ovsx.version === data.packageVersion,
    },
    {
      id: "vscode",
      label: "VS Code",
      version: data.vscode.version,
      synced: data.vscode.version === data.packageVersion,
    },
    {
      id: "firefox",
      label: "Firefox",
      version: extVersion,
      synced: Boolean(extVersion && extVersion === data.packageVersion),
      warn: !data.browserExtension?.firefox?.published,
    },
  ];
  const drift = data.syncStatus !== "synced";
  const cx = 110;
  const cy = 110;
  const radius = 72;

  return (
    <div className="glass-panel p-6 flex flex-col items-center">
      <h3 className="text-sm font-medium text-[var(--color-muted)] mb-4 self-start">Marketplace Sync Radar</h3>
      <svg viewBox="0 0 220 220" className="w-52 h-52" aria-label="Marketplace sync radar">
        <circle
          cx={cx}
          cy={cy}
          r="90"
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="1"
          strokeDasharray={drift ? "6 4" : "none"}
        />
        <g style={{ transformOrigin: `${cx}px ${cy}px`, animationDuration: "8s" }} className="animate-spin">
          <path
            d={`M ${cx} ${cy} L ${cx} ${cy - 90} A 90 90 0 0 1 ${cx + 63} ${cy - 63} Z`}
            fill="url(#radarSweep)"
            opacity="0.35"
          />
        </g>
        <defs>
          <radialGradient id="radarSweep" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--color-neon)" stopOpacity="0.9" />
          </radialGradient>
        </defs>
        <circle
          cx={cx}
          cy={cy}
          r="6"
          fill={drift ? "var(--color-warn)" : "var(--color-neon)"}
          className={drift ? "" : "animate-ping"}
          style={{ transformOrigin: `${cx}px ${cy}px`, animationDuration: "2.5s" }}
        />
        <circle
          cx={cx}
          cy={cy}
          r="6"
          fill={drift ? "var(--color-warn)" : "var(--color-neon)"}
        />
        {nodes.map((node, i) => {
          const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          const status = nodeStatus(node);
          const color =
            status === "ok" ? "var(--color-neon)" : status === "warn" ? "var(--color-warn)" : "var(--color-danger)";
          return (
            <g key={node.id}>
              <line
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke={color}
                strokeWidth="1.5"
                strokeOpacity="0.75"
              />
              <circle
                cx={x}
                cy={y}
                r="14"
                fill="var(--color-bg-surface)"
                stroke={color}
                strokeWidth="2"
              />
              <text x={x} y={y - 22} textAnchor="middle" fill="var(--color-muted)" fontSize="9">
                {node.label}
              </text>
              <text x={x} y={y + 4} textAnchor="middle" fill="var(--color-text)" fontSize="10" fontFamily="monospace">
                {node.version ?? "—"}
              </text>
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
