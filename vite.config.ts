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
        plugins: [
            react(),
            svgr(),
            {
                name: 'cookie-debug',
                configureServer(server) {
                    console.log('🍪 Cookie debug plugin loaded');
                },
            },
        ],
        server: {
            port: 3000,
            host: '0.0.0.0',
            cors: true,

            proxy: {
                '/api': {
                    target: 'https://labkeeper.io',
                    changeOrigin: true,
                    secure: false, // т.к. self-signed

                    configure: (proxy, options) => {
                        console.log('🎯 Proxy target:', options.target);

                        proxy.on('proxyReq', (proxyReq, req, res) => {
                            console.log(`🚀 REQ: ${req.method} ${req.url}`);
                            // Логируем отправляемые куки
                            if (req.headers.cookie) {
                                console.log(
                                    '📤 Sending cookies:',
                                    req.headers.cookie
                                );
                            }
                        });

                        proxy.on('proxyRes', (proxyRes, req, res) => {
                            console.log(
                                `📨 RES: ${proxyRes.statusCode} ${req.url}`
                            );

                            const cookies = proxyRes.headers['set-cookie'];
                            if (cookies) {
                                console.log('🔍 Original cookies:', cookies);

                                const modifiedCookies = cookies.map(
                                    (cookie) => {
                                        console.log(
                                            'Processing cookie:',
                                            cookie
                                        );

                                        // 1. Убираем Domain если есть
                                        let newCookie = cookie.replace(
                                            /Domain=[^;]+(;|$)/gi,
                                            ''
                                        );

                                        // 2. Меняем SameSite=Lax на SameSite=None
                                        newCookie = newCookie.replace(
                                            /SameSite=Lax/gi,
                                            'SameSite=None'
                                        );

                                        // 3. Если нет SameSite, добавляем
                                        if (!newCookie.includes('SameSite=')) {
                                            newCookie += '; SameSite=None';
                                        }

                                        // 4. Добавляем Secure флаг (даже для localhost)
                                        if (!newCookie.includes('Secure')) {
                                            newCookie += '; Secure';
                                        }

                                        // 5. Убедимся что Path=/
                                        if (!newCookie.includes('Path=')) {
                                            newCookie += '; Path=/';
                                        }

                                        // 6. Для localhost нельзя указывать Domain
                                        // Но можно оставить без Domain

                                        console.log(
                                            '✅ Modified cookie:',
                                            newCookie
                                        );
                                        return newCookie;
                                    }
                                );

                                proxyRes.headers['set-cookie'] =
                                    modifiedCookies;
                                console.log(
                                    '🎯 Final cookies:',
                                    modifiedCookies
                                );
                            } else {
                                console.log('❌ No Set-Cookie headers');
                            }
                        });

                        proxy.on('error', (err) => {
                            console.error('❌ Proxy error:', err);
                        });
                    },
                },
            },
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
