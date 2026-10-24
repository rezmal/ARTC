import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode standalone` inlines all JS/CSS into one HTML file that opens offline.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'standalone' ? [react(), viteSingleFile()] : [react()],
  build: { outDir: mode === 'standalone' ? 'dist-standalone' : 'dist' },
  test: { include: ['src/**/*.test.ts'] },
}));
