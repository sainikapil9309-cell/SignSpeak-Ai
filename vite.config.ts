import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Expose 'API_KEY' to the client side in addition to standard 'VITE_*' variables
  envPrefix: ['VITE_', 'API_KEY'],
});