import { execSync } from 'node:child_process'
import { basename, resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:8000'

// Stamp the served build with its real checkout + commit so a running
// instance is distinguishable from a sibling checkout of the same product
// (live-audit finding: the owner's "unchanged landing" came from an older
// second checkout). Shown in Settings › Technical details and logged at
// startup.
let buildCommit = 'unknown'
try {
  buildCommit = execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim()
} catch {
  // Not a git checkout (e.g. exported archive): keep 'unknown'.
}
const buildWorkspace = basename(resolve(__dirname, '..'))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __BUILD_COMMIT__: JSON.stringify(buildCommit),
    __BUILD_WORKSPACE__: JSON.stringify(buildWorkspace),
  },
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        ws: true,
      },
    },
  },
})
