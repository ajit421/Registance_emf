import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  build: {
    rolldownOptions: {
      output: {
        // long-lived vendor chunks so app updates don't invalidate the browser cache for libraries
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'ui', test: /node_modules[\\/](radix-ui|@radix-ui|lucide-react|sonner|@floating-ui)[\\/]/ },
          ],
        },
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
