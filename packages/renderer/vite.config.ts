import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  root: __dirname,
  base: './',
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '../../dist/renderer'),
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@dofemu/shared': path.resolve(__dirname, '../shared/index.ts')
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5173
  },
  css: {
    postcss: {
      plugins: []
    }
  }
})
