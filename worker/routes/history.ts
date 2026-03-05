import type { Context } from 'hono';
import type { Env } from '../index';
import { getFuelHistory, getFuelStatsForKPIs } from '../lib/db';
import type { Fuel } from '../lib/db';

const VALID_FUELS: string[] = ['sp95', 'sp98', 'diesel_a', 'diesel_a_plus', 'diesel_b', 'diesel_c', 'biodiesel', 'glp', 'gnc'];
const ALL_FUELS = ['sp95', 'diesel_a', 'diesel_a_plus', 'sp98', 'glp']; // Principal ones or all if preferred

export async function historyRoute(c: Context<{ Bindings: Env }>) {
    const fuelParam = c.req.query('fuel') ?? 'sp95';
    const daysParam = parseInt(c.req.query('range') ?? c.req.query('days') ?? '30', 10);
    const days = isNaN(daysParam) ? 30 : daysParam;

    const fuelsToFetch = fuelParam.toUpperCase() === 'ALL'
        ? ALL_FUELS
        : VALID_FUELS.includes(fuelParam) ? [fuelParam] : ['sp95'];

    const series: Record<string, any[]> = {};
    const stats: Record<string, any> = {};

    for (const f of fuelsToFetch) {
        const rows = await getFuelHistory(c.env.DB, f, days);
        // Sort ascending for chart
        series[f] = rows.reverse().map(r => ({
            day: r.day,
            avg: r.avg_price,
            min: r.min_price,
            max: r.max_price,
            count: r.sample_count
        }));

        stats[f] = await getFuelStatsForKPIs(c.env.DB, f);
    }

    return c.json({
        rangeDays: days,
        fuels: fuelsToFetch,
        series,
        stats,
        generatedAt: new Date().toISOString()
    }, 200, {
        'Cache-Control': 'public, max-age=3600',
    });
}
