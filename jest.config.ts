import type { Config } from 'jest';

const config: Config = {
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                tsconfig: 'tsconfig.jest.json',
            },
        ],
    },
    testEnvironment: 'jsdom',
    testMatch: [
        '<rootDir>/src/tests/jest/**/*.spec.{ts,tsx}',
        '<rootDir>/src/tests/jest/**/*.test.{ts,tsx}',
    ],
    moduleNameMapper: {
        '\\.(css|less|scss|sass)$':
            '<rootDir>/src/tests/jest/__mocks__/styleMock.ts',
        '^react-markdown$': '<rootDir>/src/tests/jest/__mocks__/emptyMock.ts',
        '^remark-breaks$': '<rootDir>/src/tests/jest/__mocks__/emptyMock.ts',
        '^remark-math$': '<rootDir>/src/tests/jest/__mocks__/emptyMock.ts',
        '^remark-gfm$': '<rootDir>/src/tests/jest/__mocks__/emptyMock.ts',
        '^nanoid$': '<rootDir>/src/tests/jest/__mocks__/nanoid.ts',
    },
};

export default config;
