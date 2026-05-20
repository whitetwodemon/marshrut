import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Build outputs to ../frontend so nginx serves the compiled files
  build: {
    outDir: '../frontend',
    emptyOutDir: true,
  },
  // Dev server proxies API to backend
  server: {
    proxy: {
      '/api': {
        target: 'https://localhost:8443',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
