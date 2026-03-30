import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { noApiRoutesInNavigate } from './eslint-rules/no-api-routes-in-navigate.js'

export default tseslint.config(
  { ignores: ['dist', 'src/generated'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'edulift-custom': {
        rules: {
          'no-api-routes-in-navigate': noApiRoutesInNavigate,
        },
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-explicit-any': [
        'warn',
        {
          'ignoreRestArgs': true,
          'fixToUnknown': false,
        },
      ],
      // Prevent navigate() calls to API routes
      'edulift-custom/no-api-routes-in-navigate': 'error',

      // TypeScript strictness (aligned with backend)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-var-requires': 'error',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',

      // Strict patterns (aligned with backend)
      'no-debugger': 'error',
      'no-alert': 'off', // Browser app uses confirm() for user interactions
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-throw-literal': 'error',

      // Code style (aligned with backend)
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],
      'comma-dangle': ['error', 'always-multiline'],
    },
  },
)
