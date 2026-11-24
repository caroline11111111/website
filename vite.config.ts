import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        storefront: 'index.html',
        admin: 'admin.html',
      },
    },
  },
});
