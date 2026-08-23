import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { viteStaticCopy } from 'vite-plugin-static-copy';

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

export default defineConfig(() => {
    const { major, minor } = resolveBuildVersion();

    return {
        plugins: [
            react(),
            svgr(),
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
        resolve: {
            dedupe: ['react', 'react-dom'],
        },
        server: {
            port: 3000,
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
