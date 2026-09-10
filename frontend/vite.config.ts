import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // F-20 (QA-REPORT-1): with no explicit split, Rollup names a vendor
        // chunk after whichever of this app's own modules happens to pull
        // it in first — which is how the reports feature's own query-key
        // file (`reportKeys.ts`) ended up as the label on a 381 kB chunk
        // that is really Recharts. It is correctly lazy-loaded already (no
        // runtime cost), so this is a bundle-analysis naming fix only, not
        // a behaviour change.
        manualChunks(id) {
          if (id.includes('node_modules/recharts')) {
            return 'recharts'
          }
        },
      },
    },
  },
})
