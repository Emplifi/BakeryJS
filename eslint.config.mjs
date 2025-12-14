import tseslint from 'typescript-eslint'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import jest from 'eslint-plugin-jest'
import globals from 'globals'

export default tseslint.config(
  // Global ignores
  {
    ignores: ['build/**', 'node_modules/**', 'docs/**']
  },

  // Base recommended configs
  ...tseslint.configs.recommended,

  // Base config for all files
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021
      }
    }
  },

  // TypeScript-specific rules for .ts files
  {
    files: ['**/*.ts'],
    rules: {
      // Disable rules from recommended that are too strict for this codebase
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',

      '@typescript-eslint/adjacent-overload-signatures': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        {
          allowExpressions: true
        }
      ],
      '@typescript-eslint/explicit-member-accessibility': 'warn',
      '@typescript-eslint/consistent-type-assertions': 'error',
      '@typescript-eslint/no-array-constructor': 'error',
      '@typescript-eslint/no-inferrable-types': [
        'error',
        {
          ignoreParameters: true,
          ignoreProperties: true
        }
      ],
      '@typescript-eslint/no-namespace': [
        'error',
        {
          allowDeclarations: true
        }
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/parameter-properties': 'error',
      '@typescript-eslint/triple-slash-reference': 'error'
    }
  },

  // Jest config for test files
  {
    files: ['**/*.test.ts', 'tests/**/*.ts'],
    plugins: {
      jest
    },
    languageOptions: {
      globals: {
        ...globals.jest
      }
    },
    rules: {
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
      'jest/no-identical-title': 'error',
      'jest/prefer-to-have-length': 'warn',
      'jest/valid-expect': 'error'
    }
  },

  // Prettier config (must be last to override other formatting rules)
  // Options are read from .prettierrc for consistency with editor extensions
  eslintPluginPrettierRecommended
)

