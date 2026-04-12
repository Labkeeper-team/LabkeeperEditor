## О Проекте

### Стек

NodeJS - v.20.11.1<br/>
React - v.18<br/>
Typescript<br/>

# Как локально запускать фронтенд с использованием релизного бекенда

1. Установить Docker
2. Выполнить ```npm i``` из корня репозитория
3. Зайти в файл ```index.html``` и заменить строку ```IO_LABKEEPER_FRONTEND_YANDEX_CAPTCHA_SITE_KEY``` на ```ysc1_hGTLsqtwdF4rdRDCezgRRJNM9St2o0vBCZOC97qMd63bcd7e```
4. Зайти в файле ```vite.config.ts``` и заменить строку ```const DEFAULT_MAJOR = '2';``` на ```const DEFAULT_MAJOR = '4';```
5. Важно, что коммитить изменения в этих файлах не нужно! Кроме того, для того, что запустить playwright тесты, нужно откатить шаг 3.
6. Выполнить команду из папки ```scripts/local/nginx```:

```bash
docker compose -f scripts/local/nginx/docker-compose.yml up
```

7. Выполнить команду ```npm run dev``` из корня репозитория
8. Теперь по ссылке [http://localhost](http://localhost) доступен фронтенд из этого репозитория, который может работать с релизным сервером.

### Тестирование и линтеры

1. E2E тесты: ```npx run playwright --retries=3```. Важно, что нужно вернуть ```const DEFAULT_MAJOR = '2';``` в файле ```vite.config.ts```.
2. E2E тесты с визуализацией ```npx run playwright --ui```
3. Юнит-тесты: ```npm run test:math```
4. Проверить линтеры ```npm run check```
5. Запустить автоматическое форматирование ```npm run reformat```
