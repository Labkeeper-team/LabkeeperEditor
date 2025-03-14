import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pEnv = process.env as any;
  return {
    plugins: [react(), svgr()],
    define: {
      __BACKEND__URL_: 1,
      BACKEND_URL: pEnv.BACKEND_URL
        ? JSON.stringify(pEnv.BACKEND_URL)
        : JSON.stringify(env.BACKEND_URL),
      BROADWAY: pEnv.BROADWAY
        ? JSON.stringify(pEnv.BROADWAY)
        : JSON.stringify(env.BROADWAY),
      CLIENT_ID: pEnv.AUTH_CLIENT_ID
        ? JSON.stringify(pEnv.AUTH_CLIENT_ID)
        : JSON.stringify(env.AUTH_CLIENT_ID),
      REDICRECT_URL: pEnv.REDICRECT_URL
        ? JSON.stringify(pEnv.REDICRECT_URL)
        : JSON.stringify(env.REDICRECT_URL),
    },
    server: {
      port: 3000,
    },
  };
});
