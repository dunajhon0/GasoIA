import type { Context } from 'hono';
import type { Env } from '../index';
import { getFuelHistory, getFuelStatsForKPIs } from '../lib/db';
import type { Fuel } from '../lib/db';

import { normalizeFuel, FUEL_MAP } from '../lib/fuels';

export async function historyRoute(c: Context<{ Bindings: Env }>) {
    const rawFuel = c.req.query('fuel') || 'sp95';
    const fuelKey = normalizeFuel(rawFuel);
    const daysParam = parseInt(c.req.query('range') || c.req.query('days') || '30', 10);
    const days = isNaN(daysParam) ? 30 : daysParam;

    const isAll = rawFuel.toLowerCase() === 'all';
    const fuelsToFetch = isAll
        ? (Object.keys(FUEL_MAP) as (keyof typeof FUEL_MAP)[])
        : fuelKey ? [fuelKey] : ['sp95' as const];

    const series: Record<string, any[]> = {};
    const stats: Record<string, any> = {};

    console.log(`[HistoryAPI] Fetching ${isAll ? 'ALL' : fuelsToFetch.join(', ')} for ${days} days`);

    for (const f of fuelsToFetch) {
        const rows = await getFuelHistory(c.env.DB, f, days);
        console.log(`[HistoryAPI] Fuel ${f}: ${rows.length} points found`);
        // Sort ascending for chart
        series[f] = [...rows].reverse().map(r => ({
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
