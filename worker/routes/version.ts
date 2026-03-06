import type { Context } from 'hono';
import type { Env } from '../index';

export async function versionRoute(c: Context<{ Bindings: Env }>) {
    return c.json({
        worker: 'gasoia-worker',
        commit: c.env.GIT_SHA || 'unknown',
        builtAt: c.env.BUILD_TIME || new Date().toISOString(),
        env: 'production'
    }, 200, {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
    });
}
