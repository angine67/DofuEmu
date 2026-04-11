import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  build: {
    outDir: path.resolve(__dirname, '../../dist/main'),
    lib: {
      entry: path.resolve(__dirname, 'index.ts'),
      formats: ['cjs'],
      fileName: () => 'index.cjs'
    },
    rollupOptions: {
      external: (id) => id === 'electron' || id.startsWith('electron/') || !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('@dofemu/')
    },
    minify: false,
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@dofemu/shared': path.resolve(__dirname, '../shared/index.ts')
    }
  }
})
