import { useCallback, useState, useEffect } from "react";
import { AlertTriangle, ExternalLink, Lock, Package, Rocket, Server, Undo2 } from "lucide-react";
import {
  fetchTags,
  triggerDeployment,
  triggerInfraDeploy,
  triggerRelease,
  triggerRollback,
  type ReleaseRequest,
} from "../../lib/api";
import { useSiteData } from "../../hooks/useSiteData";
import {
  bumpVersion,
  defaultTagSelection,
  effectiveVersionBase,
  formatTagLabel,
  normalizeTag,
  type ReleaseBumpType,
} from "../../lib/release-version";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import ErrorState from "../ui/ErrorState";
import Notification from "../ui/Notification";
import DeployRuntimePanel from "../ui/DeployRuntimePanel";
import { auth } from "../../lib/firebase";
import { isMasterAdmin } from "../../lib/admin-config";

function fallbackTagsFromSite(siteData: ReturnType<typeof useSiteData>["data"]) {
  if (!siteData) return { tags: [] as string[], liveTag: null as string | null };
  const liveTag = siteData.github.releaseTag ?? `v${siteData.packageVersion.replace(/^v/, "")}`;
  if (siteData.github.tags?.length) return { tags: siteData.github.tags, liveTag };
  return { tags: [liveTag], liveTag };
}

type Mode = "release" | "deploy" | "rollback" | "infra";

const BUMP_OPTIONS: { value: ReleaseBumpType; label: string }[] = [
  { value: "patch", label: "Patch — bug fix or small update" },
  { value: "minor", label: "Minor — new feature" },
  { value: "major", label: "Major — breaking change" },
  { value: "custom", label: "Custom version" },
];

