import DiscordDeploymentPreview from "./components/ui/DiscordDeploymentPreview";
import Card from "./components/ui/Card";
import { Bell } from "lucide-react";
import Badge from "./components/ui/Badge";
import "./index.css";

export default function PreviewPage() {
  return (
    <div className="min-h-screen mesh-bg p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-[var(--color-text)]">
          Discord Deployment Hook - Preview
        </h1>
        
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Bell size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
                Discord deployment hook
              </h3>
              <p className="text-sm text-[var(--color-muted)] mt-1">
                Channel webhook for deploy, rollback, and infra pipeline status. User feedback links use a separate hook in
                Settings. Posts ship as one compact status card with pipeline, marketplace sync, downloads, changelog, and links.
              </p>
            </div>
            <Badge variant="synced">
              Hook connected
            </Badge>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Webhook URL
              </label>
              <input
                type="password"
                disabled
                placeholder="Saved: https://discord.com/api/webhooks/…"
                className="w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 outline-none text-[var(--color-text)] font-[family-name:var(--font-mono)] text-sm opacity-50"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white font-medium opacity-50 cursor-not-allowed"
              >
                Save hook
              </button>
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] font-medium opacity-50 cursor-not-allowed"
              >
                Send test status
              </button>
            </div>

            <DiscordDeploymentPreview />
          </div>
        </Card>
      </div>
    </div>
  );
}
