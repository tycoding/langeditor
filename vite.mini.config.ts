import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwind from '@tailwindcss/vite'

export default defineConfig({
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
      entry: path.resolve(__dirname, 'src/mini.ts'),
      name: 'LangEditorMini',
      fileName: format => `langeditor-mini.${format}.js`,
      formats: ['es', 'umd'],
    },
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        exports: 'named',
        assetFileNames: 'langeditor-mini.[ext]',
        globals: { vue: 'vue' },
      },
      external: (id: string) =>
        id === 'vue' ||
        id === 'yjs' ||
        id.startsWith('yjs/') ||
        id === 'y-prosemirror' ||
        id.startsWith('y-prosemirror/') ||
        id === 'y-protocols' ||
        id.startsWith('y-protocols/') ||
        id.startsWith('@tiptap/') ||
        id.startsWith('prosemirror-'),
    },
  },
})
