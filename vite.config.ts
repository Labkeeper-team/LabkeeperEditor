import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig(({ mode }) => {
    const DEFAULT = 'unknown';
    const revision = mode as string;
    let major = DEFAULT;
    let minor = DEFAULT;
    if (revision) {
        try {
            const divs: string[] = revision.split('.');
            major = divs[0];
            minor = divs.slice(1).join('.');
        } catch {
            // ignored
        }
    }
    return {
        plugins: [react(), svgr()],
        server: {
            port: 3000,
        },
        define: {
            __BUILD_INFO__: JSON.stringify({ major: major, minor: minor }),
        },
    };
});
