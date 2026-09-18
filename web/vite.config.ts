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
    // Every worker pays for its own jsdom, and a machine that is short of
    // memory cannot start several: vitest then reports "Test Files 4 passed
    // (10)", a line that says passed while six files never ran. One worker at
    // a time takes about twenty seconds instead of eight, which is a fair
    // price for a number that can be believed. This runs before a push, not
    // before every commit, so the twelve seconds buy a lot and cost little.
    pool: 'forks',
    maxWorkers: 1,
  },
});
