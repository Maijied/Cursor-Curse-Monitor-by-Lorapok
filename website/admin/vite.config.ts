import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cpSync, existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
// @ts-expect-error local dev middleware (JS)
import { createDevApiMiddleware } from './vite-dev-api.mjs'

const rootDir = dirname(fileURLToPath(import.meta.url))
const siteDataSrc = resolve(rootDir, '../site-data.json')
const seoSrc = resolve(rootDir, '../seo.json')

function copyStaticArtifacts(outDir: string) {
  if (existsSync(siteDataSrc)) cpSync(siteDataSrc, resolve(outDir, 'site-data.json'))
  if (existsSync(seoSrc)) cpSync(seoSrc, resolve(outDir, 'seo.json'))
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'copy-static-artifacts',
      closeBundle() {
        copyStaticArtifacts(resolve(rootDir, 'dist'))
      },
    },
    {
      name: 'site-data-dev',
      configureServer(server) {
        server.middlewares.use(createDevApiMiddleware())
        server.middlewares.use('/site-data.json', (_req, res) => {
          const file = resolve(rootDir, '../site-data.json')
          res.setHeader('Content-Type', 'application/json')
          res.end(readFileSync(file, 'utf8'))
        })
        server.middlewares.use('/seo.json', (_req, res) => {
          const file = resolve(rootDir, '../seo.json')
          res.setHeader('Content-Type', 'application/json')
          res.end(readFileSync(file, 'utf8'))
        })
      },
    },
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    include: [resolve(rootDir, 'src/**/*.{test,spec}.{ts,tsx}')],
    setupFiles: resolve(rootDir, 'src/setupTests.ts'),
    hookTimeout: 30_000,
    testTimeout: 15_000,
  },
})
