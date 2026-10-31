import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Development: the browser talks only to :5173; /api is forwarded to Express on :3000 (D-015), so there is no CORS and the session cookie stays first-party.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://localhost:3000' },
  },
});