export function normalizeSemver(version) {
  if (!version) return null;
  const core = String(version).trim().replace(/^v/i, "").split("-")[0];
  return /^\d+\.\d+\.\d+$/.test(core) ? core : null;
}

export function compareSemver(a, b) {
  const pa = (normalizeSemver(a) ?? "0.0.0").split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = (normalizeSemver(b) ?? "0.0.0").split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function bumpSemver(baseVersion, bumpType = "patch") {
  const core = normalizeSemver(baseVersion);
  if (!core) return null;
  const [major, minor, patch] = core.split(".").map((n) => Number.parseInt(n, 10) || 0);
  switch (bumpType) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

/**
 * @param {object} input
 * @param {string} input.packageVersion
 * @param {Array<{id:string,label:string,version:string|null,synced?:boolean,warn?:boolean}>} input.channels
 * @param {"patch"|"minor"|"major"} [input.bumpType]
 */
export function buildVersionPlan({ packageVersion, channels, bumpType = "patch" }) {
  const packageCore = normalizeSemver(packageVersion);
  const liveVersions = channels
    .filter((c) => !c.warn)
    .map((c) => normalizeSemver(c.version))
    .filter(Boolean);

  const maxLive = liveVersions.length
    ? liveVersions.sort(compareSemver).at(-1)
    : packageCore;

  const baseCore =
    maxLive && packageCore
      ? compareSemver(maxLive, packageCore) >= 0
        ? maxLive
        : packageCore
      : maxLive ?? packageCore;

  const recommendedVersion = baseCore ? bumpSemver(baseCore, bumpType) : null;
  const recommendedTag = recommendedVersion ? `v${recommendedVersion}` : null;

  const reasons = channels.map((channel) => {
    const live = normalizeSemver(channel.version);
    if (!live) {
      return {
        id: channel.id,
        label: channel.label,
        liveVersion: channel.version,
        status: "missing",
        reason: "No live version detected — first publish will create the listing.",
      };
    }
    if (!recommendedVersion) {
      return {
        id: channel.id,
        label: channel.label,
        liveVersion: live,
        status: "unknown",
        reason: "Could not compute a recommended version.",
      };
    }
    const cmp = compareSemver(live, recommendedVersion);
    if (cmp > 0) {
      return {
        id: channel.id,
        label: channel.label,
        liveVersion: live,
        status: "ahead",
        reason: `Live v${live} is ahead of recommended v${recommendedVersion} — bump package.json before publishing.`,
      };
    }
    if (cmp === 0) {
      return {
        id: channel.id,
        label: channel.label,
        liveVersion: live,
        status: "synced",
        reason: `Already on v${live}. Redeploy is idempotent (safe to republish).`,
      };
    }
    return {
      id: channel.id,
      label: channel.label,
      liveVersion: live,
      status: "behind",
      reason: `Live v${live} is behind recommended v${recommendedVersion} — publish required after release.`,
    };
  });

  const needsBump =
    Boolean(packageCore && maxLive && compareSemver(maxLive, packageCore) > 0) ||
    reasons.some((r) => r.status === "ahead");

  const needsPublish = reasons.some((r) => r.status === "behind" || r.status === "missing");

  return {
    packageVersion: packageCore,
    maxLiveVersion: maxLive,
    recommendedVersion,
    recommendedTag,
    bumpType,
    needsBump,
    needsPublish,
    allSynced: reasons.filter((r) => r.id !== "package").every((r) => r.status === "synced"),
    reasons,
    summary: needsBump
      ? `Bump required: live marketplaces are ahead of package.json (max live v${maxLive}).`
      : needsPublish
        ? `Publish required: recommended next release is v${recommendedVersion}.`
        : recommendedVersion
          ? `All channels aligned at or above v${recommendedVersion}; redeploy is safe.`
          : "Could not determine version plan.",
  };
}
