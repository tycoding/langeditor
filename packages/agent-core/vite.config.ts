import path from 'node:path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [dts({ insertTypesEntry: true, outDir: 'dist', entryRoot: 'src' })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: path.resolve(import.meta.dirname, 'src/index.ts'),
      name: 'AgentCore',
      fileName: 'index.es',
      formats: ['es'],
    },
    cssCodeSplit: false,
    rollupOptions: {
      external: [],
      output: {
        exports: 'named',
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
