import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwind from '@tailwindcss/vite'

export default defineConfig({
  // Vue's browser build still contains development guards written as
  // process.env.NODE_ENV. Replace them at build time so the standalone UMD
  // bundle does not require a Node process shim when loaded from file://.
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': JSON.stringify({ NODE_ENV: 'production' }),
  },
  plugins: [vue(), tailwind()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'lib',
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'src/element/index.ts'),
      name: 'LangEditorElement',
      fileName: format => `langeditor-element.${format}.js`,
      formats: ['es', 'umd'],
    },
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        exports: 'named',
        assetFileNames: 'langeditor-element.[ext]',
      },
    },
  },
})
