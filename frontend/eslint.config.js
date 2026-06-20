import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // shadcn/ui files export `*Variants` (cva) helpers alongside the component;
      // this is an HMR-only hint, not a correctness rule. Keep it as a warning.
      'react-refresh/only-export-components': 'warn',
      // New, aggressive rule from eslint-plugin-react-hooks. The codebase uses a
      // few intentional "sync state when a prop loads" effects — surface as a
      // warning rather than failing the build. rules-of-hooks stays an error.
      'react-hooks/set-state-in-effect': 'warn',
      // jsx-a11y is enabled to catch accessibility issues, but the existing
      // findings are surfaced as warnings (not build-breaking) and cleaned up over time.
      'jsx-a11y/label-has-associated-control': 'warn',
      'jsx-a11y/no-autofocus': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
    },
  },
])
