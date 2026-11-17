import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config(
  {
    ignores: [
      '**/dist/**',
      '.tools/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'assets/**',
      'sw.js',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
);
