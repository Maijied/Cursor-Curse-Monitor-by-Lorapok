import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { AlertTriangle, ExternalLink, Lock, Rocket, Server, ShieldCheck, Undo2 } from "lucide-react";
import {
  fetchTags,
  fetchVersionPlan,
  triggerDeployment,
  triggerInfraDeploy,
  triggerRollback,
} from "../../lib/api";
import { useDeployRuntime } from "../../context/DeployRuntimeContext";
import { useSiteData } from "../../hooks/useSiteData";
import {
  defaultDeployTag,
  defaultRollbackSourceTag,
  defaultTagSelection,
  filterTagsForChannel,
  formatTagLabel,
} from "../../lib/release-version";
import { validateMarketplaceDeploy } from "../../lib/marketplace-deploy-policy";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import ErrorState from "../ui/ErrorState";
import Notification from "../ui/Notification";
import DeployRuntimeInlineSlot from "../ui/DeployRuntimeInlineSlot";
import DiscordIntegrationsCard from "../ui/DiscordIntegrationsCard";
import CollapsibleCard from "../ui/CollapsibleCard";
import LorapokLarvaeLoader from "../ui/LorapokLarvaeLoader";
import LoadableButton from "../ui/LoadableButton";
import { auth } from "../../lib/firebase";
import { isMasterAdmin } from "../../lib/admin-config";

function fallbackTagsFromSite(siteData: ReturnType<typeof useSiteData>["data"]) {
  if (!siteData) return { tags: [] as string[], liveTag: null as string | null };
  const liveTag = siteData.github.releaseTag ?? `v${siteData.packageVersion.replace(/^v/, "")}`;
  if (siteData.github.tags?.length) return { tags: siteData.github.tags, liveTag };
  return { tags: [liveTag], liveTag };
}

type Mode = "deploy" | "rollback" | "infra";

/**
 * Renders the interface for deploying releases, rolling back to known-good tags, or redeploying infrastructure.
 */
