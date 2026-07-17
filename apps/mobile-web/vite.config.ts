import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  build: {
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/echarts/') || id.includes('/node_modules/zrender/')) {
            return 'charts';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.SIYU_API_ORIGIN ?? 'http://127.0.0.1:3000',
      '/health': process.env.SIYU_API_ORIGIN ?? 'http://127.0.0.1:3000',
    },
  },
  preview: {
    port: 4173,
  },
});
