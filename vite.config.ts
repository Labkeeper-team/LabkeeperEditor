import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { lowerClassStaticBlocks } from './scripts/vite/lowerClassStaticBlocks.ts';
import { guardRegexLookbehind } from './scripts/vite/guardRegexLookbehind.ts';

const DEFAULT_MAJOR = '4';
const DEFAULT_MINOR = '';

function readCliArg(name: string): string | undefined {
    const prefix = `${name}=`;
    const withEquals = process.argv.find((arg) => arg.startsWith(prefix));
    if (withEquals) {
        return withEquals.slice(prefix.length);
    }

    const index = process.argv.indexOf(name);
    if (index !== -1) {
        return process.argv[index + 1];
    }

    return undefined;
}

function resolveBuildVersion(): { major: string; minor: string } {
    const revision = readCliArg('--build-version')?.trim() || '';

    let major = DEFAULT_MAJOR;
    let minor = DEFAULT_MINOR;

    if (revision && revision.includes('.')) {
        const parts = revision.split('.');
        major = parts[0] || DEFAULT_MAJOR;
        minor = parts.slice(1).join('.') || DEFAULT_MINOR;
    }

    return { major, minor };
}

/**
 * Dev server without LABKEEPER_DEV_PROXY has no backend: API WebSocket upgrades are closed
 * at once. Otherwise they hang, and the editor waits for the collaboration session.
 */
function failApiSocketsWithoutBackend(proxyTarget: string | undefined): Plugin {
    return {
        name: 'fail-api-sockets-without-backend',
        apply: 'serve',
        configureServer(server) {
            if (proxyTarget) {
                return;
            }
            server.httpServer?.on('upgrade', (request, socket) => {
                if (request.url?.startsWith('/api/')) {
                    socket.destroy();
                }
            });
        },
    };
}

export default defineConfig(() => {
    const { major, minor } = resolveBuildVersion();
    const devProxyTarget = process.env.LABKEEPER_DEV_PROXY;

    return {
        plugins: [
            react(),
            svgr(),
            lowerClassStaticBlocks(),
            guardRegexLookbehind(),
            failApiSocketsWithoutBackend(devProxyTarget),
            viteStaticCopy({
                targets: [
                    {
                        src: 'node_modules/mathjax/es5/**/*',
                        dest: 'mathjax',
                        rename: { stripBase: 3 },
                    },
                ],
            }),
        ],
        // воркер pdf.js собирается отдельно, и старым браузерам нужно то же самое
        worker: {
            plugins: () => [lowerClassStaticBlocks(), guardRegexLookbehind()],
        },
        resolve: {
            dedupe: ['react', 'react-dom'],
        },
        optimizeDeps: {
            // эти пакеты нужны только воркерам, их сканер Vite не видит, и первый запуск воркера на холодном сервере перезагружал все открытые страницы
            include: ['nspell', 'pdfjs-dist/legacy/build/pdf.worker.min.mjs'],
        },
        server: {
            port: 3000,
            // optional: LABKEEPER_DEV_PROXY=http://localhost:8080 sends /api (REST and the
            // agent and collaboration WebSockets) to a local server, without the nginx proxy
            ...(devProxyTarget
                ? {
                      proxy: {
                          '/api': {
                              target: devProxyTarget,
                              changeOrigin: true,
                              ws: true,
                          },
                      },
                  }
                : {}),
        },
        define: {
            __BUILD_INFO__: JSON.stringify({ major, minor }),
        },
        css: {
            preprocessorOptions: {
                scss: {
                    api: 'modern-compiler',
                },
            },
        },
    };
});
