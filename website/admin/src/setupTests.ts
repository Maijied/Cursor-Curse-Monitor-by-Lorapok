import "@testing-library/jest-dom";
import { loadEnv } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const adminRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const loaded = loadEnv("test", adminRoot, "");

for (const [key, value] of Object.entries(loaded)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}
