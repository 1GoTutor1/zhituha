import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'artifacts/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Dynamic Supabase records and the existing shared app context are being
      // typed incrementally; keep this visible without blocking releases.
      '@typescript-eslint/no-explicit-any': 'warn',
      // React Compiler diagnostics are useful guidance, but this Vite app does
      // not enable the compiler. Keep the canonical Rules of Hooks as errors.
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
    },
  },
  { files: ['src/main.tsx'], rules: { 'react-refresh/only-export-components': 'off' } },
])
