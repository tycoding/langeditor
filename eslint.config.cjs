const js = require('@eslint/js')
const globals = require('globals')
const tsParser = require('@typescript-eslint/parser')
const prettier = require('eslint-config-prettier')
const vue = require('eslint-plugin-vue')

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'public/**',
      'es/**',
      'lib/**',
      'dist/**',
      'src/assets/**',
      'plop-templates/**',
      'handlebars/**',
      'website/**',
      'build/**',
    ],
  },
  js.configs.recommended,
  ...vue.configs['flat/essential'],
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },
  {
    files: [
      'src/**/*.{js,jsx,ts,tsx,vue}',
      'packages/editor-plugin-spreadsheet/src/**/*.{js,jsx,ts,tsx,vue}',
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...prettier.rules,
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-unused-vars': 'off',
      'vue/no-unused-vars': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/no-mutating-props': 'off',
    },
  },
]
