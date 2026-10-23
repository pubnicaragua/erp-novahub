import { defineConfig, mergeConfig } from 'vite';
import baseConfig from '../../vite.config.ts';
const config = mergeConfig(baseConfig, defineConfig({
  build: {
    outDir: 'tmp/pdf-visual-review/visual-long-dist',
    emptyOutDir: true,
    lib: { entry: 'tmp/pdf-visual-review/review-long.ts', name: 'PdfVisualReviewLong', formats: ['iife'], fileName: 'review-long' },
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
}));
delete config.build.rollupOptions.output.manualChunks;
export default config;
