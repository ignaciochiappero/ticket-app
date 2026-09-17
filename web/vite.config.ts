/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // `@` points at src/, which is what shadcn's component imports expect.
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // One jsdom environment per worker is expensive. Left unbounded, vitest
    // spawns one per core, and on a machine that is short of memory the OS
    // kills the extras: the run then reports "passed" for the files that did
    // run and says nothing about the ones that never started.
    maxWorkers: 4,
  },
});
