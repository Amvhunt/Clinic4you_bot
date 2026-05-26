module.exports = {
  projects: [
    {
      displayName: 'core-bot',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: 'apps/bot',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      collectCoverageFrom: [
        '<rootDir>/src/**/*.ts',
        '!<rootDir>/src/**/*.d.ts',
        '!<rootDir>/src/index.ts',
      ],
    },
    {
      displayName: 'notifications',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: 'modules/notifications',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      collectCoverageFrom: [
        '<rootDir>/src/**/*.ts',
        '!<rootDir>/src/**/*.d.ts',
        '!<rootDir>/src/index.ts',
      ],
    },
    {
      displayName: 'altegio',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: 'modules/altegio',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      collectCoverageFrom: [
        '<rootDir>/src/**/*.ts',
        '!<rootDir>/src/**/*.d.ts',
        '!<rootDir>/src/index.ts',
      ],
    },
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