export default function Deployments() {
  const isMaster = isMasterAdmin(auth.currentUser?.email);
  const { data: siteData } = useSiteData();
  const [mode, setMode] = useState<Mode>("release");
  const [tags, setTags] = useState<string[]>([]);
  const [liveTag, setLiveTag] = useState<string | null>(null);
  const [latestTag, setLatestTag] = useState<string | null>(null);
  const [suggestedTag, setSuggestedTag] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [runtimeActive, setRuntimeActive] = useState(false);
  const [lastTargetTag, setLastTargetTag] = useState("");
  const [channel, setChannel] = useState<"beta" | "production">("production");
  const [selectedTag, setSelectedTag] = useState("");
  const [bumpType, setBumpType] = useState<ReleaseBumpType>("patch");
  const [customVersion, setCustomVersion] = useState("");
  const [market, setMarket] = useState<"Both" | "Open VSX" | "VS Code Marketplace" | "Firefox AMO">("Both");
  const [deployAdmin, setDeployAdmin] = useState(true);
  const [deployWebsite, setDeployWebsite] = useState(true);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [tagsWarning, setTagsWarning] = useState<string | null>(null);
  const [dispatchedAfter, setDispatchedAfter] = useState(0);
  const [displayLiveTag, setDisplayLiveTag] = useState<string | null>(null);
  const [displayPkgVersion, setDisplayPkgVersion] = useState<string | null>(null);

  const loadTags = useCallback(() => {
    fetchTags()
      .then((data) => {
        const tagNames = data.tags ?? [];
        setTags(tagNames);
        setLiveTag(data.liveTag ?? null);
        setLatestTag(data.latestTag ?? null);
        setSuggestedTag(data.suggestedTag ?? null);
        setTagsError(null);
        setTagsWarning(data.warning ?? (data.source === "cache" ? "Using cached tags from site-data.json" : null));
        setSelectedTag(defaultTagSelection(tagNames, data.liveTag ?? null, data.suggestedTag ?? null));
      })
      .catch((err: Error) => {
        const fallback = fallbackTagsFromSite(siteData);
        if (fallback.tags.length > 0) {
          setTags(fallback.tags);
          setLiveTag(fallback.liveTag);
          setLatestTag(fallback.tags[0] ?? null);
          setSuggestedTag(null);
          setTagsError(null);
          setTagsWarning(err.message || "Using fallback tags from site-data.json");
          setSelectedTag(defaultTagSelection(fallback.tags, fallback.liveTag, null));
        } else {
          setTags([]);
          setTagsError(err.message || "Failed to load tags from API");
        }
      });
  }, [siteData]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  useEffect(() => {
    if (!runtimeActive && liveTag) {
      setDisplayLiveTag(liveTag);
      setDisplayPkgVersion(siteData?.packageVersion ?? null);
    }
  }, [liveTag, runtimeActive, siteData?.packageVersion]);

  const filteredTags = tags.filter((t) => {
    if (channel === "production") return !/beta|alpha|rc/i.test(t);
    return /beta|alpha|rc/i.test(t) || t.startsWith("v0.");
  });

  useEffect(() => {
    if (filteredTags.length > 0 && !filteredTags.includes(selectedTag)) {
      setSelectedTag(defaultTagSelection(filteredTags, liveTag, suggestedTag));
    }
  }, [channel, filteredTags, liveTag, selectedTag, suggestedTag]);

  const releaseChannel = channel === "production" ? "Production" as const : "Beta (Pre-release)" as const;
  const versionBase = effectiveVersionBase(liveTag, siteData?.packageVersion ?? null);
  const previewTag = bumpVersion(versionBase, bumpType, customVersion);
  const isLiveSelected = Boolean(liveTag && selectedTag === liveTag);
  const deployBlocked = mode === "deploy" && isLiveSelected;
  const customMissing = mode === "release" && bumpType === "custom" && !customVersion.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!isMaster) {
      setMessage({
        type: "error",
        text: "Only the master admin can trigger releases. Sign in as mdshuvo40@gmail.com or contact the project owner.",
      });
      return;
    }

    if (tagsError && mode !== "infra") {
      setMessage({
        type: "error",
        text: `Cannot dispatch: ${tagsError}. Refresh tags or check /api/tags and GITHUB_TOKEN on the server.`,
      });
      return;
    }

    if (mode === "infra") {
      setDeploying(true);
      try {
        await triggerInfraDeploy({ deploy_admin: deployAdmin, deploy_website: deployWebsite });
        setMessage({
          type: "success",
          text: `Infra deploy triggered — admin: ${deployAdmin ? "yes" : "no"}, website: ${deployWebsite ? "yes" : "no"}.`,
        });
        setRuntimeActive(true);
        setDispatchedAfter(Date.now());
      } catch (err: unknown) {
        setMessage({ type: "error", text: err instanceof Error ? err.message : "Infra deploy failed" });
      }
      setDeploying(false);
      return;
    }

    if (mode === "release") {
      if (customMissing) {
        setMessage({ type: "error", text: "Enter a custom version (e.g. 1.0.4-beta.1)." });
        return;
      }
      if (!previewTag) {
        setMessage({
          type: "error",
          text: "Could not compute the next version. Ensure package.json and live tags are loaded.",
        });
        return;
      }
      if (channel === "beta" && bumpType === "major") {
        setMessage({
          type: "error",
          text: "Major releases should use the Production channel. Use Beta for pre-release patch/minor builds only.",
        });
        return;
      }
      setDeploying(true);
      const payload: ReleaseRequest = {
        version_type: bumpType,
        custom_version: bumpType === "custom" ? customVersion.trim() : undefined,
        publish_market: market,
        release_channel: releaseChannel,
        deploy_admin: deployAdmin,
        deploy_website: deployWebsite,
      };
      try {
        await triggerRelease(payload);
        const label = previewTag ?? "next version";
        setMessage({ type: "success", text: `Release triggered — will create ${label} (${market}).` });
        setDispatchedAfter(Date.now());
        setRuntimeActive(true);
        setLastTargetTag(label);
      } catch (err: unknown) {
        const text = err instanceof Error ? err.message : "Release failed";
        setMessage({
          type: "error",
          text: text.includes("GITHUB_TOKEN")
            ? text
            : `${text} — If this persists, verify GITHUB_TOKEN on Cloudflare Pages and that workflow ci-cd.yml exists on main.`,
        });
      }
      setDeploying(false);
      return;
    }

    if (!selectedTag || !tags.includes(selectedTag)) {
      setMessage({ type: "error", text: "Choose a valid tag from the list." });
      return;
    }
    if (deployBlocked) {
      setMessage({
        type: "error",
        text: `${selectedTag} is already live. Use New Release for the next version, or pick another tag.`,
      });
      return;
    }

    setDeploying(true);
    const payload = {
      target_tag: selectedTag,
      publish_market: market,
      release_channel: releaseChannel,
      deploy_admin: deployAdmin,
      deploy_website: deployWebsite,
    };
    try {
      if (mode === "rollback") {
        await triggerRollback(payload);
        setMessage({ type: "success", text: `Rollback triggered for ${selectedTag} (${market}).` });
      } else {
        await triggerDeployment(payload);
        setMessage({ type: "success", text: `Deployment triggered for ${selectedTag} (${market}).` });
      }
      setRuntimeActive(true);
      setLastTargetTag(selectedTag);
      setDispatchedAfter(Date.now());
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : `${mode === "rollback" ? "Rollback" : "Deployment"} failed`,
      });
    }
    setDeploying(false);
  };

  const workflowName = "ci-cd.yml";

  const canSubmit =
    isMaster &&
    !tagsError &&
    !deploying &&
    (mode === "infra"
      ? deployAdmin || deployWebsite
      : mode === "release"
        ? !customMissing
        : Boolean(selectedTag) && !deployBlocked);

  const inputClass =
    "w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all text-[var(--color-text)]";

  const pkgVersion = displayPkgVersion ?? siteData?.packageVersion ?? "—";
  const shownLiveTag = displayLiveTag ?? liveTag;

  const handleRuntimeComplete = useCallback(
    ({ success }: { success: boolean }) => {
      setRuntimeActive(false);
      if (success) loadTags();
    },
    [loadTags]
  );

  return (
    <div className="space-y-8 animate-fade-slide-up">
      <PageHeader
        title="Deploy & Release"
        description="All production deploys run through Mission Control — marketplaces, admin panel, and website."
      />

      <Card className="border-[color-mix(in_srgb,var(--color-accent)_20%,transparent)]">
        <h3 className="text-base font-semibold text-[var(--color-text)] mb-3">How to use this page</h3>
        <ul className="text-sm text-[var(--color-muted)] space-y-2 list-disc pl-5">
          <li>
            <strong className="text-[var(--color-text)]">New Release</strong> — bump version on <code className="font-mono text-xs">main</code>, create a git tag, publish to selected marketplaces, and optionally deploy admin + website.
          </li>
          <li>
            <strong className="text-[var(--color-text)]">Deploy</strong> — re-publish an <em>existing</em> git tag (pick a tag other than the live one). Use after a failed marketplace publish.
          </li>
          <li>
            <strong className="text-[var(--color-text)]">Rollback</strong> — restore an older tag to <code className="font-mono text-xs">main</code> with an automatic patch bump, then publish. Use when a release fails in production.
          </li>
          <li>
            <strong className="text-[var(--color-text)]">Infra</strong> — deploy Mission Control admin and/or marketing site only (no VSIX/AMO publish).
          </li>
        </ul>
        <p className="text-xs text-[var(--color-warn)] mt-3">
          Golden rule: if a marketplace publish fails, use <strong>Rollback</strong> or <strong>Deploy</strong> with a known-good tag — never leave main in a broken state.
        </p>
      </Card>

      {!isMaster ? (
        <div className="glass-panel px-4 py-3 text-sm border border-[color-mix(in_srgb,var(--color-warn)_35%,transparent)] text-[var(--color-warn)] flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0" />
          Release, deploy, and rollback are restricted to the master admin account.
        </div>
      ) : null}

      <div className="glass-panel px-4 py-3 text-sm text-[var(--color-muted)] flex flex-wrap gap-x-4 gap-y-1">
        <span>
          Live: <strong className="text-[var(--color-text)]">{shownLiveTag ?? "unknown"}</strong>
          {runtimeActive && previewTag && mode === "release" ? (
            <span className="text-[var(--color-warn)]"> (pending {previewTag})</span>
          ) : null}
        </span>
        <span>
          Latest tag: <strong className="text-[var(--color-text)]">{latestTag ?? "—"}</strong>
        </span>
        <span>
          package.json: <strong className="text-[var(--color-text)] font-[family-name:var(--font-mono)]">v{pkgVersion}</strong>
        </span>
      </div>

      {siteData?.browserExtension && (
        <Card>
          <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">Browser extensions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-bg-base)]">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h4 className="font-medium text-[var(--color-text)]">Firefox (AMO)</h4>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    siteData.browserExtension.firefox?.published
                      ? "bg-[color-mix(in_srgb,var(--color-neon)_15%,transparent)] text-[var(--color-neon)]"
                      : siteData.browserExtension.firefox?.reviewStatus === "awaiting-review"
                        ? "bg-[color-mix(in_srgb,var(--color-warn)_15%,transparent)] text-[var(--color-warn)]"
                        : "bg-[color-mix(in_srgb,var(--color-muted)_15%,transparent)] text-[var(--color-muted)]"
                  }`}
                >
                  {siteData.browserExtension.firefox?.published
                    ? "Live on AMO"
                    : siteData.browserExtension.firefox?.reviewStatus === "awaiting-review"
                      ? "Awaiting review"
                      : siteData.browserExtension.firefox?.reviewStatus ?? "Not listed"}
                </span>
              </div>
              <p className="text-sm text-[var(--color-muted)] mb-3">
                Version{" "}
                <span className="font-[family-name:var(--font-mono)]">
                  {siteData.browserExtension.firefox?.version ?? siteData.browserExtension.version ?? "—"}
                </span>
                {" · "}auto-signed on release via CI
              </p>
              <a
                href={siteData.browserExtension.firefox?.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-[var(--color-accent-2)] hover:underline"
              >
                View on AMO <ExternalLink size={14} />
              </a>
            </div>
            <div className="rounded-xl border border-[color-mix(in_srgb,var(--color-warn)_30%,transparent)] p-4 bg-[var(--color-bg-base)] opacity-90">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h4 className="font-medium text-[var(--color-text)]">Chrome</h4>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--color-warn)_15%,transparent)] text-[var(--color-warn)]">
                  Zip only
                </span>
              </div>
              <p className="text-sm text-[var(--color-muted)] mb-3">
                Web Store publish disabled. Chrome zip is attached to GitHub Releases after deploy.
              </p>
              <a
                href={siteData.browserExtension.chrome?.zipUrl ?? siteData.github.chromeZipUrl ?? siteData.github.releaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-[var(--color-accent-2)] hover:underline"
              >
                Download latest zip <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </Card>
      )}

      <div className="flex gap-2 p-1 rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border)]">
        {(
          [
            { value: "infra" as const, label: "Infra", icon: Server },
            { value: "release" as const, label: "New Release", icon: Package },
            { value: "deploy" as const, label: "Deploy", icon: Rocket },
            { value: "rollback" as const, label: "Rollback", icon: Undo2 },
          ] as const
        ).map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all text-sm sm:text-base ${
              mode === value
                ? "bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-[var(--color-accent)] shadow-sm"
                : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {mode === "rollback" && (
        <div className="glass-panel p-4 border-[color-mix(in_srgb,var(--color-warn)_30%,transparent)] flex gap-3 text-sm text-[var(--color-warn)]">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            Rollback restores the selected tag on main and publishes a new patch version. Verify the tag is known-good
            before triggering.
          </p>
        </div>
      )}

      {mode === "deploy" && isLiveSelected && (
        <div className="glass-panel p-4 border-[color-mix(in_srgb,var(--color-warn)_30%,transparent)] text-sm text-[var(--color-warn)]">
          {liveTag} is already live on marketplaces. Use <strong>New Release</strong> for the next version, or pick an
          older tag to re-publish.
        </div>
      )}

      {mode === "release" && !suggestedTag && liveTag && (
        <div className="glass-panel p-4 text-sm text-[var(--color-muted)]">
          No newer git tag exists yet — a new release will bump from live <strong className="text-[var(--color-text)]">{liveTag}</strong>.
        </div>
      )}

      {tagsError && <ErrorState title="Tags unavailable" message={tagsError} />}

      {tagsWarning && !tagsError && (
        <div className="glass-panel p-4 border-[color-mix(in_srgb,var(--color-warn)_30%,transparent)] text-sm text-[var(--color-warn)]">
          {tagsWarning}
        </div>
      )}

      <Card className="mt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {mode === "release" ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="bump-type" className="block text-sm font-medium mb-2 text-[var(--color-muted)]">
                  Release type
                </label>
                <select
                  id="bump-type"
                  value={bumpType}
                  onChange={(e) => setBumpType(e.target.value as ReleaseBumpType)}
                  className={inputClass}
                >
                  {BUMP_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {bumpType === "custom" && (
                <div>
                  <label htmlFor="custom-version" className="block text-sm font-medium mb-2 text-[var(--color-muted)]">
                    Custom version
                  </label>
                  <input
                    id="custom-version"
                    type="text"
                    value={customVersion}
                    onChange={(e) => setCustomVersion(e.target.value)}
                    placeholder="e.g. 0.6.0-beta.1"
                    className={inputClass}
                  />
                </div>
              )}
              {previewTag && (
                <p className="text-sm text-[var(--color-muted)]">
                  Will create{" "}
                  <strong className="text-[var(--color-accent-2)] font-[family-name:var(--font-mono)]">{previewTag}</strong>
                  {versionBase ? (
                    <>
                      {" "}
                      from base <span className="font-[family-name:var(--font-mono)]">{versionBase}</span>
                      {liveTag && versionBase !== normalizeTag(liveTag) ? (
                        <span className="text-[var(--color-warn)]"> (package.json ahead of live tag {liveTag})</span>
                      ) : null}
                    </>
                  ) : null}
                </p>
              )}
            </div>
          ) : (
            <div>
              <label htmlFor="target-tag" className="block text-sm font-medium mb-2 text-[var(--color-muted)]">
                {mode === "rollback" ? "Rollback to tag" : "Target tag (must exist on GitHub)"}
              </label>
              <select id="target-tag" value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)} className={inputClass}>
                {filteredTags.length === 0 && <option value="">No tags in list</option>}
                {filteredTags.map((t) => (
                  <option key={t} value={t}>
                    {formatTagLabel(t, liveTag)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode !== "infra" ? (
          <div>
            <label htmlFor="target-market" className="block text-sm font-medium mb-2 text-[var(--color-muted)]">
              Publish Market
            </label>
            <select
              id="target-market"
              value={market}
              onChange={(e) => setMarket(e.target.value as typeof market)}
              className={inputClass}
            >
              <option value="Both">All Marketplaces (VS Code + Open VSX + Firefox AMO)</option>
              <option value="VS Code Marketplace">VS Code Marketplace</option>
              <option value="Open VSX">Open VSX (canonical lorapok-labs)</option>
              <option value="Firefox AMO">Firefox Add-ons (AMO)</option>
            </select>
          </div>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">
              Deploy Mission Control admin panel (Cloudflare) and/or marketing site — no marketplace publish.
            </p>
          )}

          {mode !== "infra" ? (
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
          ) : null}

          <fieldset>
            <legend className="block text-sm font-medium mb-3 text-[var(--color-muted)]">Deploy targets</legend>
            <div className="flex flex-col sm:flex-row gap-4">
              <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                <input
                  type="checkbox"
                  checked={deployAdmin}
                  onChange={(e) => setDeployAdmin(e.target.checked)}
                />
                Mission Control admin (cursor-dev.lorapok.tech)
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                <input
                  type="checkbox"
                  checked={deployWebsite}
                  onChange={(e) => setDeployWebsite(e.target.checked)}
                />
                Marketing site (cursor.lorapok.tech)
              </label>
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full flex items-center justify-center gap-3 text-white py-4 rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-[0_8px_24px_rgba(124,92,255,0.25)] ${
              mode === "rollback" ? "bg-[var(--color-warn)]" : "bg-[var(--color-accent)]"
            }`}
          >
            {mode === "rollback" ? (
              <Undo2 size={20} aria-hidden="true" />
            ) : mode === "release" ? (
              <Package size={20} aria-hidden="true" />
            ) : mode === "infra" ? (
              <Server size={20} aria-hidden="true" />
            ) : (
              <Rocket size={20} aria-hidden="true" />
            )}
            {deploying
              ? "Triggering…"
              : mode === "rollback"
                ? "Trigger Rollback"
                : mode === "release"
                  ? "Trigger New Release"
                  : mode === "infra"
                    ? "Deploy Infra"
                    : "Trigger Deployment"}
          </button>
        </form>

        {message && (
          <Notification
            tone={message.type === "success" ? "success" : "error"}
            title={message.type === "success" ? "Workflow dispatched" : "Dispatch failed"}
            message={message.text}
            onDismiss={() => setMessage(null)}
            className="mt-6"
          />
        )}

        <DeployRuntimePanel
          active={runtimeActive}
          workflowName={workflowName}
          targetTag={lastTargetTag}
          dispatchedAfter={dispatchedAfter}
          onComplete={handleRuntimeComplete}
        />
      </Card>
    </div>
  );
}
