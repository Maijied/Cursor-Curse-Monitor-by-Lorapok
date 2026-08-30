import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { syncReleaseArtifactVersions } from "../scripts/lib-sync-release-artifacts.mjs";

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

test("syncReleaseArtifactVersions marks ahead-of-GitHub bumps as candidate", async () => {
  const root = mkdtempSync(join(tmpdir(), "ccm-sync-"));
  try {
    const pkg = {
      version: "99.0.99",
      displayName: "Cursor Curse Monitor by Lorapok",
      homepage: "https://cursor.lorapok.tech/",
      company: { website: "https://lorapok.tech", adminUrl: "https://cursor-dev.lorapok.tech" },
      repository: { url: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok.git" },
    };

    writeJson(join(root, "package.json"), pkg);
    mkdirSync(join(root, "website"), { recursive: true });
    writeJson(join(root, "website/site-data.json"), {
      version: "1.0.57",
      packageVersion: "1.0.57",
      publishedReleaseVersion: "1.0.57",
      releaseStatus: "published",
      syncStatus: "synced",
      github: { repo: "Maijied/Cursor-Curse-Monitor-by-Lorapok", releaseTag: "v1.0.57" },
      install: { releaseTag: "./scripts/release.sh 1.0.57" },
    });
    writeJson(join(root, "website/seo.json"), {
      version: "1.0.57",
      packageVersion: "1.0.57",
      syncStatus: "synced",
      structuredData: { softwareApplication: { softwareVersion: "1.0.57" } },
    });
    writeFileSync(
      join(root, "website/index.html"),
      `<script type="application/ld+json">{"softwareVersion":"1.0.57"}</script>\n`,
      "utf8",
    );

    const result = await syncReleaseArtifactVersions(root, "99.0.99", pkg, {
      githubToken: undefined,
    });

    assert.equal(result.releaseStatus, "candidate");
    assert.ok(result.publishedReleaseVersion);
    assert.notEqual(result.publishedReleaseVersion, "99.0.99");
    assert.equal(result.syncStatus, "release-candidate");

    const site = JSON.parse(readFileSync(join(root, "website/site-data.json"), "utf8"));
    assert.equal(site.version, "99.0.99");
    assert.equal(site.publishedReleaseVersion, result.publishedReleaseVersion);
    assert.equal(site.releaseStatus, "candidate");
    assert.equal(site.productContext.packageVersion, "99.0.99");
    assert.equal(site.productContext.releaseVersion, result.publishedReleaseVersion);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
