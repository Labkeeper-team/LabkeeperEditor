import { test, expect } from '@playwright/test';

async function plotlyTest(statement, page) {
    // Перехватываем запрос user-info
    await page.route('/api/v2/public/user-info', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                isAuthenticated: false,
                email: null,
                id: null,
            }),
        });
    });

    await page.goto('/');

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL('/project/default');

    // Добавляем код
    await page.locator('div.labkeeper_select.computation').first().click();
    await page.locator('li').first().click();
    const editor = page.locator('.cm-content').nth(0);
    await editor.click();
    await editor.fill('a = 10');
    await editor.click();

    // Перехватываем запрос на компиляцию
    await page.route('/api/v2/public/compile', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                segments: [
                    {
                        id: 0,
                        type: 'computational',
                        statements: [statement],
                    },
                ],
            }),
        });
    });

    // компилируем
    await page.getByRole('button', { name: /Run/i }).click();

    // ждем, когда кнопка снова станет нажимаемой
    await page
        .getByRole('button', { name: /Run/i })
        .waitFor({ state: 'attached' });
}

async function plotlyTestWithSingleCurve(curve, page) {
    await plotlyTest(
        {
            type: 'plot',
            plotName: 'MyTitle',
            plotXAxisName: 'MyX',
            plotYAxisName: 'MyY',
            legendVisible: true,
            plots: [curve],
        },
        page
    );
}

/*
Тест на рисование линий в plotly
 */
test('plotly-line', async ({ page }) => {
    await plotlyTestWithSingleCurve(
        {
            x: [1, 2, 3, 4, 5],
            y: [1, 2, 1, 3, 1],
            type: 'line',
            color: 'red',
            name: 'MyLine',
            xInfl: [],
            yInfl: [],
        },
        page
    );

    await expect(page).toHaveScreenshot('plotly-line.png');
});

/*
Тест на рисование пунктирной линий в plotly
 */
test('plotly-dotted', async ({ page }) => {
    await plotlyTestWithSingleCurve(
        {
            x: [1, 2, 3, 4, 5],
            y: [1, 2, 1, 3, 1],
            type: 'dotted',
            color: 'red',
            name: 'MyLine',
            xInfl: [],
            yInfl: [],
        },
        page
    );

    await expect(page).toHaveScreenshot('plotly-dotted.png');
});

/*
Тест на рисование точек в plotly
 */
test('plotly-scatter', async ({ page }) => {
    await plotlyTestWithSingleCurve(
        {
            x: [1, 2, 3, 4, 5],
            y: [1, 2, 1, 3, 1],
            type: 'scatter',
            color: 'blue',
            name: 'MyLine',
            xInfl: [],
            yInfl: [],
        },
        page
    );

    await expect(page).toHaveScreenshot('plotly-scatter.png');
});

/*
Тест на рисование точек в plotly
 */
test('plotly-with-grid', async ({ page }) => {
    await plotlyTest(
        {
            type: 'plot',
            plotName: 'MyTitle',
            plotXAxisName: 'MyX',
            plotYAxisName: 'MyY',
            legendVisible: true,
            plotGridVisible: true,
            plots: [
                {
                    x: [1, 2, 3, 4, 5],
                    y: [1, 2, 1, 3, 1],
                    type: 'line',
                    color: 'blue',
                    name: 'MyLine',
                    xInfl: [],
                    yInfl: [],
                },
            ],
        },
        page
    );

    await expect(page).toHaveScreenshot('plotly-with-grid.png');
});

/*
Тест на рисование mathjax через es-chart
 */
test('plotly-with-matjax', async ({ page }) => {
    await plotlyTest(
        {
            type: 'plot',
            plotName: '\\int f(x) dx\\:интегралы,\\:integrals',
            plotXAxisName: 'MyX',
            plotYAxisName: 'MyY',
            legendVisible: true,
            plotGridVisible: true,
            plots: [
                {
                    x: [1, 2, 3, 4, 5],
                    y: [1, 2, 1, 3, 1],
                    type: 'line',
                    color: 'blue',
                    name: 'MyLine',
                    xInfl: [],
                    yInfl: [],
                },
            ],
        },
        page
    );

    await expect(page).toHaveScreenshot('plotly-with-mathjax.png');
});

/*
Тест на рисование mathjax через es-chart
 */
