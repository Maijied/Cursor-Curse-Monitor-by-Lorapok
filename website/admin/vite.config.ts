import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
// @ts-expect-error local dev middleware (JS)
import { createDevApiMiddleware } from './vite-dev-api.mjs'

const rootDir = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'site-data-dev',
      configureServer(server) {
        server.middlewares.use(createDevApiMiddleware())
        server.middlewares.use('/site-data.json', (_req, res) => {
          const file = resolve(rootDir, '../site-data.json')
          res.setHeader('Content-Type', 'application/json')
          res.end(readFileSync(file, 'utf8'))
        })
      },
    },
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
})
