import assert from "node:assert";
import {
  formatAlsoAvailableOn,
  formatAlsoAvailableMarkdown,
  alsoAvailablePlatforms,
  PLATFORM_LINKS,
  AMO_PUBLIC_URL,
  getPlatformAvailabilityStrip,
  formatPlatformStripHtml,
} from "../dist/platformAvailability.js";

assert(formatAlsoAvailableOn("ide").includes("VS Code Marketplace"));
assert(formatAlsoAvailableOn("browser").includes("Open VSX"));
assert(alsoAvailablePlatforms("ide").length >= 4);
assert(PLATFORM_LINKS.openVsx.url.includes("lorapok-labs"));
assert(PLATFORM_LINKS.firefox.url === AMO_PUBLIC_URL);
assert(formatAlsoAvailableMarkdown("browser").includes("[Open VSX]"));

const strip = getPlatformAvailabilityStrip("admin");
assert.equal(strip.length, 5);
assert.equal(strip[0].id, "openVsx");
assert.ok(strip.every((item) => item.url.startsWith("http")));

const withChrome = getPlatformAvailabilityStrip("website", {
  chrome: "https://example.com/chrome.zip",
});
assert.equal(withChrome.find((i) => i.id === "chrome")?.url, "https://example.com/chrome.zip");

const html = formatPlatformStripHtml("ide");
assert.ok(html.includes('aria-label="Platform availability"'));
assert.ok(html.includes("Open VSX"));
assert.ok(html.includes("Chrome zip"));

console.log("platformAvailability: OK");
