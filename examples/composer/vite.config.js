import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      {
        find: '@langeditor/core/style.css',
        replacement: fileURLToPath(new URL('../../lib/style.css', import.meta.url)),
      },
      {
        find: '@langeditor/core',
        replacement: fileURLToPath(new URL('../../lib/langeditor.es.js', import.meta.url)),
      },
    ],
  },
})
