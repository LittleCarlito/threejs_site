const fs = require('fs');

// Define allowed types (matching those in conventional-changelog-config.js)
const allowedTypes = [
  'build', 'chore', 'ci', 'docs', 'feat', 'fix', 
  'perf', 'refactor', 'revert', 'style', 'test', 'slice'
];

// Define scopes to be ignored by versioning (must match those in lerna.json)
const ignoredScopes = ['pipeline'];

// Write types to files that shell scripts can read
fs.writeFileSync('.husky/.commit-types', allowedTypes.join(' '));
fs.writeFileSync('.husky/.ignored-scopes', ignoredScopes.join(' '));

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', allowedTypes],
    'type-case': [2, 'always', 'lowercase'],
    'type-empty': [2, 'never'],
    'scope-case': [2, 'always', 'lowercase'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-case': [2, 'never', ['sentence-case', 'pascal-case', 'upper-case']],
    'header-max-length': [2, 'always', 72]
  },
  ignorePatterns: [
    // List of patterns to ignore (if needed)
  ],
  helpUrl: 'https://github.com/conventional-changelog/commitlint/#what-is-commitlint'
};
