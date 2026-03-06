import type { Context } from 'hono';
import type { Env } from '../index';
import { getFuelHistory, getFuelStatsForKPIs } from '../lib/db';
import type { Fuel } from '../lib/db';

import { normalizeFuel, FUEL_MAP } from '../lib/fuels';
import { backfillMissingHistory } from '../lib/backfill';

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

    let maxPoints = 0;

    for (const f of fuelsToFetch) {
        const rows = await getFuelHistory(c.env.DB, f, days);
        console.log(`[HistoryAPI] Fuel ${f}: ${rows.length} points found`);
        if (rows.length > maxPoints) {
            maxPoints = rows.length;
        }

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

    let backfillScheduled = false;

    // If we have sparse data (less than 2 points), we trigger a background backfill
    // to silently fetch the missing data for the user.
    if (maxPoints < 2) {
        console.log(`[HistoryAPI] Sparse data detected (${maxPoints} points). Scheduling background backfill...`);
        c.executionCtx.waitUntil(backfillMissingHistory(c.env.DB, { targetDays: days, maxDaysPerRun: 2 }));
        backfillScheduled = true;
    }

    return c.json({
        ok: true,
        fuel: fuelKey || rawFuel,
        rangeDays: days,
        fuels: fuelsToFetch,
        insufficient: maxPoints === 0,
        singlePoint: maxPoints === 1,
        backfillScheduled,
        series,
        stats,
        generatedAt: new Date().toISOString()
    }, 200, {
        // Reduced cache time so polling clients can pick up new backfill data faster
        'Cache-Control': 'public, max-age=15, stale-while-revalidate=60',
    });
}
