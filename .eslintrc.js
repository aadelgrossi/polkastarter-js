module.exports = {
  env: {
    node: true,
    mocha: true,
    es2021: true,
  },
  extends: [
    'airbnb-base',
    'airbnb-typescript/base',
    'plugin:prettier/recommended',
    'plugin:mocha/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    root: true,
    ecmaVersion: 'latest',
    project: './tsconfig.eslint.json',
  },
  plugins: ['@typescript-eslint', 'prettier'],
  rules: {
    'prettier/prettier': [
      'error',
      {
        endOfLine: 'auto',
      },
    ],
    'import/no-extraneous-dependencies': 'off',
    'import/prefer-default-export': 'off',
    'no-use-before-define': 'off',
    'class-methods-use-this': 'off',
    'no-console': 'off',
    'no-prototype-builtins': 'off',
    'no-async-promise-executor': 'off',
    'mocha/no-mocha-arrows': 'off',
    'mocha/no-setup-in-describe': 'off',
    'no-underscore-dangle': 'off',
    '@typescript-eslint/default-param-last': 'off',
    '@typescript-eslint/return-await': 'off',
    '@typescript-eslint/no-use-before-define': ['error'],
    'no-param-reassign': ['error', { props: false }],
    'consistent-return': 'off',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        varsIgnorePattern: '_',
        argsIgnorePattern: '_',
      },
    ],
    'radix': 'off',
    '@typescript-eslint/naming-convention': 'off',
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal'],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
  },
};
