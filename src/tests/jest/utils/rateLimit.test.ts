import { createRateLimiter } from '../../../viewModel/utils/rateLimit.ts';

test('пропускает не больше лимита за окно', () => {
    const allow = createRateLimiter(3, 60_000, () => 0);

    expect([allow(), allow(), allow(), allow()]).toEqual([
        true,
        true,
        true,
        false,
    ]);
});

test('окно скользит: место освобождается, когда старое событие выходит из минуты', () => {
    let now = 0;
    const allow = createRateLimiter(3, 60_000, () => now);
    allow();
    now = 20_000;
    allow();
    now = 40_000;
    allow();

    now = 59_999;
    expect(allow()).toBe(false);
    // первое событие ушло из окна, второе и третье ещё в нём
    now = 60_000;
    expect(allow()).toBe(true);
    expect(allow()).toBe(false);
    now = 80_000;
    expect(allow()).toBe(true);
});

test('отклонённые попытки окно не занимают', () => {
    let now = 0;
    const allow = createRateLimiter(1, 1000, () => now);
    allow();
    now = 900;
    expect(allow()).toBe(false);

    // отказ в 900 не отодвинул конец окна
    now = 1000;
    expect(allow()).toBe(true);
});
