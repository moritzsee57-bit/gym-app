import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
    host: 'localhost',
  },
  build: {
    target: 'es2020',
    minify: 'terser',
  },
  publicDir: 'public',
})
