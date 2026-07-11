import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/admin/',
  plugins: [vue()],
  server: {
    port: 5174,
  },
  preview: {
    port: 4174,
  },
});
