import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Polyfill process.env for compatibility if needed, 
    // though using import.meta.env is preferred in Vite
    'process.env': process.env
  }
});