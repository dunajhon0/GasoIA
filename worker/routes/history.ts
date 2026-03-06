import type { Context } from 'hono';
import type { Env } from '../index';
import { getFuelHistory, getFuelStatsForKPIs } from '../lib/db';
import type { Fuel } from '../lib/db';

const FUEL_ALIASES: Record<string, string> = {
    'gasolina95': 'sp95',
    'gasolina_95': 'sp95',
    'gasolina-95': 'sp95',
    'sp95': 'sp95',
    'gasolina 95': 'sp95',
    'gasolina 95 e5': 'sp95',
    'gasolina 95 e10': 'sp95',
    'gasolina98': 'sp98',
    'gasolina_98': 'sp98',
    'gasolina 98 e5': 'sp98',
    'gasolina 98 e10': 'sp98',
    'sp98': 'sp98',
    'diesel': 'diesel_a',
    'gasoleoa': 'diesel_a',
    'gasoleo_a': 'diesel_a',
    'gasoleo a': 'diesel_a',
    'diesel_a': 'diesel_a',
    'diesela': 'diesel_a',
    'goa': 'diesel_a',
    'diesel_a_plus': 'diesel_a_plus',
    'diesel_plus': 'diesel_a_plus',
    'diesel a+': 'diesel_a_plus',
    'gasoleo a+': 'diesel_a_plus',
    'gasoleoa_plus': 'diesel_a_plus',
    'glp': 'glp',
    'gnc': 'gnc',
    'gnl': 'gnc',
    'diesel_b': 'diesel_b',
    'gasoleo b': 'diesel_b',
    'biodiesel': 'biodiesel'
};

const VALID_FUELS = Object.values(FUEL_ALIASES);
const ALL_FUELS = ['sp95', 'diesel_a', 'diesel_a_plus', 'sp98', 'glp', 'gnc'];

function normalizeFuel(f: string): string {
    const clean = f.toLowerCase().trim();
    return FUEL_ALIASES[clean] || clean;
}

export async function historyRoute(c: Context<{ Bindings: Env }>) {
    const rawFuel = c.req.query('fuel') ?? 'sp95';
    const fuelParam = normalizeFuel(rawFuel);
    const daysParam = parseInt(c.req.query('range') ?? c.req.query('days') ?? '30', 10);
    const days = isNaN(daysParam) ? 30 : daysParam;

    const fuelsToFetch = fuelParam.toUpperCase() === 'ALL'
        ? ALL_FUELS
        : FUEL_ALIASES[fuelParam] ? [FUEL_ALIASES[fuelParam]] : ['sp95'];

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