test('plotly-with-matjax-longvalues', async ({ page }) => {
    await plotlyTest(
        {
            type: 'plot',
            plotName: '\\int f(x) dx\\:интегралы,\\:integrals',
            plotXAxisName: 'MyX',
            plotYAxisName: 'MyY',
            legendVisible: true,
            plotGridVisible: true,
            plots: [
                {
                    x: [1, 2, 3, 4, 5],
                    y: [1, 2, 1, 3, 1],
                    type: 'line',
                    color: 'blue',
                    name: '\\intG very long text with vveeery long values',
                    xInfl: [],
                    yInfl: [],
                },
                {
                    x: [1, 2, 3, 4, 5],
                    y: [1, 2, 1, 3, 2],
                    type: 'line',
                    color: 'red',
                    name: '\\intG very long text with vveeery long values 2',
                    xInfl: [],
                    yInfl: [],
                },
            ],
        },
        page
    );

    await expect(page).toHaveScreenshot('plotly-with-mathjax-longvalues.png');
});

/*
Тест на рисование гистограмм в plotly
 */
test('plotly-histogram', async ({ page }) => {
    await plotlyTest(
        {
            type: 'plot',
            plotName: 'MyTitle',
            plotXAxisName: 'MyX',
            plotYAxisName: 'MyY',
            legendVisible: false,
            plots: [
                {
                    x: [1],
                    y: [1],
                    type: 'histogram',
                    color: 'blue',
                    name: 'MyLine1',
                    xInfl: [],
                    yInfl: [],
                },
                {
                    x: [2, 2],
                    y: [1, 1],
                    type: 'histogram',
                    color: 'red',
                    name: 'MyLine2',
                    xInfl: [],
                    yInfl: [],
                },
                {
                    x: [3, 3, 3],
                    y: [1, 1, 1],
                    type: 'histogram',
                    color: 'green',
                    name: 'MyLine3',
                    xInfl: [],
                    yInfl: [],
                },
                {
                    x: [4, 4, 4, 4],
                    y: [1, 1, 1, 1],
                    type: 'histogram',
                    color: 'orange',
                    name: 'MyLine4',
                    xInfl: [],
                    yInfl: [],
                },
                {
                    x: [5, 5, 5, 5, 5],
                    y: [1, 1, 1, 1, 1],
                    type: 'histogram',
                    color: 'black',
                    name: 'MyLine5',
                    xInfl: [],
                    yInfl: [],
                },
            ],
        },
        page
    );

    await expect(page).toHaveScreenshot('plotly-histogram.png');
});

/*
Тест на рисование гистограмм в plotly
 */
test('plotly-histogram-single', async ({ page }) => {
    const x: Array<number> = [];
    for (let i = 0; i < 500; i++) {
        x.push((i * i) / 500 / 500);
    }
    await plotlyTestWithSingleCurve(
        {
            x: x,
            type: 'histogram',
            color: 'blue',
            name: 'MyLine1',
            xInfl: [],
            yInfl: [],
        },
        page
    );

    await expect(page).toHaveScreenshot('plotly-histogram-single.png');
});

test('plotly-histogram-two-dims-test', async ({ page }) => {
    await plotlyTestWithSingleCurve(
        {
            x: [1, 2, 3, 4, 5, 6],
            y: [5, 4, 3, 2, 1, 0],
            type: 'histogram',
            color: 'blue',
            name: 'MyLine1',
            xInfl: [],
            yInfl: [],
            size: 1,
        },
        page
    );

    await expect(page).toHaveScreenshot('plotly-histogram-two-dims.png');
});

test('plotly-histogram-simple-ladder-test', async ({ page }) => {
    await plotlyTestWithSingleCurve(
        {
            x: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            y: [],
            type: 'histogram',
            color: 'blue',
            name: 'MyLine1',
            size: 1,
            xInfl: [],
            yInfl: [],
        },
        page
    );

    await expect(page).toHaveScreenshot('plotly-histogram-simple-ladder.png');
});

/*
Тест на рисование погрешностей в plotly
 */
test('plotly-scatter-error', async ({ page }) => {
    await plotlyTestWithSingleCurve(
        {
            x: [1, 2, 3, 4, 5],
            y: [1, 2, 1, 3, 1],
            type: 'scatter',
            color: 'blue',
            name: 'MyLine',
            xInfl: [0.1, 0.1, 0.1, 0.1, 0.1],
            yInfl: [0.1, 0.1, 0.1, 0.1, 0.1],
        },
        page
    );

    await expect(page).toHaveScreenshot('plotly-scatter-error.png');
});
