import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error local dev middleware (JS)
import { createDevApiMiddleware } from "../../vite-dev-api.mjs";
import { loadSiteDataFixture } from "./site-data";

const adminRoot = dirname(fileURLToPath(import.meta.url));
const siteDataPath = resolve(adminRoot, "../../../site-data.json");

export type TestDataServer = {
  apiBase: string;
  siteDataUrl: string;
  origin: string;
  siteData: ReturnType<typeof loadSiteDataFixture>;
  close: () => Promise<void>;
};

export function startTestDataServer(): Promise<TestDataServer> {
  const siteData = loadSiteDataFixture();
  const devApi = createDevApiMiddleware();

  const server: Server = createServer((req, res) => {
    const path = req.url?.split("?")[0] ?? "/";

    if (path === "/site-data.json") {
      res.setHeader("Content-Type", "application/json");
      res.end(readFileSync(siteDataPath, "utf8"));
      return;
    }

    if (path.startsWith("/api")) {
      devApi(req, res, () => {
        res.statusCode = 404;
        res.end();
      });
      return;
    }

    res.statusCode = 404;
    res.end();
  });

  return new Promise((resolvePromise, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to bind test data server"));
        return;
      }

      const origin = `http://127.0.0.1:${address.port}`;
      resolvePromise({
        apiBase: `${origin}/api`,
        siteDataUrl: `${origin}/site-data.json`,
        origin,
        siteData,
        close: () =>
          new Promise((resolveClose, rejectClose) => {
            server.close((err) => (err ? rejectClose(err) : resolveClose()));
          }),
      });
    });
  });
}
