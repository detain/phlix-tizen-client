import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import globals from 'globals';

// Flat config for the Phlix Tizen client (Vue 3 thin consumer of @phlix/ui).
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'app/**', // legacy vanilla-JS UI, retained only for reference
      'package/**',
      'coverage/**',
      '.logs/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue']
      }
    }
  },
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      // vue-tsc/tsc resolve identifiers + types; no-undef misfires on globals.
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ],
      // Single-word component names are part of the @phlix/ui surface.
      'vue/multi-word-component-names': 'off'
    }
  },
  {
    files: ['**/*.test.ts', 'tests/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
);
