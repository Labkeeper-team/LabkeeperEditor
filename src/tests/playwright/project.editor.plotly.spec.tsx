import { test, expect } from '@playwright/test';

async function plotlyTest(statement, page) {
    // Перехватываем запрос user-info
    await page.route('/user-info', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                isAuthenticated: false,
                email: null,
                id: null
            })
        });
    });

    await page.goto('/');

    // Ждем загрузки страницы
    await page.waitForLoadState('networkidle');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL('/project/default');

    // Добавляем код
    await page.getByRole('button', {name: /Добавить код/i}).first().click();
    const editor = page.locator('.cm-content').nth(0);
    await editor.click();
    await editor.fill("a = 10");
    await editor.click();

    // Перехватываем запрос на компиляцию
    await page.route('/api/v2/public/compile', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                "segments":[
                    {
                        "id": 0,
                        "type": "computational",
                        "statements": [
                            statement
                        ]
                    }
                ]
            })
        });
    });

    // компилируем
    await page.getByRole('button', {name: /Выполнить/i}).click();

    // ждем, когда кнопка снова станет нажимаемой
    await page.getByRole('button', { name: /Выполнить/i }).waitFor({state: "attached"})
}

async function plotlyTestWithSingleCurve(curve, page) {
    await plotlyTest({
        "type": "plot",
        "plotName": "MyTitle",
        "plotXAxisName": "MyX",
        "plotYAxisName": "MyY",
        "plots": [
            curve
        ]
    }, page)
}

/*
Тест на рисование линий в plotly
 */
test('plotly-line', async ({ page }) => {
    await plotlyTestWithSingleCurve({
        x: [1, 2, 3, 4, 5],
        y: [1, 2, 1, 3, 1],
        type: "line",
        color: "red",
        name: "MyLine"
    }, page)

    await expect(page).toHaveScreenshot('plotly-line.png');
})

/*
Тест на рисование точек в plotly
 */
test('plotly-scatter', async ({ page }) => {
    await plotlyTestWithSingleCurve({
        x: [1, 2, 3, 4, 5],
        y: [1, 2, 1, 3, 1],
        type: "scatter",
        color: "blue",
        name: "MyLine"
    }, page)

    await expect(page).toHaveScreenshot('plotly-scatter.png');
})

/*
Тест на рисование гистограмм в plotly
 */
test('plotly-histogram', async ({ page }) => {
    await plotlyTest({
        "type": "plot",
        "plotName": "MyTitle",
        "plotXAxisName": "MyX",
        "plotYAxisName": "MyY",
        "plots": [
            {
                x: [1],
                y: [1],
                type: "histogram",
                color: "blue",
                name: "MyLine1"
            },
            {
                x: [2, 2],
                y: [1, 1],
                type: "histogram",
                color: "red",
                name: "MyLine2"
            },
            {
                x: [3, 3, 3],
                y: [1, 1, 1],
                type: "histogram",
                color: "green",
                name: "MyLine3"
            },
            {
                x: [4, 4, 4, 4],
                y: [1, 1, 1, 1],
                type: "histogram",
                color: "orange",
                name: "MyLine4"
            },
            {
                x: [5, 5, 5, 5, 5],
                y: [1, 1, 1, 1, 1],
                type: "histogram",
                color: "black",
                name: "MyLine5"
            }
        ]
    }, page)

    await expect(page).toHaveScreenshot('plotly-histogram.png');
})

/*
Тест на рисование гистограмм в plotly
 */
test('plotly-histogram-single', async ({ page }) => {
    var x = [];
    for (var i = 0; i < 500; i ++) {
        // @ts-ignore
        x.push(i * i / 500 / 500);
    }
    await plotlyTestWithSingleCurve({
                x: x,
                type: "histogram",
                color: "blue",
                name: "MyLine1"
            }, page)

    await expect(page).toHaveScreenshot('plotly-histogram-single.png');
})