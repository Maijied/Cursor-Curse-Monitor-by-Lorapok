import { useState, useEffect } from "react";
import { Rocket } from "lucide-react";
import { fetchTags, triggerDeployment } from "../../lib/api";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import ErrorState from "../ui/ErrorState";

export default function Deployments() {
  const [tags, setTags] = useState<string[]>([]);
  const [deploying, setDeploying] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [channel, setChannel] = useState<"beta" | "production">("beta");
  const [selectedTag, setSelectedTag] = useState("");
  const [market, setMarket] = useState<"Both" | "Open VSX" | "VS Code Marketplace">("Both");
  const [tagsError, setTagsError] = useState<string | null>(null);

  useEffect(() => {
    fetchTags()
      .then((data) => {
        const tagNames = data.tags ?? [];
        setTags(tagNames);
        setTagsError(null);
        if (tagNames.length > 0) setSelectedTag(tagNames[0]);
      })
      .catch((err: Error) => {
        setTags([]);
        setTagsError(err.message || "Failed to load tags from API");
      });
  }, []);

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeploying(true);
    setMessage(null);
    try {
      await triggerDeployment({
        target_tag: selectedTag,
        publish_market: market,
        release_channel: channel === "production" ? "Production" : "Beta (Pre-release)",
      });
      setMessage({ type: "success", text: `Deployment triggered for ${selectedTag} (${market}).` });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Deployment failed" });
    }
    setDeploying(false);
  };

  const filteredTags = tags.filter((t) => {
    if (channel === "production") return !/beta|alpha|rc/i.test(t);
    return /beta|alpha|rc/i.test(t) || t.startsWith("v0.");
  });

  const inputClass =
    "w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all text-[var(--color-text)]";

  return (
    <div className="max-w-3xl animate-fade-slide-up">
      <PageHeader
        title="Deploy Release"
        description="Trigger the GitHub Actions deployment workflow with the correct marketplace inputs."
      />

      {tagsError && <ErrorState title="Tags unavailable" message={tagsError} />}

      <Card className="mt-6">
        <form onSubmit={handleDeploy} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="target-tag" className="block text-sm font-medium mb-2 text-[var(--color-muted)]">Target Tag</label>
              <select id="target-tag" value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)} className={inputClass}>
                {filteredTags.length === 0 && <option value="">No tags available</option>}
                {filteredTags.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
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
            disabled={deploying || filteredTags.length === 0 || !!tagsError}
            className="w-full flex items-center justify-center gap-3 bg-[var(--color-accent)] text-white py-4 rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-[0_8px_24px_rgba(124,92,255,0.25)]"
          >
            <Rocket size={20} aria-hidden="true" />
            {deploying ? "Triggering…" : "Trigger Deployment"}
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
