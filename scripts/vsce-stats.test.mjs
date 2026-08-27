import assert from "node:assert/strict";
import { parseVsceDownloadCount, fetchVsceExtension } from "../website/admin/functions/api/_shared/vsce-stats.js";

assert.equal(parseVsceDownloadCount({ install: 3, downloadCount: 346 }), 346);
assert.equal(parseVsceDownloadCount({ install: 3 }), 3);

const live = await fetchVsceExtension("LorapokLabs.cursor-curse-monitor-by-lorapok");
assert.ok(live, "VS Code Marketplace extension should resolve");
assert.ok(live.downloadCount >= live.installCount, "downloadCount should track version publishes");

console.log(`vsce-stats.test.mjs: OK (downloadCount=${live.downloadCount}, install=${live.installCount})`);
