import { useMemo } from "react";
import { buildDeploymentEmbed } from "../../../functions/api/_shared/discord-notify.js";

const SAMPLE_ENRICHMENT = {
  brand: {
    icon: "https://cursor.lorapok.tech/assets/logo.png",
    banner: "https://cursor.lorapok.tech/assets/marketing/og-social-card.png",
  },
  marketplaceFields: [
    { name: "Package", value: "`1.0.31` ✅", inline: true },
    { name: "GitHub release", value: "`v1.0.31` ✅", inline: true },
    { name: "Sync status", value: "synced", inline: true },
    { name: "Open VSX", value: "`1.0.31` ✅", inline: true },
    { name: "Open VSX duplicate", value: "`1.0.31` ✅", inline: true },
    { name: "VS Code Marketplace", value: "`1.0.31` ✅", inline: true },
    { name: "Firefox AMO", value: "`1.0.31`", inline: true },
    { name: "Release status", value: "live", inline: true },
    { name: "Published version", value: "`1.0.31`", inline: true },
  ],
  downloadBreakdown: "```\nTotal ········· 12,450\nOpen VSX ········ 11,200\nVS Code ········· 890\n```",
  engagement: "```\nVisits ······· 2,140\nEngagement ··· 418\n```",
  changelog: "### Added\n- Single compact Discord status card\n- Pipeline larvae tracking fix",
  quickLinks:
    "[Product site](https://cursor.lorapok.tech) · [Mission Control](https://cursor-dev.lorapok.tech) · [GitHub release](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases)",
};

type EmbedField = { name: string; value: string; inline?: boolean };

function stripMarkdown(value: string): string {
  return value
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

function FieldBlock({ field }: { field: EmbedField }) {
  const isCode = field.value.includes("```");
  const text = isCode ? field.value.replace(/^```\n?|\n?```$/g, "") : stripMarkdown(field.value);

  return (
    <div className="rounded-xl border border-[color-mix(in_srgb,var(--color-border)_80%,transparent)] bg-[color-mix(in_srgb,var(--color-bg-base)_70%,transparent)] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent-2)] mb-1.5">
        {field.name}
      </p>
      {isCode ? (
        <pre className="overflow-x-auto whitespace-pre-wrap font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-[var(--color-muted)]">
          {text}
        </pre>
      ) : field.name === "Pipeline" ? (
        <ul className="space-y-1 text-xs text-[var(--color-text)]">
          {text.split("\n").map((line) => (
            <li key={line} className="font-[family-name:var(--font-mono)]">
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs leading-relaxed text-[var(--color-text)] whitespace-pre-wrap">{text}</p>
      )}
    </div>
  );
}

/**
 * Mission Control preview of the consolidated Discord deployment card.
 */
export default function DiscordDeploymentPreview() {
  const embed = useMemo(
    () =>
      buildDeploymentEmbed(
        {
          phase: "completed",
          conclusion: "success",
          actionType: "deployment-status-test",
          tag: "v1.0.31",
          channel: "Production",
          market: "Open VSX · VS Code · GitHub",
          duration: "4m 12s",
          triggeredBy: "Mission Control",
          jobs: [
            { name: "Build & Validate", conclusion: "success" },
            { name: "Deploy to Marketplaces", conclusion: "success" },
            { name: "Deploy Admin Panel", conclusion: "success" },
          ],
          summary: "Sample rich deployment card — all sections in one Discord embed.",
        },
        SAMPLE_ENRICHMENT,
      ),
    [],
  );

  const metaFields = (embed.fields as EmbedField[]).filter((field) =>
    ["Action", "Version", "Channel", "Marketplaces", "Triggered by", "Duration"].includes(field.name),
  );
  const detailFields = (embed.fields as EmbedField[]).filter(
    (field) => !metaFields.includes(field),
  );

  return (
    <div className="rounded-2xl border border-[color-mix(in_srgb,var(--color-accent)_24%,transparent)] bg-[linear-gradient(165deg,color-mix(in_srgb,var(--color-bg-elevated)_94%,transparent),color-mix(in_srgb,var(--color-bg-base)_98%,transparent))] p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
            Discord preview
          </p>
          <h4 className="mt-1 text-base font-semibold text-[var(--color-text)]">{String(embed.title)}</h4>
        </div>
        <span className="rounded-full border border-[color-mix(in_srgb,var(--color-neon)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-neon)_8%,transparent)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--color-neon)]">
          Single card
        </span>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-[var(--color-muted)]">
        {stripMarkdown(String(embed.description ?? ""))}
      </p>

      <dl className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {metaFields.map((field) => (
          <div
            key={field.name}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2"
          >
            <dt className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{field.name}</dt>
            <dd className="mt-0.5 text-xs font-medium text-[var(--color-text)]">{stripMarkdown(field.value)}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-2">
        {detailFields.map((field) => (
          <FieldBlock key={field.name} field={field} />
        ))}
      </div>
    </div>
  );
}
