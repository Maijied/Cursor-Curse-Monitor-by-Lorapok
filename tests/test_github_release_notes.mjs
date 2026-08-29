import assert from "node:assert/strict";
import { generateGithubReleaseNotes } from "../scripts/generate-github-release-notes.mjs";

const notes = generateGithubReleaseNotes("1.0.34", { from: "v1.0.33" });

assert.match(notes, /## Install/);
assert.match(notes, /Open VSX/);
assert.match(notes, /Firefox Add-ons/);
assert.match(notes, /## Highlights|## What's new in v1\.0\.34/);
assert.doesNotMatch(notes, /fix\(ci\)/i);
assert.doesNotMatch(notes, /branch-protected/i);
assert.match(notes, /Full commit history/);

console.log("test_github_release_notes.mjs: OK");
