import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // We cast process to any to avoid TypeScript errors if node types aren't perfectly resolved.
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Inject the API Key into the Vite environment variable
      'import.meta.env.VITE_API_KEY': JSON.stringify(env.API_KEY)
    }
  };
});