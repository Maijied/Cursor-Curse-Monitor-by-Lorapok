export type PublishMarket =
  | "Both"
  | "Open VSX + Firefox AMO"
  | "Open VSX"
  | "VS Code Marketplace"
  | "Firefox AMO";

export type ReleaseChannel = "Production" | "Beta (Pre-release)";

export function isRollbackTag(tag: string): boolean {
  return /^v?\d+\.\d+\.R\d+$/i.test(String(tag));
}

export function isMarketplaceSemverTag(tag: string): boolean {
  return /^v?\d+\.\d+\.\d+$/i.test(String(tag));
}

export function hasCiOnlySuffix(tag: string): boolean {
  if (isRollbackTag(tag)) return false;
  return /-(dev|pr|beta|alpha|rc)/i.test(String(tag).replace(/^v/i, ""));
}

const MIN_PUBLISH_TAG = [0, 5, 5] as const;

function tagParts(tag: string): [number, number, number] {
  const rollback = String(tag).match(/^v?(\d+)\.(\d+)\.R(\d+)$/i);
  if (rollback) {
    return [
      Number.parseInt(rollback[1], 10) || 0,
      Number.parseInt(rollback[2], 10) || 0,
      Number.parseInt(rollback[3], 10) || 0,
    ];
  }
  const parts = String(tag)
    .replace(/^v/i, "")
    .split("-")[0]
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function meetsMinVersion(tag: string): boolean {
  const [major, minor, patch] = tagParts(tag);
  const [minMajor, minMinor, minPatch] = MIN_PUBLISH_TAG;
  if (major !== minMajor) return major > minMajor;
  if (minor !== minMinor) return minor > minMinor;
  return patch >= minPatch;
}

export function isValidMarketplaceTag(tag: string): boolean {
  if (isRollbackTag(tag)) return meetsMinVersion(tag);
  if (!isMarketplaceSemverTag(tag)) return false;
  if (hasCiOnlySuffix(tag)) return false;
  return meetsMinVersion(tag);
}

export function marketIncludesAmo(market: PublishMarket): boolean {
  return market === "Firefox AMO" || market === "Open VSX + Firefox AMO" || market === "Both";
}

export function validateMarketplaceDeploy(params: {
  targetTag: string;
  releaseChannel: ReleaseChannel;
  publishMarket: PublishMarket;
}): { ok: true } | { ok: false; error: string } {
  const { targetTag, releaseChannel, publishMarket } = params;
  if (!isValidMarketplaceTag(targetTag)) {
    return {
      ok: false,
      error: `Tag ${targetTag} is not valid for marketplace publish. Use vMAJOR.MINOR.PATCH or rollback vMAJOR.MINOR.Rn (minimum v0.5.5). CI-only tags (-dev, -pr, -beta) cannot be published.`,
    };
  }
  if (releaseChannel === "Beta (Pre-release)" && marketIncludesAmo(publishMarket)) {
    return {
      ok: false,
      error:
        "Firefox AMO has no pre-release channel in this pipeline. Use Production channel or choose a market without Firefox AMO.",
    };
  }
  return { ok: true };
}
