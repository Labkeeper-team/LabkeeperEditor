import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig(({ mode }) => {
    return {
        plugins: [react(), svgr()],
        server: {
            port: 3000,
        },
        define: {
            __MODE__: JSON.stringify(mode),
        },
    };
});
