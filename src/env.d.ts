/// <reference path="../.astro/types.d.ts" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly SITE_URL: string;
    readonly ADSENSE_PUBLISHER_ID: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
