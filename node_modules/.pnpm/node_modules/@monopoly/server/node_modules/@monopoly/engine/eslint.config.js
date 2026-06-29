import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**']
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@monopoly/server', '*/apps/server/*'],
              message: 'Engine package must not import from server to maintain clean package boundaries.'
            }
          ]
        }
      ],
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
);
