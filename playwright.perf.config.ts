import { defineConfig, devices } from '@playwright/test';

/**
 * Замеры производительности редактора вынесены отдельным конфигом и отдельным
 * каталогом: CI гоняет `npx playwright test` без grep и подхватил бы их из
 * основного каталога, а на нагруженном windows-раннере такой тест будет флакать.
 *
 * Прогон: npx playwright test --config=playwright.perf.config.ts
 * Числа складываются в perf-report.json рядом с конфигом.
 */
export default defineConfig({
    testDir: './src/tests/perf',
    workers: 1,
    fullyParallel: false,
    retries: 0,
    reporter: 'list',
    timeout: 180_000,
    use: {
        baseURL: process.env.PERF_BASE_URL ?? 'http://localhost:3000',
        trace: 'off',
        video: 'off',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'npm run dev',
        url: process.env.PERF_BASE_URL ?? 'http://localhost:3000',
        reuseExistingServer: true,
    },
});
