/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation
        'style',    // Formatting, missing semicolons, etc
        'refactor', // Code restructuring
        'perf',     // Performance improvements
        'test',     // Adding tests
        'build',    // Build system or dependencies
        'ci',       // CI/CD configuration
        'chore',    // Maintenance tasks
        'revert',   // Revert previous commit
      ],
    ],
    'scope-enum': [
      1,
      'always',
      [
        'web',
        'api',
        'ui',
        'database',
        'shared-types',
        'docs',
        'payments',
        'bookings',
        'sessions',
        'venues',
        'seats',
        'auth',
        'socket',
        'deps',
        'config',
        'ci',
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 100],
  },
};
