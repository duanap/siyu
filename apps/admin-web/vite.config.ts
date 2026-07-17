import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/admin/',
  plugins: [vue()],
  server: {
    port: 5174,
    proxy: {
      '/api': process.env.SIYU_API_ORIGIN ?? 'http://127.0.0.1:3000',
      '/health': process.env.SIYU_API_ORIGIN ?? 'http://127.0.0.1:3000',
    },
  },
  preview: {
    port: 4174,
  },
});
