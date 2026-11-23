import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

// The root package.json is the single source of truth for the version (UI, Tauri bundle, installers).
const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };

// Tauri expects a fixed dev port.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  define: { __APP_VERSION__: JSON.stringify(version) },
  // Cargo writes (and locks) thousands of files under src-tauri/target while the Rust shell builds;
  // watching them crashes the dev server with EBUSY.
  server: { port: 1420, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } },
  build: { target: 'es2022', outDir: 'dist' },
  test: { include: ['src/**/*.test.ts'] },
});
