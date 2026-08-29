import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { readReleaseNotes } from "./scripts/lib-changelog.mjs";

function readExtensionVersion(): string {
  const localPkg = JSON.parse(
    readFileSync(resolve(__dirname, "package.json"), "utf8")
  ) as { version: string };
  if (localPkg.version && localPkg.version !== "0.0.0") {
    return localPkg.version;
  }
  const rootPkg = JSON.parse(
    readFileSync(resolve(__dirname, "../package.json"), "utf8")
  ) as { version: string };
  return rootPkg.version;
}

const extensionVersion = readExtensionVersion();
const releaseNotes = readReleaseNotes(extensionVersion);

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@lorapok/cursor-monitor-shared": resolve(
        __dirname,
        "../packages/shared/src/index.ts"
      ),
    },
  },
  define: {
    __EXTENSION_VERSION__: JSON.stringify(extensionVersion),
    __RELEASE_NOTES__: JSON.stringify(releaseNotes),
    __CCM_DEV_STORAGE_PREFIX__: JSON.stringify(
      process.env.CCM_BROWSER_EXT_DEV_STORAGE === "1"
    ),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/index.html"),
        options: resolve(__dirname, "src/options/index.html"),
        background: resolve(__dirname, "src/background/service-worker.ts"),
        "content/auth-capture": resolve(
          __dirname,
          "src/content/auth-capture.ts"
        ),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "background") return "background/service-worker.js";
          if (chunk.name === "content/auth-capture")
            return "content/auth-capture.js";
          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  publicDir: "public",
});
