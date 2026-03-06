import type { Context } from 'hono';
import type { Env } from '../index';
import { fetchMineturHistoricalData, calcAvg, calcMin, calcMax } from '../lib/minetur';
import { upsertDailyFuelStat } from '../lib/db';

const FUEL_FIELDS = [
    { db: 'sp95', field: 'sp95' },
    { db: 'diesel_a', field: 'dieselA' },
    { db: 'sp98', field: 'sp98' },
    { db: 'diesel_a_plus', field: 'dieselAPlus' },
    { db: 'glp', field: 'glp' },
    { db: 'gnc', field: 'gnc' },
];

export async function rebuildHistoryRoute(c: Context<{ Bindings: Env }>) {
    const authHeader = c.req.header('Authorization');
    const token = c.req.query('token') || authHeader?.replace('Bearer ', '');

    // In production, set ADMIN_TOKEN in wrangler.toml or dashboard
    const expectedToken = c.env.ADMIN_TOKEN || 'dev-secret-123';

    if (token !== expectedToken) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const daysRequested = parseInt(c.req.query('days') || '15');
    const results = {
        ok: true,
        requestedDays: daysRequested,
        processedDays: 0,
        inserted: 0,
        skipped: 0,
        errors: [] as string[]
    };

    const today = new Date();

    for (let i = 1; i <= daysRequested; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateIso = d.toISOString().slice(0, 10);

        try {
            // Check if we already have data for this day (simulated by sp95 check)
            const existing = await c.env.DB.prepare(
                `SELECT day FROM daily_fuel_stats WHERE day = ? AND fuel = 'sp95' LIMIT 1`
            ).bind(dateIso).first();

            if (existing) {
                results.skipped++;
                continue;
            }

            console.log(`[Admin] Rebuilding history for ${dateIso}...`);
            const stations = await fetchMineturHistoricalData(dateIso);

            if (stations.length === 0) {
                results.skipped++;
                continue;
            }

            for (const { db: fuelDb, field } of FUEL_FIELDS) {
                const vals = stations.map(s => (s.prices as any)[field] as number | null);
                const avg = calcAvg(vals);
                if (avg === null) continue;

                await upsertDailyFuelStat(c.env.DB, {
                    day: dateIso,
                    fuel: fuelDb,
                    avg_price: avg,
                    min_price: calcMin(vals),
                    max_price: calcMax(vals),
                    sample_count: vals.filter(v => v !== null && v > 0).length
                });
            }

            results.inserted++;
            results.processedDays++;
        } catch (e) {
            console.error(`Error processing ${dateIso}:`, e);
            results.errors.push(`${dateIso}: ${(e as Error).message}`);
        }
    }

    return c.json(results);
}
