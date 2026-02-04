
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Vite 自动处理 VITE_ 前缀的环境变量，无需手动 define
  build: {
    outDir: 'dist',
  }
});
