<div align="center">

<img src="src/view/assets/logo.svg" alt="Labkeeper" width="96" height="96" />

# Labkeeper

**Online LaTeX editor with a built-in scientific calculator**

Write and compile LaTeX in the browser, mix in calculations and plots, and export the result to PDF.

[labkeeper.io](https://labkeeper.io)

[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)

[![Redux](https://img.shields.io/badge/Redux_Toolkit-2-764ABC?style=for-the-badge&logo=redux&logoColor=white)](https://redux-toolkit.js.org/)
[![React Router](https://img.shields.io/badge/React_Router-7-CA4245?style=for-the-badge&logo=reactrouter&logoColor=white)](https://reactrouter.com/)
[![Sass](https://img.shields.io/badge/Sass-embedded-CC6699?style=for-the-badge&logo=sass&logoColor=white)](https://sass-lang.com/)
[![CodeMirror](https://img.shields.io/badge/CodeMirror-6-D3072A?style=for-the-badge&logo=codemirror&logoColor=white)](https://codemirror.net/)

[![Jest](https://img.shields.io/badge/Jest-30-C21325?style=for-the-badge&logo=jest&logoColor=white)](https://jestjs.io/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
[![ESLint](https://img.shields.io/badge/ESLint-10-4B32C3?style=for-the-badge&logo=eslint&logoColor=white)](https://eslint.org/)
[![Prettier](https://img.shields.io/badge/Prettier-3-F7B93E?style=for-the-badge&logo=prettier&logoColor=black)](https://prettier.io/)

[![Docker](https://img.shields.io/badge/Docker-Nginx_proxy-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Sentry](https://img.shields.io/badge/Sentry-React-362D59?style=for-the-badge&logo=sentry&logoColor=white)](https://sentry.io/)
[![ECharts](https://img.shields.io/badge/Apache_ECharts-6-AA344D?style=for-the-badge&logo=apacheecharts&logoColor=white)](https://echarts.apache.org/)
[![MathJax](https://img.shields.io/badge/MathJax-4-000000?style=for-the-badge&logo=latex&logoColor=white)](https://www.mathjax.org/)

</div>

## About

This repository is the **Labkeeper** web frontend: an online **LaTeX editor** with a scientific calculator and PDF export.

The core workflow is writing LaTeX (full TeX Live compilation on the backend). You can also drop in computational blocks, formulas, tables, and plots, then compile the document to PDF. Typical building blocks:

- **LaTeX** as the primary authoring mode, with full document compilation
- **Markdown** segments when you need lighter markup alongside LaTeX
- **Computational** segments for assignments, formulas, and error propagation
- **Plots** (line, scatter, histogram) via Apache ECharts
- **AsciiMath** for a lighter math notation
- File manager, AI hunk review, OAuth2, token billing, and PDF export

The UI talks to the Labkeeper backend over `/api`. For local work against the release backend, an Nginx container proxies that path while Vite serves the app.

## Tech stack

| Area            | Tools                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Runtime         | Node.js **22** (see `.nvmrc`)                                                                  |
| UI              | React **19**, TypeScript **6**, Vite **8**, Sass                                               |
| State & routing | Redux Toolkit, React Redux, Redux Persist, React Router **7**                                  |
| Editor          | CodeMirror **6** (incl. LaTeX language support)                                                |
| Math & docs     | MathJax, AsciiMath, `react-markdown`, PDF.js, jsPDF                                            |
| Charts          | Apache ECharts                                                                                 |
| HTTP & quality  | Axios, Sentry, ESLint, Prettier, Husky, lint-staged                                            |
| Tests           | Jest + Testing Library, Playwright                                                             |
| Local proxy     | Docker Compose, Nginx                                                                          |

## Prerequisites

- [Node.js](https://nodejs.org/) **22.13+** (matches `.nvmrc`)
- npm
- [Docker](https://docs.docker.com/get-docker/) (needed to talk to the release backend via Nginx)

## Local development (frontend + release backend)

1. Install dependencies from the repo root:

    ```bash
    npm i
    ```

2. Start the Nginx reverse proxy (API → release backend, app → Vite):

    ```bash
    docker compose -f scripts/local/nginx/docker-compose.yml up
    ```

3. Start the Vite dev server from the repo root:

    ```bash
    npm run dev
    ```

4. Open [http://localhost](http://localhost). The app from this repo is served on port 80 through Nginx and can talk to the release server.

Do not commit local-only tweaks in `index.html` or `vite.config.ts`.

> **Playwright:** use `DEFAULT_MAJOR = '2'` in `vite.config.ts` when running E2E tests. Restore your local value afterwards. If you changed the Yandex SmartCaptcha site key in `index.html` for local use, revert that change before Playwright as well.

## Scripts

| Command                   | Description                                      |
| ------------------------- | ------------------------------------------------ |
| `npm run dev`             | Vite dev server (`--host`, port **3000**)        |
| `npm run build`           | Production build                                 |
| `npm run test:math`       | Unit tests (Jest)                                |
| `npm run test:ui`         | E2E tests (Playwright)                           |
| `npm run test:ui:silent`  | Playwright with the line reporter                |
| `npx playwright test --ui`| Playwright UI mode                               |
| `npm run check`           | ESLint + Prettier check                          |
| `npm run reformat`        | Prettier auto-format                             |

## Testing and lint

```bash
# Unit tests
npm run test:math

# E2E (retries help with flaky UI)
npx playwright test --retries=3

# E2E with the Playwright inspector
npx playwright test --ui

# Lint and format check
npm run check

# Auto-format
npm run reformat
```
