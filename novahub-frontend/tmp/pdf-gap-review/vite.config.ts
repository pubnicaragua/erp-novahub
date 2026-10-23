import { defineConfig, mergeConfig } from 'vite';
import baseConfig from '../../vite.config.ts';
const config = mergeConfig(baseConfig, defineConfig({
  build: {
    outDir: 'tmp/pdf-gap-review/bundle', emptyOutDir: true,
    lib: { entry: 'tmp/pdf-visual-review/review.ts', name: 'PdfGapReview', formats: ['iife'], fileName: 'review' },
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
}));
delete config.build.rollupOptions.output.manualChunks;
export default config;
