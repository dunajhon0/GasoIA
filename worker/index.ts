/**
 * Worker entry point — Hono router with all API routes + cron trigger
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { cache } from 'hono/cache';
import type { D1Database, ExecutionContext, ScheduledEvent } from '@cloudflare/workers-types';
import { runCron } from './cron';
import { summaryRoute } from './routes/summary';
import { historyRoute } from './routes/history';
import { citiesRoute } from './routes/cities';
import { fuelsRoute } from './routes/fuels';
import { stationsRoute } from './routes/stations';
import { brandsRoute } from './routes/brands';

export interface Env {
    DB: D1Database;
    ADSENSE_PUBLISHER_ID: string;
    SITE_URL: string;
}

const app = new Hono<{ Bindings: Env }>();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use('/*', cors({
    origin: ['https://gasoia.com', 'https://gasoia.dunajhon.com', 'http://localhost:4321', 'http://localhost:8788'],
    allowMethods: ['GET', 'OPTIONS'],
}));

// Rate limit: simple KV-based (or just rely on CF's built-in)
app.use('/*', async (c, next) => {
    const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';
    // Simple header check — actual rate limit via Cloudflare Rules in production
    c.header('X-RateLimit-Limit', '120');
    await next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.get('/summary', summaryRoute);
app.get('/history', historyRoute);
app.get('/cities/top10', citiesRoute);
app.get('/fuels/table', fuelsRoute);
app.get('/stations/search', stationsRoute);
app.get('/brands', brandsRoute);

// Health check
app.get('/health', (c) => c.json({ status: 'ok', ts: new Date().toISOString() }));

// 404 fallback for API
app.notFound((c) => c.json({ error: 'Not Found' }, 404));

// ─── Export ───────────────────────────────────────────────────────────────────
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext) {
        const url = new URL(request.url);
        if (url.pathname === "/api") url.pathname = "/";
        if (url.pathname.startsWith("/api/")) {
            url.pathname = url.pathname.slice("/api".length);
            request = new Request(url.toString(), request);
        }
        return app.fetch(request, env, ctx);
    },
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
        ctx.waitUntil(runCron(env.DB));
    },
};
