import { useState, useEffect } from "react";
import { AlertTriangle, Rocket, Undo2 } from "lucide-react";
import { fetchTags, triggerDeployment, triggerRollback } from "../../lib/api";
import { useSiteData } from "../../hooks/useSiteData";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import ErrorState from "../ui/ErrorState";

function fallbackTagsFromSite(siteData: ReturnType<typeof useSiteData>["data"]) {
  if (!siteData) return [];
  if (siteData.github.tags?.length) return siteData.github.tags;
  if (siteData.github.releaseTag) return [siteData.github.releaseTag];
  return [`v${siteData.packageVersion.replace(/^v/, "")}`];
}

type Mode = "deploy" | "rollback";

export default function Deployments() {
  const { data: siteData } = useSiteData();
  const [mode, setMode] = useState<Mode>("deploy");
  const [tags, setTags] = useState<string[]>([]);
  const [deploying, setDeploying] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [channel, setChannel] = useState<"beta" | "production">("beta");
  const [selectedTag, setSelectedTag] = useState("");
  const [customTag, setCustomTag] = useState("");
  const [market, setMarket] = useState<"Both" | "Open VSX" | "VS Code Marketplace">("Both");
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [tagsWarning, setTagsWarning] = useState<string | null>(null);

  useEffect(() => {
    fetchTags()
      .then((data) => {
        const tagNames = data.tags ?? [];
        setTags(tagNames);
        setTagsError(null);
        setTagsWarning(data.warning ?? (data.source === "cache" ? "Using cached tags from site-data.json" : null));
        if (tagNames.length > 0) setSelectedTag(tagNames[0]);
      })
      .catch((err: Error) => {
        const fallback = fallbackTagsFromSite(siteData);
        if (fallback.length > 0) {
          setTags(fallback);
          setTagsError(null);
          setTagsWarning(err.message || "Using fallback tags from site-data.json");
          setSelectedTag(fallback[0]);
        } else {
          setTags([]);
          setTagsError(err.message || "Failed to load tags from API");
        }
      });
  }, [siteData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetTag = customTag.trim() || selectedTag;
    if (!targetTag) return;
    setDeploying(true);
    setMessage(null);
    const payload = {
      target_tag: targetTag,
      publish_market: market,
      release_channel: channel === "production" ? "Production" as const : "Beta (Pre-release)" as const,
    };
    try {
      if (mode === "rollback") {
        await triggerRollback(payload);
        setMessage({ type: "success", text: `Rollback triggered for ${targetTag} (${market}).` });
      } else {
        await triggerDeployment(payload);
        setMessage({ type: "success", text: `Deployment triggered for ${targetTag} (${market}).` });
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : `${mode === "rollback" ? "Rollback" : "Deployment"} failed` });
    }
    setDeploying(false);
  };

  const filteredTags = tags.filter((t) => {
    if (channel === "production") return !/beta|alpha|rc/i.test(t);
    return /beta|alpha|rc/i.test(t) || t.startsWith("v0.");
  });

  const effectiveTag = customTag.trim() || selectedTag;
  const canSubmit = Boolean(effectiveTag) && !tagsError;

  const inputClass =
    "w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all text-[var(--color-text)]";

  return (
    <div className="space-y-8 animate-fade-slide-up">
      <PageHeader
        title="Deploy & Rollback"
        description="Trigger the GitHub Actions deployment workflow with the correct marketplace inputs."
      />

      <div className="flex gap-2 mb-6 p-1 rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border)]">
        {(["deploy", "rollback"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-semibold capitalize transition-all ${
              mode === value
                ? "bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-[var(--color-accent)] shadow-sm"
                : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {value === "deploy" ? <Rocket size={18} aria-hidden="true" /> : <Undo2 size={18} aria-hidden="true" />}
            {value === "deploy" ? "Deploy" : "Rollback"}
          </button>
        ))}
      </div>

      {mode === "rollback" && (
        <div className="glass-panel p-4 mb-4 border-[color-mix(in_srgb,var(--color-warn)_30%,transparent)] flex gap-3 text-sm text-[var(--color-warn)]">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            Rollback will restore the selected tag across the chosen marketplaces. Verify the tag is a known-good release
            before triggering — this re-publishes that version, not a git revert.
          </p>
        </div>
      )}

      {tagsError && <ErrorState title="Tags unavailable" message={tagsError} />}

      {tagsWarning && !tagsError && (
        <div className="glass-panel p-4 mb-4 border-[color-mix(in_srgb,var(--color-warn)_30%,transparent)] text-sm text-[var(--color-warn)]">
          {tagsWarning}
        </div>
      )}

      <Card className="mt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="target-tag" className="block text-sm font-medium mb-2 text-[var(--color-muted)]">
                {mode === "rollback" ? "Rollback to tag" : "Target Tag"}
              </label>
              <select id="target-tag" value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)} className={inputClass}>
                {filteredTags.length === 0 && <option value="">No tags in list</option>}
                {filteredTags.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="custom-tag" className="block text-sm font-medium mb-2 text-[var(--color-muted)]">Or type tag manually</label>
              <input
                id="custom-tag"
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                placeholder="e.g. v0.5.4"
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="target-market" className="block text-sm font-medium mb-2 text-[var(--color-muted)]">Publish Market</label>
              <select id="target-market" value={market} onChange={(e) => setMarket(e.target.value as typeof market)} className={inputClass}>
                <option value="Open VSX">Open VSX</option>
                <option value="VS Code Marketplace">VS Code Marketplace</option>
                <option value="Both">Both</option>
              </select>
            </div>
          </div>

          <fieldset>
            <legend className="block text-sm font-medium mb-3 text-[var(--color-muted)]">Release Channel</legend>
            <div className="flex flex-col sm:flex-row gap-4">
              {(["beta", "production"] as const).map((value) => (
                <label
                  key={value}
                  className={`flex-1 flex items-center justify-center p-4 rounded-xl cursor-pointer border transition-all ${
                    channel === value
                      ? "bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] border-[var(--color-accent)] text-[var(--color-accent)]"
                      : "bg-[var(--color-bg-base)] border-[var(--color-border)] hover:border-[var(--color-muted)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="channel"
                    value={value}
                    checked={channel === value}
                    onChange={() => setChannel(value)}
                    className="sr-only"
                  />
                  <span className="font-semibold capitalize">{value === "beta" ? "Beta (Pre-release)" : "Production"}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={deploying || !canSubmit}
            className={`w-full flex items-center justify-center gap-3 text-white py-4 rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-[0_8px_24px_rgba(124,92,255,0.25)] ${
              mode === "rollback" ? "bg-[var(--color-warn)]" : "bg-[var(--color-accent)]"
            }`}
          >
            {mode === "rollback" ? <Undo2 size={20} aria-hidden="true" /> : <Rocket size={20} aria-hidden="true" />}
            {deploying
              ? "Triggering…"
              : mode === "rollback"
                ? "Trigger Rollback"
                : "Trigger Deployment"}
          </button>
        </form>

        {message && (
          <div
            className={`mt-6 p-4 rounded-xl border ${
              message.type === "success"
                ? "bg-[color-mix(in_srgb,var(--color-ok)_10%,transparent)] border-[color-mix(in_srgb,var(--color-ok)_30%,transparent)] text-[var(--color-ok)]"
                : "bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)]"
            }`}
            role="status"
          >
            {message.text}
          </div>
        )}
      </Card>
    </div>
  );
}
