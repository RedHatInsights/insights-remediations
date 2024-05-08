const globals = require("globals");
const pluginJs = require("@eslint/js");
const jest = require('eslint-plugin-jest');

module.exports = [
  {languageOptions: { globals: globals.node }},
  pluginJs.configs.recommended,
  {
    "rules": {
      "no-template-curly-in-string": 2,
      "array-callback-return": 2,
      "curly": ["error", "all"],
      "dot-location": ["error", "property"],
      "dot-notation": 2,
      "eqeqeq": 2,
      "no-caller": 2,
      "no-else-return": 2,
      "no-with": 2,
      "vars-on-top": 2,
      "wrap-iife": 2,
      "yoda": ["error", "never"],
      "strict": "off",
      "array-bracket-spacing": 2,
      "comma-dangle": 2,
      "comma-spacing": [2, {"after": true}],
      "comma-style": 2,
      "eol-last": 2,
      "func-names": ["error", "never"],
      "indent": "off",
      "key-spacing": 2,
      "keyword-spacing": 2,
      "linebreak-style": ["error", "unix"],
      "max-len": [2, 130],
      "no-bitwise": 2,
      "no-mixed-spaces-and-tabs": 2,
      "no-multiple-empty-lines": ["error", {"max": 1}],
      "no-trailing-spaces": 2,
      "one-var": ["error", "never"],
      "padding-line-between-statements": ["error", {"blankLine": "always", "prev": "block-like", "next": "*"}],
      "quote-props": ["error", "as-needed"],
      "quotes": ["error", "single", {"allowTemplateLiterals": true}],
      "semi": ["error", "always"],
      "space-before-blocks": 2,
      "space-in-parens": 2,
      "space-infix-ops": 2,
      "space-unary-ops": ["error", {"words": false, "nonwords": false}],
      "no-use-before-define": ["error", {"functions": false}],
      "no-undef": 2,
      "no-unused-vars": 2,
      "no-var": 2,
      "object-shorthand": 2,
      "prefer-const": 2,
      "no-mixed-requires": 2,
      "no-path-concat": 2,
      "no-process-env": 2,
      "no-process-exit": 2,
    }
  },
  {
    files: [
        '!scratch/**',
        '/src/test/index.js',
        '**/*.integration.js',
        '**/*.unit.js'
    ],
    ...jest.configs['flat/recommended'],
    rules: {
      ...jest.configs['flat/recommended'].rules,
      'jest/prefer-expect-assertions': 'off',
      'strict': 'off'
    }
  }
];
