import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { pwa } from './pwa';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), pwa()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
