import assert from "node:assert/strict";
import {
  isAlreadyPublished,
  isTransientMarketplaceError,
  parsePublishVsceArgs,
} from "../scripts/publish-vsce.mjs";

assert.equal(isAlreadyPublished("Error: already published"), true);
assert.equal(isAlreadyPublished("Version already exists on the marketplace"), true);
assert.equal(isAlreadyPublished("some other error"), false);

const html503 = `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN""http://www.w3.org/TR/html4/strict.dtd">
<HTML><HEAD><TITLE>Service Unavailable</TITLE></HEAD>
<BODY><h2>Service Unavailable</h2>
<hr><p>HTTP Error 503. The service is unavailable.</p>
</BODY></HTML>`;
assert.equal(isTransientMarketplaceError(html503), true);
assert.equal(isTransientMarketplaceError("HTTP Error 503. The service is unavailable."), true);
assert.equal(isTransientMarketplaceError("Gateway Timeout 504"), true);
assert.equal(isTransientMarketplaceError("Invalid Personal Access Token"), false);

const parsed = parsePublishVsceArgs(["node", "publish-vsce.mjs", "--pre-release", "--attempts", "4"]);
assert.equal(parsed.preRelease, true);
assert.equal(parsed.attempts, 4);

console.log("test_publish_vsce.mjs: OK");
