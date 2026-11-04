import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwind from '@tailwindcss/vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [vue(), tailwind(), dts({ insertTypesEntry: true, outDirs: ['dist'] })],
  resolve: {
    alias: {
      '@langeditor/core': path.resolve(__dirname, '../..'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'LangEditorDocx',
      fileName: 'index.es',
      formats: ['es'],
    },
    cssCodeSplit: false,
    rollupOptions: {
      external: ['vue', '@langeditor/core'],
      output: {
        exports: 'named',
        assetFileNames: assetInfo =>
          assetInfo.name?.endsWith('.css') ? 'style.css' : 'assets/[name]-[hash][extname]',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
})
