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

/** Highest semver across every channel (including duplicate listings and git tags). */
export function maxVersionFromChannels(channels) {
  const versions = channels.map((c) => normalizeSemver(c.version)).filter(Boolean);
  return versions.length ? versions.sort(compareSemver).at(-1) : null;
}

/** Parse rollback versions like 1.0.R1 or v1.0.R2 */
export function parseRollbackVersion(version) {
  const m = String(version ?? "")
    .trim()
    .replace(/^v/i, "")
    .match(/^(\d+)\.(\d+)\.R(\d+)$/i);
  if (!m) return null;
  return {
    major: Number.parseInt(m[1], 10) || 0,
    minor: Number.parseInt(m[2], 10) || 0,
    rollback: Number.parseInt(m[3], 10) || 0,
    version: `${m[1]}.${m[2]}.R${m[3]}`,
    tag: `v${m[1]}.${m[2]}.R${m[3]}`,
  };
}

/**
 * Next rollback tag from highest live semver: v{major}.{minor}.R{n}
 * @param {string} maxVersion
 * @param {string[]} existingTags
 */
export function nextRollbackVersion(maxVersion, existingTags = []) {
  const core = normalizeSemver(maxVersion);
  if (!core) return null;
  const [major, minor] = core.split(".").map((n) => Number.parseInt(n, 10) || 0);
  let maxR = 0;
  for (const tag of existingTags) {
    const parsed = parseRollbackVersion(tag);
    if (parsed && parsed.major === major && parsed.minor === minor) {
      maxR = Math.max(maxR, parsed.rollback);
    }
  }
  const version = `${major}.${minor}.R${maxR + 1}`;
  return { recommendedVersion: version, recommendedTag: `v${version}` };
}

/**
 * @param {object} input
 * @param {string} input.packageVersion
 * @param {Array<{id:string,label:string,version:string|null,warn?:boolean}>} input.channels
 * @param {string[]} [input.existingTags]
 */
export function buildRollbackPlan({ packageVersion, channels, existingTags = [] }) {
  const packageCore = normalizeSemver(packageVersion);
  const maxAll = maxVersionFromChannels(channels) ?? packageCore;
  const rollback = maxAll ? nextRollbackVersion(maxAll, existingTags) : null;
  const recommendedVersion = rollback?.recommendedVersion ?? null;
  const recommendedTag = rollback?.recommendedTag ?? null;

  const reasons = channels.map((channel) => {
    const live = channel.version;
    const liveCore = normalizeSemver(live) ?? parseRollbackVersion(live)?.version ?? null;
    if (!liveCore && !live) {
      return {
        id: channel.id,
        label: channel.label,
        liveVersion: channel.version,
        status: "missing",
        reason: "No live version detected.",
      };
    }
    return {
      id: channel.id,
      label: channel.label,
      liveVersion: liveCore ?? live,
      status: "info",
      reason: recommendedTag
        ? `Rollback will restore an older build and publish as ${recommendedTag}.`
        : "Rollback target could not be computed.",
    };
  });

  const tagAlreadyExists = Boolean(
    recommendedTag && existingTags.some((t) => t.replace(/^v/i, "").toLowerCase() === recommendedVersion?.toLowerCase()),
  );

  return {
    packageVersion: packageCore,
    maxLiveVersion: maxAll,
    maxAllVersion: maxAll,
    recommendedVersion,
    recommendedTag,
    bumpType: "rollback",
    planMode: "rollback",
    needsBump: Boolean(packageCore && recommendedVersion && packageCore !== recommendedVersion),
    needsPublish: true,
    shouldCreateTag: Boolean(recommendedTag && !tagAlreadyExists),
    shouldBumpPackage: Boolean(recommendedVersion && packageCore !== recommendedVersion),
    tagAlreadyExists,
    allSynced: false,
    reasons,
    summary: recommendedTag
      ? `Rollback tag ${recommendedTag} (highest live v${maxAll} → v${maxAll?.split(".").slice(0, 2).join(".")}.R{n}).`
      : "Could not determine rollback version.",
  };
}

/**
 * @param {object} input
 * @param {string} input.packageVersion
 * @param {Array<{id:string,label:string,version:string|null,warn?:boolean}>} input.channels
 * @param {"patch"|"minor"|"major"} [input.bumpType]
 * @param {string|null} [input.latestGitTag]
 */
export function buildVersionPlan({ packageVersion, channels, bumpType = "patch", latestGitTag = null }) {
  const packageCore = normalizeSemver(packageVersion);
  const maxAll = maxVersionFromChannels(channels) ?? packageCore;
  const recommendedVersion = maxAll ? bumpSemver(maxAll, bumpType) : null;
  const recommendedTag = recommendedVersion ? `v${recommendedVersion}` : null;
  const gitTagCore = normalizeSemver(latestGitTag);

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
        reason: `Live v${live} is ahead of deploy target v${recommendedVersion}.`,
      };
    }
    if (cmp === 0) {
      return {
        id: channel.id,
        label: channel.label,
        liveVersion: live,
        status: "synced",
        reason: `Already at deploy target v${live}. Redeploy is idempotent.`,
      };
    }
    return {
      id: channel.id,
      label: channel.label,
      liveVersion: live,
      status: "behind",
      reason: `Live v${live} — publish v${recommendedVersion} after release.`,
    };
  });

  const needsBump = Boolean(packageCore && recommendedVersion && compareSemver(packageCore, recommendedVersion) < 0);
  const needsPublish = reasons.some((r) => r.status === "behind" || r.status === "missing");
  const tagAlreadyExists = Boolean(gitTagCore && recommendedVersion && compareSemver(gitTagCore, recommendedVersion) >= 0);
  const shouldCreateTag = Boolean(recommendedVersion && !tagAlreadyExists);
  const shouldBumpPackage = needsBump;

  return {
    packageVersion: packageCore,
    maxLiveVersion: maxAll,
    maxAllVersion: maxAll,
    recommendedVersion,
    recommendedTag,
    bumpType,
    planMode: "release",
    needsBump,
    needsPublish,
    shouldCreateTag,
    shouldBumpPackage,
    tagAlreadyExists,
    allSynced: reasons.filter((r) => r.id !== "package").every((r) => r.status === "synced"),
    reasons,
    summary: recommendedVersion
      ? `Deploy target v${recommendedVersion} = highest live v${maxAll} + 1 ${bumpType}.`
      : "Could not determine version plan.",
  };
}
