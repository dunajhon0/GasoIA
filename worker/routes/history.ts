import type { Context } from 'hono';
import type { Env } from '../index';
import { getFuelHistory } from '../lib/db';
import type { Fuel } from '../lib/db';

const VALID_FUELS: Fuel[] = ['sp95', 'sp98', 'diesel_a', 'diesel_a_plus', 'diesel_b', 'diesel_c', 'biodiesel', 'glp', 'gnc'];
const VALID_DAYS = [30, 90, 180, 365];

export async function historyRoute(c: Context<{ Bindings: Env }>) {
    const fuelParam = (c.req.query('fuel') ?? 'sp95') as Fuel;
    const daysParam = parseInt(c.req.query('days') ?? '90', 10);

    const fuel = VALID_FUELS.includes(fuelParam) ? fuelParam : 'sp95';
    const days = VALID_DAYS.includes(daysParam) ? daysParam : 90;

    const rows = await getFuelHistory(c.env.DB, fuel, days);
    // Sort ascending for chart
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));

    return c.json({
        fuel,
        days,
        series: sorted.map(r => ({ date: r.date, price: r.avg_price })),
    }, 200, {
        'Cache-Control': 'public, max-age=3600',
    });
}
