import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/**
 * Кроссбраузерная проверка из ТЗ. Основной конфиг гоняет только chromium,
 * потому что в CI стоит windows-раннер, а эти прогоны делаются локально:
 * npx playwright test --config=playwright.crossbrowser.config.ts project.agent
 *
 * Скриншот-эталоны сняты под chromium, поэтому запускать с --ignore-snapshots
 * либо ограничивать grep-ом до тестов без скриншотов.
 */
export default defineConfig({
    ...base,
    reporter: 'line',
    projects: [
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        // msedge требует установленного Edge, на windows-раннере он есть из коробки
        {
            name: 'msedge',
            use: { ...devices['Desktop Edge'], channel: 'msedge' },
        },
        { name: 'mobile-safari', use: { ...devices['iPhone 12'] } },
        { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    ],
});
