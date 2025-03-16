/**
 * @type {import('@jest/types').Config.InitialOptions}
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // transform: {
  //   '^.+\\.tsx?$': ['ts-jest', {
  //     useESM: true
  //   }],
  // },
  testMatch: ['**/*.test.ts'],
  // extensionsToTreatAsEsm: ['.ts', '.tsx'],
  // moduleNameMapper: {
  //   '^(\\.{1,2}/.*)\\.js$': '$1',
  // },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  rootDir: '.'
};