export default function Deployments() {
  const isMaster = isMasterAdmin(auth.currentUser?.email);
  const { inProgress, startSession, registerOnDeployComplete } = useDeployRuntime();
  const { data: siteData } = useSiteData();
  const [mode, setMode] = useState<Mode>("deploy");
  const [tags, setTags] = useState<string[]>([]);
  const [liveTag, setLiveTag] = useState<string | null>(null);
  const [latestTag, setLatestTag] = useState<string | null>(null);
  const [suggestedTag, setSuggestedTag] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [channel, setChannel] = useState<"beta" | "production">("production");
  const [selectedTag, setSelectedTag] = useState("");
  const [market, setMarket] = useState<
    "Both" | "Open VSX + Firefox AMO" | "Open VSX" | "VS Code Marketplace" | "Firefox AMO"
  >("Both");
  const [deployAdmin, setDeployAdmin] = useState(false);
  const [deployWebsite, setDeployWebsite] = useState(true);
  const [deployExtension, setDeployExtension] = useState(true);
  const tagTouchedRef = useRef(false);

  useEffect(() => {
    if (mode === "deploy") {
      setDeployAdmin(false);
      setDeployWebsite(true);
      setDeployExtension(true);
    } else if (mode === "rollback") {
      setDeployExtension(true);
    } else if (mode === "infra") {
      setDeployExtension(false);
    }
    tagTouchedRef.current = false;
  }, [mode]);

  useEffect(() => {
    tagTouchedRef.current = false;
  }, [channel]);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [tagsWarning, setTagsWarning] = useState<string | null>(null);
  const [displayLiveTag, setDisplayLiveTag] = useState<string | null>(null);
  const [displayPkgVersion, setDisplayPkgVersion] = useState<string | null>(null);
  const [versionPlan, setVersionPlan] = useState<Awaited<ReturnType<typeof fetchVersionPlan>> | null>(null);
  const [versionPlanLoading, setVersionPlanLoading] = useState(false);
  const [versionPlanError, setVersionPlanError] = useState<string | null>(null);
  const siteDataRef = useRef(siteData);
  siteDataRef.current = siteData;

  const applyTagSelection = useCallback(
    (tagNames: string[], nextLiveTag: string | null, nextSuggestedTag: string | null) => {
      setSelectedTag((prev) => {
        if (tagTouchedRef.current && prev && tagNames.includes(prev)) return prev;
        if (mode === "rollback") {
          return defaultRollbackSourceTag(tagNames, nextLiveTag);
        }
        return defaultDeployTag(tagNames, nextLiveTag, nextSuggestedTag);
      });
    },
    [mode]
  );

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
        applyTagSelection(tagNames, data.liveTag ?? null, data.suggestedTag ?? null);
      })
      .catch((err: Error) => {
        const fallback = fallbackTagsFromSite(siteDataRef.current);
        if (fallback.tags.length > 0) {
          setTags(fallback.tags);
          setLiveTag(fallback.liveTag);
          setLatestTag(fallback.tags[0] ?? null);
          setSuggestedTag(null);
          setTagsError(null);
          setTagsWarning(err.message || "Using fallback tags from site-data.json");
          applyTagSelection(fallback.tags, fallback.liveTag, null);
        } else {
          setTags([]);
          setTagsError(err.message || "Failed to load tags from API");
        }
      });
  }, [applyTagSelection]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  useEffect(() => {
    if (!inProgress && liveTag) {
      setDisplayLiveTag(liveTag);
      setDisplayPkgVersion(siteData?.packageVersion ?? null);
    }
  }, [liveTag, inProgress, siteData?.packageVersion]);

  useEffect(() => {
    registerOnDeployComplete(() => loadTags());
    return () => registerOnDeployComplete(null);
  }, [loadTags, registerOnDeployComplete]);

  const filteredTags = useMemo(
    () => filterTagsForChannel(tags, channel, mode),
    [tags, channel, mode]
  );

  const preparedTag = versionPlan?.recommendedTag ?? suggestedTag ?? latestTag;

  useEffect(() => {
    if (filteredTags.length === 0) {
      if (selectedTag) setSelectedTag("");
      return;
    }
    if (selectedTag && !filteredTags.includes(selectedTag)) {
      tagTouchedRef.current = false;
      setSelectedTag(
        mode === "rollback"
          ? defaultRollbackSourceTag(filteredTags, liveTag)
          : defaultDeployTag(filteredTags, liveTag, preparedTag ?? suggestedTag)
      );
    }
  }, [channel, filteredTags, liveTag, suggestedTag, selectedTag, mode, preparedTag]);

  useEffect(() => {
    if (mode === "infra" || tagTouchedRef.current) return;
    if (filteredTags.length === 0) return;

    if (mode === "rollback") {
      const next = defaultRollbackSourceTag(filteredTags, liveTag);
      if (next && next !== selectedTag) setSelectedTag(next);
      return;
    }

    const nextPrepared = preparedTag ?? suggestedTag;
    if (!nextPrepared || !filteredTags.includes(nextPrepared)) return;
    if (!selectedTag || selectedTag === liveTag) {
      setSelectedTag(nextPrepared);
    }
  }, [mode, channel, preparedTag, suggestedTag, filteredTags, liveTag, selectedTag]);

  const runVersionCheck = useCallback(async () => {
    setVersionPlanLoading(true);
    setVersionPlanError(null);
    try {
      const planMode = mode === "rollback" ? "rollback" : "release";
      const targetForPlan = mode === "rollback" && selectedTag ? selectedTag : undefined;
      const plan = await fetchVersionPlan("patch", planMode, targetForPlan);
      setVersionPlan(plan);
    } catch (err: unknown) {
      setVersionPlan(null);
      setVersionPlanError(err instanceof Error ? err.message : "Version check failed");
    } finally {
      setVersionPlanLoading(false);
    }
  }, [mode, selectedTag]);

  useEffect(() => {
    if (isMaster) void runVersionCheck();
  }, [isMaster, runVersionCheck]);

  const releaseChannel = channel === "production" ? "Production" as const : "Beta (Pre-release)" as const;
  const isLiveSelected = Boolean(liveTag && selectedTag === liveTag);
  const deployBlocked = mode === "deploy" && isLiveSelected;
  const deployPolicy =
    mode !== "infra" && selectedTag
      ? validateMarketplaceDeploy({
          targetTag: selectedTag,
          releaseChannel,
          publishMarket: market,
        })
      : { ok: true as const };
  const deployPolicyError = deployPolicy.ok ? null : deployPolicy.error;

  const workflowName = "ci-cd.yml";
  const formLocked = deploying || inProgress;

  const beginRuntimeSession = useCallback(
    (targetTag: string, modeLabel: string, dispatchedAfter: number) => {
      startSession({
        workflowName,
        targetTag,
        dispatchedAfter,
        channel: releaseChannel,
        market: mode === "infra" ? "Infra only" : market,
        modeLabel,
      });
    },
    [startSession, releaseChannel, market, mode]
  );

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
      const dispatchedAfter = Date.now();
      try {
        await triggerInfraDeploy({ deploy_admin: deployAdmin, deploy_website: deployWebsite });
        setMessage({
          type: "success",
          text: `Infra deploy triggered — admin: ${deployAdmin ? "yes" : "no"}, website: ${deployWebsite ? "yes" : "no"}.`,
        });
        beginRuntimeSession("infra", "Infra deploy", dispatchedAfter);
      } catch (err: unknown) {
        setMessage({ type: "error", text: err instanceof Error ? err.message : "Infra deploy failed" });
      }
      setDeploying(false);
      return;
    }

    if (!selectedTag || !filteredTags.includes(selectedTag)) {
      setMessage({ type: "error", text: "Choose a valid tag from the list." });
      return;
    }
    if (deployBlocked) {
      setMessage({
        type: "error",
        text: `${selectedTag} is already live. Pick the prepared tag ${preparedTag ?? "(see version check above)"} or another unpublished tag.`,
      });
      return;
    }
    if (deployPolicyError) {
      setMessage({ type: "error", text: deployPolicyError });
      return;
    }

    setDeploying(true);
    const dispatchedAfter = Date.now();
    const payload = {
      target_tag: selectedTag,
      publish_market: market,
      release_channel: releaseChannel,
      deploy_admin: deployAdmin,
      deploy_website: deployWebsite,
      deploy_extension: deployExtension,
    };
    try {
      if (mode === "rollback") {
        await triggerRollback(payload);
        setMessage({ type: "success", text: `Rollback triggered for ${selectedTag} (${market}).` });
        beginRuntimeSession(selectedTag, "Rollback", dispatchedAfter);
      } else {
        await triggerDeployment(payload);
        setMessage({ type: "success", text: `Deployment triggered for ${selectedTag} (${market}).` });
        beginRuntimeSession(selectedTag, "Deploy", dispatchedAfter);
      }
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : `${mode === "rollback" ? "Rollback" : "Deployment"} failed`,
      });
    }
    setDeploying(false);
  };

  const canSubmit =
    isMaster &&
    !tagsError &&
    !formLocked &&
    !deployPolicyError &&
    (mode === "infra"
      ? deployAdmin || deployWebsite
      : Boolean(selectedTag) && filteredTags.includes(selectedTag) && !deployBlocked && (deployExtension || deployWebsite));

  const inputClass =
    "w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all text-[var(--color-text)]";

  const pkgVersion = displayPkgVersion ?? siteData?.packageVersion ?? "—";
  const shownLiveTag = displayLiveTag ?? liveTag;

  return (
    <div className="space-y-8 animate-fade-slide-up">
      <PageHeader
        title="Deploy & Release"
        description="Push to main prepares the next git tag automatically. Pick a tag here to publish to marketplaces. Discord gets started and completed status when the hook is set."
      />

      <DiscordIntegrationsCard />

      <CollapsibleCard
        title="How it works"
        defaultOpen={false}
        className="border-[color-mix(in_srgb,var(--color-accent)_20%,transparent)]"
        subtitle="Push to main prepares tags; Deploy publishes marketplaces; Rollback restores older tags."
      >
        <ul className="text-sm text-[var(--color-muted)] space-y-2 list-disc pl-5">
          <li>
            <strong className="text-[var(--color-text)]">Push to main</strong> — CI checks every platform version, bumps{" "}
            <code className="font-mono text-xs">package.json</code>, creates the next git tag (max live + 1 patch), and
            refreshes Mission Control.
          </li>
          <li>
            <strong className="text-[var(--color-text)]">Deploy</strong> — choose a prepared tag and publish to VS Code,
            Open VSX, Firefox AMO, and the marketing site.
          </li>
          <li>
            <strong className="text-[var(--color-text)]">Rollback</strong> — restore an older tag as{" "}
            <code className="font-mono text-xs">v{"{major}.{minor}.Rn"}</code>, then publish.
          </li>
          <li>
            <strong className="text-[var(--color-text)]">Discord hook</strong> — paste a channel webhook at the top of
            this page to receive started and completed deploy status in Discord.
          </li>
        </ul>
        <p className="text-xs text-[var(--color-warn)] mt-3">
          Golden rule: if a marketplace publish fails, use <strong>Rollback</strong> or <strong>Deploy</strong> with a known-good tag — never leave main in a broken state.
        </p>
      </CollapsibleCard>

      {!isMaster ? (
        <div className="glass-panel px-4 py-3 text-sm border border-[color-mix(in_srgb,var(--color-warn)_35%,transparent)] text-[var(--color-warn)] flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0" />
          Release, deploy, and rollback are restricted to the master admin account.
        </div>
      ) : null}

      <div className="glass-panel px-4 py-3 text-sm text-[var(--color-muted)] flex flex-wrap gap-x-4 gap-y-1">
        <span>
          Live: <strong className="text-[var(--color-text)]">{shownLiveTag ?? "unknown"}</strong>
        </span>
        <span>
          Prepared tag:{" "}
          <strong className="text-[var(--color-text)] font-[family-name:var(--font-mono)]">
            {preparedTag ?? "—"}
          </strong>
        </span>
        <span>
          package.json: <strong className="text-[var(--color-text)] font-[family-name:var(--font-mono)]">v{pkgVersion}</strong>
        </span>
      </div>

      <CollapsibleCard
        title="Deployment validation"
        defaultOpen={false}
        className="border-[color-mix(in_srgb,var(--color-accent)_25%,transparent)]"
        subtitle="Validates live versions across GitHub, Open VSX, VS Code Marketplace, and Firefox AMO before you publish."
        actions={
          <LoadableButton
            type="button"
            onClick={() => void runVersionCheck()}
            disabled={versionPlanLoading || !isMaster}
            loading={versionPlanLoading}
            loadingLabel="Validating…"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50"
            aria-label="Validate marketplace platforms before deployment"
          >
            <ShieldCheck size={16} aria-hidden="true" />
            Validate platforms
          </LoadableButton>
        }
      >
        {versionPlanError ? (
          <p className="text-sm text-[var(--color-danger)]">{versionPlanError}</p>
        ) : null}
        {versionPlan ? (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text)]">
              <strong>{versionPlan.summary}</strong>
              {versionPlan.recommendedTag ? (
                <>
                  {" "}
                  Recommended:{" "}
                  <span className="font-[family-name:var(--font-mono)] text-[var(--color-accent-2)]">
                    {versionPlan.recommendedTag}
                  </span>
                </>
              ) : null}
            </p>
            <ul className="space-y-2">
              {versionPlan.reasons.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <span className="font-medium text-[var(--color-text)]">{item.label}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        item.status === "synced"
                          ? "bg-[color-mix(in_srgb,var(--color-neon)_15%,transparent)] text-[var(--color-neon)]"
                          : item.status === "behind" || item.status === "missing"
                            ? "bg-[color-mix(in_srgb,var(--color-warn)_15%,transparent)] text-[var(--color-warn)]"
                            : "bg-[color-mix(in_srgb,var(--color-muted)_15%,transparent)] text-[var(--color-muted)]"
                      }`}
                    >
                      {item.liveVersion ? `v${item.liveVersion}` : "—"} · {item.status}
                    </span>
                  </div>
                  <p className="text-[var(--color-muted)]">{item.reason}</p>
                </li>
              ))}
            </ul>
            {versionPlan.checkedAt ? (
              <p className="text-xs text-[var(--color-muted)]">
                Checked {new Date(versionPlan.checkedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">
            Live versions load automatically when you open this page. Push to <code className="font-mono text-xs">main</code>{" "}
            to prepare the next git tag.
          </p>
        )}
      </CollapsibleCard>

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

      <div className={`flex gap-2 p-1 rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border)] ${formLocked ? "opacity-60 pointer-events-none" : ""}`}>
        {(
          [
            { value: "deploy" as const, label: "Deploy", icon: Rocket },
            { value: "rollback" as const, label: "Rollback", icon: Undo2 },
            { value: "infra" as const, label: "Infra", icon: Server },
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

      {mode === "deploy" && (
        <div className="glass-panel p-4 text-sm text-[var(--color-muted)] border-[color-mix(in_srgb,var(--color-accent)_20%,transparent)]">
          Tags are prepared automatically when code is pushed to <strong className="text-[var(--color-text)]">main</strong>.
          {preparedTag ? (
            <>
              {" "}
              Suggested deploy:{" "}
              <strong className="font-[family-name:var(--font-mono)] text-[var(--color-accent-2)]">{preparedTag}</strong>
            </>
          ) : null}
          {channel === "beta" ? (
            <p className="mt-2 text-[var(--color-text)]">
              <strong>Beta channel</strong> sets VS Code / Open VSX <em>pre-release</em> flags at publish time.
              Tags stay <code className="font-mono text-xs">vMAJOR.MINOR.PATCH</code> (no{" "}
              <code className="font-mono text-xs">-beta</code> suffix). Any market can be selected; CI may skip Firefox
              AMO for pre-releases.
            </p>
          ) : null}
        </div>
      )}

      {mode === "rollback" && (
        <div className="glass-panel p-4 border-[color-mix(in_srgb,var(--color-warn)_30%,transparent)] flex gap-3 text-sm text-[var(--color-warn)]">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p>
              Rollback restores the selected tag on main and publishes a new rollback release. Verify the tag is
              known-good before triggering.
            </p>
            {versionPlan?.recommendedTag ? (
              <p className="mt-2 text-[var(--color-text)]">
                Next rollback tag:{" "}
                <strong className="font-[family-name:var(--font-mono)] text-[var(--color-accent-2)]">
                  {versionPlan.recommendedTag}
                </strong>
                {versionPlan.maxAllVersion ? (
                  <span className="text-[var(--color-muted)]">
                    {" "}
                    (highest live v{versionPlan.maxAllVersion} → next v
                    {versionPlan.maxAllVersion.split(".").slice(0, 2).join(".")}.R#)
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {mode === "deploy" && isLiveSelected && (
        <div className="glass-panel p-4 border-[color-mix(in_srgb,var(--color-warn)_30%,transparent)] text-sm text-[var(--color-warn)]">
          {liveTag} is already live on marketplaces. Pick the prepared tag{" "}
          <strong className="text-[var(--color-text)]">{preparedTag ?? "above"}</strong> or another unpublished tag.
        </div>
      )}

      {tagsError && <ErrorState title="Tags unavailable" message={tagsError} />}

      {tagsWarning && !tagsError && (
        <div className="glass-panel p-4 border-[color-mix(in_srgb,var(--color-warn)_30%,transparent)] text-sm text-[var(--color-warn)]">
          {tagsWarning}
        </div>
      )}

      <Card className="mt-6">
        <form onSubmit={handleSubmit} className={`space-y-6 ${formLocked ? "opacity-70" : ""}`}>
          {mode !== "infra" ? (
            <div>
              <label htmlFor="target-tag" className="block text-sm font-medium mb-2 text-[var(--color-muted)]">
                {mode === "rollback" ? "Rollback to tag (source)" : "Deploy tag"}
              </label>
              <select
                id="target-tag"
                value={selectedTag}
                onChange={(e) => {
                  tagTouchedRef.current = true;
                  setSelectedTag(e.target.value);
                }}
                className={inputClass}
                disabled={formLocked}
              >
                {filteredTags.length === 0 && <option value="">No tags in list</option>}
                {filteredTags.map((t) => (
                  <option key={t} value={t}>
                    {formatTagLabel(t, liveTag)}
                    {t === preparedTag ? " (prepared)" : ""}
                  </option>
                ))}
              </select>
              {(mode === "deploy" || channel === "beta") && preparedTag ? (
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  Next tag (+1 patch):{" "}
                  <span className="font-[family-name:var(--font-mono)] text-[var(--color-accent-2)]">{preparedTag}</span>
                </p>
              ) : null}
              {mode === "rollback" && versionPlan?.recommendedTag ? (
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  New rollback release:{" "}
                  <span className="font-[family-name:var(--font-mono)] text-[var(--color-accent-2)]">
                    {versionPlan.recommendedTag}
                  </span>
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">
              Redeploy Mission Control admin panel (Cloudflare) and/or marketing site — no marketplace publish.
            </p>
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
              disabled={formLocked}
              className={inputClass}
            >
              <option value="Both">All Marketplaces (VS Code + Open VSX + Firefox AMO)</option>
              <option value="Open VSX + Firefox AMO">Open VSX + Firefox AMO (no VS Code)</option>
              <option value="VS Code Marketplace">VS Code Marketplace only</option>
              <option value="Open VSX">Open VSX only (canonical lorapok-labs)</option>
              <option value="Firefox AMO">Firefox Add-ons (AMO) only</option>
            </select>
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              Pick one marketplace for a single-target publish, or All Marketplaces for the full release.
            </p>
          </div>
          ) : null}

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
                    disabled={formLocked}
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
              {mode === "infra" ? (
                <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                  <input
                    type="checkbox"
                    checked={deployAdmin}
                    onChange={(e) => setDeployAdmin(e.target.checked)}
                    disabled={formLocked}
                  />
                  Mission Control admin (cursor-dev.lorapok.tech)
                </label>
              ) : null}
              <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                <input
                  type="checkbox"
                  checked={deployWebsite}
                  onChange={(e) => setDeployWebsite(e.target.checked)}
                  disabled={formLocked}
                />
                Marketing site (cursor.lorapok.tech)
              </label>
              {mode !== "infra" ? (
                <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                  <input
                    type="checkbox"
                    checked={deployExtension}
                    onChange={(e) => setDeployExtension(e.target.checked)}
                    disabled={formLocked}
                  />
                  IDE extension (marketplaces)
                </label>
              ) : null}
            </div>
            {mode === "deploy" ? (
              <p className="text-xs text-[var(--color-muted)] mt-2">
                Mission Control refreshes automatically on every push to main.
              </p>
            ) : null}
          </fieldset>

          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full flex items-center justify-center gap-3 text-white py-4 rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-[0_8px_24px_rgba(124,92,255,0.25)] ${
              mode === "rollback" ? "bg-[var(--color-warn)]" : "bg-[var(--color-accent)]"
            }`}
          >
            {deploying || inProgress ? (
              <LorapokLarvaeLoader size="sm" ariaLabel="Deployment in progress" className="!gap-0" />
            ) : mode === "rollback" ? (
              <Undo2 size={20} aria-hidden="true" />
            ) : mode === "infra" ? (
              <Server size={20} aria-hidden="true" />
            ) : (
              <Rocket size={20} aria-hidden="true" />
            )}
            {deploying || inProgress
              ? "Deployment running…"
              : mode === "rollback"
                ? "Trigger Rollback"
                : mode === "infra"
                  ? "Deploy Infra"
                  : "Publish to Marketplaces"}
          </button>
        </form>

        {deploying && !inProgress ? (
          <div
            className="mt-6 flex items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--color-accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] p-4"
            aria-live="polite"
          >
            <LorapokLarvaeLoader size="sm" ariaLabel="Dispatching workflow" />
            <p className="text-sm text-[var(--color-muted)]">
              Dispatching {workflowName} on GitHub… Larvae will crawl the pipeline once the run starts.
            </p>
          </div>
        ) : null}

        {message && (
          <Notification
            tone={message.type === "success" ? "success" : "error"}
            title={message.type === "success" ? "Workflow dispatched" : "Dispatch failed"}
            message={message.text}
            onDismiss={() => setMessage(null)}
            className="mt-6"
          />
        )}

        {inProgress && (
          <p className="mt-4 text-sm text-[var(--color-muted)]">
            Deployment in progress — form locked until CI finishes. The animated larvae button stays pinned in the
            bottom-right corner; tap it to reopen the pipeline modal from anywhere.
          </p>
        )}

        <DeployRuntimeInlineSlot />
      </Card>
    </div>
  );
}
