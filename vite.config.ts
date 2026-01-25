import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig(({ mode }) => {
    const DEFAULT_MAJOR = '4';
    const DEFAULT_MINOR = '';
    const revision = mode as string;
    let major = DEFAULT_MAJOR;
    let minor = DEFAULT_MINOR;
    if (revision && revision.includes('.')) {
        try {
            const divs: string[] = revision.split('.');
            major = divs[0];
            minor = divs.slice(1).join('.');
        } catch {
            major = DEFAULT_MAJOR;
            minor = DEFAULT_MINOR;
        }
    }
    return {
        plugins: [react(), svgr()],
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
