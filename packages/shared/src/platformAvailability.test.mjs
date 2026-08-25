import assert from "node:assert";
import {
  formatAlsoAvailableOn,
  formatAlsoAvailableHtml,
  alsoAvailablePlatforms,
  PLATFORM_LINKS,
} from "../dist/platformAvailability.js";

assert(formatAlsoAvailableOn("ide").includes("VS Code Marketplace"));
assert(formatAlsoAvailableOn("browser").includes("Open VSX"));
assert(alsoAvailablePlatforms("ide").length >= 4);
assert(PLATFORM_LINKS.openVsx.url.includes("lorapok-labs"));
assert(formatAlsoAvailableHtml("browser").includes("<a href="));

console.log("platformAvailability: OK");
