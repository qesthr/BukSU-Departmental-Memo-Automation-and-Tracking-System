import globals from 'globals';
import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...globals.browser
            }
        },
        rules: {
            'no-console': 'warn',
            'no-unused-vars': 'warn',
            'no-var': 'error',
            'prefer-const': 'error',
            'prefer-arrow-callback': 'warn',
            'eqeqeq': ['error', 'always'],
            'curly': ['error', 'all'],
            'no-trailing-spaces': 'error'
        }
    },
    {
        ignores: ['node_modules/**', 'dist/**', 'build/**']
    }
];
