import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Things the pure calculation packages must never touch (HANDOVER rule 1: engine purity). */
const FORBIDDEN_MODULES = [
  { group: ['node:*', 'fs', 'fs/*', 'path', 'os', 'child_process', 'crypto'], message: 'Engine/rules must not use Node built-ins.' },
  { group: ['react', 'react-dom', 'react/*', 'react-dom/*', 'react-i18next', 'zustand', 'recharts'], message: 'Engine/rules must not depend on UI libraries.' },
  { group: ['@tauri-apps/*'], message: 'Engine/rules must not depend on Tauri.' },
];
const FORBIDDEN_GLOBALS = ['window', 'document', 'localStorage', 'sessionStorage', 'navigator', 'process', 'Buffer', 'require', '__dirname'].map(
  (name) => ({ name, message: 'Engine/rules must run unchanged in Node, browser and Tauri: no platform globals.' }),
);

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/target/**',
      '**/src-tauri/**',
      '**/*.config.js',
      '**/*.config.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': 'allow-with-description' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // Pure packages: no platform imports or globals (tests and the Node-run demo script are exempt).
  {
    files: ['packages/engine/src/**/*.ts', 'packages/rules/src/**/*.ts'],
    ignores: ['**/*.test.ts', 'packages/engine/src/demo.ts'],
    languageOptions: { globals: { ...globals.es2021 } },
    rules: {
      'no-restricted-imports': ['error', { patterns: FORBIDDEN_MODULES }],
      'no-restricted-globals': ['error', ...FORBIDDEN_GLOBALS],
    },
  },
  // React hooks rules for the desktop UI.
  {
    files: ['apps/desktop/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.flat.recommended.rules },
  },
);
