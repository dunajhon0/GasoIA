import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
    output: 'hybrid',
    adapter: cloudflare({
        platformProxy: {
            enabled: true,
        },
    }),
    integrations: [
        react(),
        tailwind({
            applyBaseStyles: false,
        }),
    ],
    vite: {
        ssr: {
            external: ['node:buffer', 'node:path', 'node:crypto'],
        },
    },
});
