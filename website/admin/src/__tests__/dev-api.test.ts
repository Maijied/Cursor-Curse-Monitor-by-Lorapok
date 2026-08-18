import { describe, it, expect } from "vitest";
import { createDevApiMiddleware } from "../../vite-dev-api.mjs";
import http from "node:http";

function request(port: number, path: string) {
  return new Promise<{ status: number; body: unknown }>((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${path}`, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode ?? 0, body: data });
        }
      });
    }).on("error", reject);
  });
}

describe("dev API middleware", () => {
  it("serves /api/health", async () => {
    const app = createDevApiMiddleware();
    const server = http.createServer((req, res: http.ServerResponse) => app(req, res, () => { res.statusCode = 404; res.end(); }));
    await new Promise<void>((resolve) => server.listen(9877, resolve));
    const { status, body } = await request(9877, "/api/health");
    server.close();
    expect(status).toBe(200);
    expect(body).toHaveProperty("checks");
  });
});
