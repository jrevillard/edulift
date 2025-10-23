import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default [
  { ignores: ['dist', 'node_modules', 'coverage', '**/*.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        global: 'readonly',
        // Node.js global types
        NodeJS: 'readonly',
      },
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // TypeScript specific rules
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-var-requires': 'error',
      '@typescript-eslint/ban-ts-comment': 'off', // Allow @ts-nocheck when needed

      // General JavaScript/TypeScript rules
      'no-console': 'off', // Allow console.log for debugging
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',

      // Best practices for Node.js backend
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',

      // Code style
      'comma-dangle': ['error', 'always-multiline'],
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
      'quote-props': ['error', 'as-needed'],

      // Function rules
      'func-style': ['error', 'expression'],
      'arrow-spacing': 'error',

      // Error handling patterns
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'error',

      // Import/Export rules (if using import statements)
      'no-duplicate-imports': 'error',
    },
  },
  {
    files: ['src/**/__tests__/**/*.ts', 'src/__tests__/**/*.ts', 'tests/**/*.ts', 'src/**/*.test.ts'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parserOptions: {
        project: false, // Disable project-based parsing for test files
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        global: 'readonly',
        // Node.js global types
        NodeJS: 'readonly',
        // Jest globals for testing
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        jest: 'readonly',
      },
    },
    rules: {
      // Console.log allowed in tests for debugging and assertions
      'no-console': 'off',
      // Allow 'any' for test mocks and assertions (strict on unused vars)
      '@typescript-eslint/no-explicit-any': 'off',
      // Allow @ts-nocheck in tests when needed
      '@typescript-eslint/ban-ts-comment': 'off',
      // STRICT: No unused variables anywhere, including tests
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      // Allow require imports for test setup (common in Jest)
      '@typescript-eslint/no-var-requires': 'off',
      // Allow function declarations (common in test descriptions)
      'func-style': 'off',
      // Keep style rules consistent
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],
      'comma-dangle': ['error', 'always-multiline'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      // Stricter rules for source code
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
    },
  },
  {
    files: ['src/**/__tests__/**/*.ts', 'src/**/*.test.ts'],
    rules: {
      // Relax non-null assertion in tests (often used with test data)
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['src/middleware/**/*.ts', 'src/routes/**/*.ts'],
    rules: {
      // Allow any for Express request/response types when needed
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['prisma/**/*.ts'],
    rules: {
      // Prisma generated files may need special handling
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]