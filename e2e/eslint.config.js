import typescriptParser from '@typescript-eslint/parser';
import eslintRules from './eslint-testing-rules.js';

export default [
  {
    files: ['**/*.ts', '**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: typescriptParser,
      parserOptions: {
        project: './tsconfig.json'
      },
      globals: {
        // Browser globals for Playwright tests
        console: 'readonly',
        document: 'readonly',
        window: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        require: 'readonly',
        // Node.js globals
        process: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly'
      }
    },
    plugins: {
      'testing-standards': eslintRules
    },
    rules: {
      // Standard ESLint rules
      'no-console': 'off', // Allow console.log in tests for debugging
      'no-unused-vars': 'warn',
      'no-undef': 'error',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { 'avoidEscape': true }],
      'indent': ['error', 2],
      
      // Custom testing rules to prevent silent failures
      'testing-standards/no-silent-returns': 'error',
      'testing-standards/require-explicit-assertions': 'warn',
      'testing-standards/prefer-reliable-selectors': 'warn'
    }
  },
  {
    // Test-specific rules
    files: ['tests/**/*.spec.ts', 'tests/**/*.test.ts', '**/*.test.ts', '**/*.spec.ts'],
    rules: {
      // Balanced rules for test files
      'no-unused-vars': ['error', { 
        'varsIgnorePattern': '^_',
        'argsIgnorePattern': '^_',
        'args': 'after-used'
      }],
      'no-console': 'off', // Allow console.log for debugging in tests
      'semi': ['error', 'always'], // Enforce semicolons
      'quotes': ['error', 'single', { 'avoidEscape': true }], // Consistent quotes
      'indent': ['error', 2, { 'SwitchCase': 1 }] // Consistent indentation
    }
  },
  {
    // Fixtures and helper files - slightly more strict
    files: ['tests/fixtures/**/*.ts', 'utils/**/*.ts'],
    rules: {
      // Stricter rules for shared code
      'no-unused-vars': ['error', { 
        'varsIgnorePattern': '^_',
        'argsIgnorePattern': '^_',
        'args': 'after-used'
      }],
      'no-console': 'warn', // Warn about console.log in helpers
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { 'avoidEscape': true }],
      'indent': ['error', 2, { 'SwitchCase': 1 }]
    }
  }
];