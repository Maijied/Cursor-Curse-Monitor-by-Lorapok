import { ExternalLink, Cloud } from "lucide-react";
import { CLOUD_DEV_ENVIRONMENTS, type CloudProvider } from "@lorapok/cursor-monitor-shared";
import Card from "./Card";
import Badge from "./Badge";
import FieldHelp from "./FieldHelp";

function providerBadge(provider: CloudProvider) {
  if (provider === "google") {
    return (
      <Badge variant="synced" className="!text-[10px]">
        Google Cloud
      </Badge>
    );
  }
  if (provider === "microsoft") {
    return (
      <Badge variant="warn" className="!text-[10px]">
        Microsoft Azure
      </Badge>
    );
  }
  return (
    <Badge variant="muted" className="!text-[10px]">
      Other
    </Badge>
  );
}

export default function CloudEnvironmentsCard() {
  return (
    <Card>
      <div className="flex items-start gap-3 mb-6">
        <Cloud size={20} className="text-[var(--color-accent)] shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <h3 className="font-semibold text-[var(--color-text)]">Cloud dev environments</h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Install and sign-in guidance for Google Cloud Workstations, Azure Dev Box, and browser-based VS Code hosts.
          </p>
        </div>
      </div>

      <ul className="space-y-6">
        {CLOUD_DEV_ENVIRONMENTS.map((env) => (
          <li
            key={env.id}
            className="rounded-xl border border-[var(--color-border)] p-4 bg-white/[0.02]"
          >
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h4 className="font-medium text-[var(--color-text)]">{env.name}</h4>
              {providerBadge(env.provider)}
            </div>
            <p className="text-sm text-[var(--color-muted)] mb-3">{env.tagline}</p>

            <div className="flex flex-wrap gap-3 text-xs mb-3">
              <a
                href={env.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline"
              >
                Documentation <ExternalLink size={12} aria-hidden="true" />
              </a>
              {env.consoleUrl && (
                <a
                  href={env.consoleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline"
                >
                  Console <ExternalLink size={12} aria-hidden="true" />
                </a>
              )}
              {env.installUrl && (
                <a
                  href={env.installUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline"
                >
                  Install extension <ExternalLink size={12} aria-hidden="true" />
                </a>
              )}
            </div>

            <FieldHelp label="Setup notes">
              <ul className="list-disc pl-4 space-y-1">
                {env.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </FieldHelp>
          </li>
        ))}
      </ul>
    </Card>
  );
}
