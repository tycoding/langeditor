import path from 'path'
import fs from 'node:fs'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import tailwind from '@tailwindcss/vite'
import postcss from 'postcss'
import prefixer from 'postcss-prefix-selector'

const vueTypeResolver = {
  fileExists: (filename: string) => fs.existsSync(filename) && fs.statSync(filename).isFile(),
  readFile: (filename: string) => {
    if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) return undefined
    return fs.readFileSync(filename, 'utf8')
  },
  realpath: fs.realpathSync,
}

function cssNamespacePlugin(): Plugin {
  return {
    name: 'vite-plugin-css-namespace',
    enforce: 'post',
    async generateBundle(_, bundle) {
      for (const key of Object.keys(bundle)) {
        const chunk = bundle[key]
        if (key.endsWith('.css') && 'source' in chunk) {
          const css = chunk.source as string
          const result = await postcss([
            prefixer({
              prefix: '[data-langeditor]',
              transform(prefix, selector, prefixedSelector) {
                // Keep portal-owned isolation selectors global: Tippy poppers may
                // be appended to document.body outside the editor root.
                if (
                  selector.includes('[data-langeditor]') ||
                  selector.includes('[data-langeditor-editor]')
                ) {
                  return selector
                }
                // Handle dark mode variant: .dark .class -> [data-langeditor].dark .class
                if (selector.startsWith('.dark')) {
                  return `[data-langeditor]${selector}`
                }
                return prefixedSelector
              },
            }),
          ]).process(css, { from: undefined })
          chunk.source = result.css
        }
      }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue({ script: { fs: vueTypeResolver } }),
    tailwind(),
    dts({
      insertTypesEntry: true,
      outDirs: 'lib',
      entryRoot: 'src',
      include: ['src'],
    }),
    cssNamespacePlugin(),
  ],
  optimizeDeps: {
    include: ['vue'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'lib',
    // Main, Mini, and Element builds share the published lib directory.
    // A standalone main build must not delete an already-built Element bundle.
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'LangEditor',
      fileName: format => `langeditor.${format}.js`,
    },
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        exports: 'named',
        globals: {
          vue: 'vue',
        },
        assetFileNames: info => {
          if (info.name && info.name.endsWith('.css')) {
            return 'style.css'
          }
          return 'assets/[name].[hash][extname]'
        },
      },
      // Keep editor engine packages as shared runtime dependencies. This is
      // required for collaboration plugins: Yjs and ProseMirror perform
      // constructor checks, so bundling a second copy breaks transactions and
      // cursor synchronization across plugin boundaries.
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
