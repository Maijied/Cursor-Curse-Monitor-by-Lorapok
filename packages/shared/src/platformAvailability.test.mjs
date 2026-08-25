import assert from "node:assert";
import {
  formatAlsoAvailableOn,
  formatAlsoAvailableMarkdown,
  alsoAvailablePlatforms,
  PLATFORM_LINKS,
  AMO_PUBLIC_URL,
} from "../dist/platformAvailability.js";

assert(formatAlsoAvailableOn("ide").includes("VS Code Marketplace"));
assert(formatAlsoAvailableOn("browser").includes("Open VSX"));
assert(alsoAvailablePlatforms("ide").length >= 4);
assert(PLATFORM_LINKS.openVsx.url.includes("lorapok-labs"));
assert(PLATFORM_LINKS.firefox.url === AMO_PUBLIC_URL);
assert(formatAlsoAvailableMarkdown("browser").includes("[Open VSX]"));

console.log("platformAvailability: OK");
