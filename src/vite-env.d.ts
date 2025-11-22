/// <reference types="vite/client" />
// vite.config.ts
// vite.config.ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Add this type declaration after the imports
declare global {
  interface Window {
    mappls: any;
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/mapmyindia-api': {
        target: 'https://atlas.mapmyindia.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/mapmyindia-api/, ''),
      },
    },
  },
});