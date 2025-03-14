module.exports = {
  extends: ['@commitlint/config-conventional'],
  ignores: [
    // Ignore GitHub's auto-generated squash commit messages
    (message) => /^.+\(#\d+\)$/m.test(message)
  ],
  rules: {
    'body-leading-blank': [1, 'always'],
    'body-max-line-length': [2, 'always', 100],
    'footer-leading-blank': [1, 'always'],
    'footer-max-line-length': [2, 'always', 100],
    'header-max-length': [2, 'always', 100],
    'subject-case': [
      2,
      'never',
      ['sentence-case', 'start-case', 'pascal-case', 'upper-case'],
    ],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'type-enum': [
      2,
      'always',
      [
        'build',
        'chore',
        'ci',
        'docs',
        'feat',
        'fix',
        'perf',
        'refactor',
        'revert',
        'style',
        'test'
      ],
    ],
    // Define valid scopes
    'scope-enum': [
      2,
      'always',
      [
        'blorkpack',
        'blorktools',
        'common',
        'core',
        'docs'
      ]
    ],
    // Ensure scopes are lowercase
    'scope-case': [2, 'always', 'lower-case'],
    // Allow multiple scopes with comma delimiter
    'scope-empty': [0, 'never'],
  },
  parserPreset: {
    parserOpts: {
      headerPattern: /^(\w*)(?:\(([\w,]+)\))?: (.*)$/,
      headerCorrespondence: ['type', 'scope', 'subject']
    }
  }
}; 