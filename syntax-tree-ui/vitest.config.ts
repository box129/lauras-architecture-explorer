import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Separate from vite.config.ts (kept untouched) so the new unit-test setup for
// the architectural-explanation slice is fully additive to the existing project.
export default defineConfig({
  plugins: [react()],
  define: {
    // Mirrors vite.config.ts's build stamp so components that render it
    // stay testable without the git-derived value.
    __BUILD_COMMIT__: JSON.stringify('test'),
    __BUILD_WORKSPACE__: JSON.stringify('test-workspace'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Scope to component/unit tests under src/. The project's Playwright
    // e2e specs live under tests/e2e/*.spec.cjs and are run separately via
    // the test:e2e:* npm scripts -- excluding them here keeps `npm run
    // test` (vitest) and Playwright from colliding over the same files.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
