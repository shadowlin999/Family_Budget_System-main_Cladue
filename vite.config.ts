import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Default: node for pure TS tests; component tests override via @vitest-environment docblock
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/components/**', 'src/views/**', 'src/store/**'],
      reporter: ['text', 'lcov'],
    },
  },
})
