import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// This harness uses the built popup but never a real browser profile or account.
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
    : "playwright"
);
const dist = fileURLToPath(new URL("../dist", import.meta.url));
const output = resolve(process.env.ARGOS_SCREENSHOTS_DIR || "visual-screenshots");
const json = async (path) => JSON.parse(await readFile(resolve(dist, path), "utf8"));
const version = (await json("manifest.json")).version;
await mkdir(output, { recursive: true });

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
const server = createServer(async (request, response) => {
  try {
    const path = resolve(dist, "." + new URL(request.url, "http://127.0.0.1").pathname);
    if (!path.startsWith(dist + sep)) throw new Error("Outside popup build");
    const body = await readFile(path);
    response.writeHead(200, { "Content-Type": types[extname(path)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = "http://127.0.0.1:" + server.address().port;
let browser;

try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.VISUAL_BROWSER_EXECUTABLE || undefined,
    args: ["--disable-lcd-text", "--font-render-hinting=none"],
  });
  for (const [language, locale] of [["en", "en-US"], ["bn", "bn-BD"]]) {
    const messages = await json("_locales/" + language + "/messages.json");
    for (const width of [360, 480]) {
      const context = await browser.newContext({ locale, viewport: { width, height: 680 } });
      try {
        await context.route("**/*", (route) =>
          new URL(route.request().url()).origin === origin ? route.continue() : route.abort()
        );
        await context.addInitScript(({ messages, version }) => {
          const runtime = {
            id: "synthetic-visual-test",
            getManifest: () => ({}),
            sendMessage: async () => null,
            onMessage: { addListener() {}, removeListener() {} },
          };
          globalThis.chrome ??= {};
          globalThis.chrome.runtime = runtime;
          globalThis.browser = {
            runtime,
            storage: {
              local: { get: async (key) => ({ [key]: { productNotices: false, lastSeenVersion: version } }) },
            },
            i18n: { getMessage: (key) => messages[key]?.message || "" },
          };
        }, { messages, version });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(origin + "/popup.html");
        const title = page.getByRole("heading", { name: messages.connectToCursor.message, exact: true });
        const button = page.getByRole("button", { name: messages.signInWithBrowser.message, exact: true });
        await title.waitFor({ state: "visible" });
        await button.waitFor({ state: "visible" });
        await page.evaluate(() => document.fonts.ready);
        assert.ok(await button.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), "Sign-in label overflows");
        await page.screenshot({
          path: resolve(output, "popup-disconnected-" + language + "-" + width + ".png"),
          animations: "disabled",
        });
        assert.deepEqual(errors, [], "Popup must render without JavaScript errors");
        console.log("Captured popup:", language, width);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  if (browser) await browser.close();
  await new Promise((done) => server.close(done));
}
