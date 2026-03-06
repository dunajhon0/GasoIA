import type { Context } from 'hono';
import type { Env } from '../index';
import { getFuelAggregateForDate, getFuelHistory } from '../lib/db';
import { getToday, getYesterday } from '../lib/minetur';

export async function summaryRoute(c: Context<{ Bindings: Env }>) {
    const date = c.req.query('date') ?? getToday();
    const yesterday = getYesterday();

    const [todayData, yestData, sp95History, dieselAHistory] = await Promise.all([
        getFuelAggregateForDate(c.env.DB, date, 'national'),
        getFuelAggregateForDate(c.env.DB, yesterday, 'national'),
        getFuelHistory(c.env.DB, 'sp95', 15),
        getFuelHistory(c.env.DB, 'diesel_a', 15)
    ]);

    const formatFuel = (fuel: 'sp95' | 'diesel_a', history: any[]) => {
        const t = todayData[fuel];
        const y = yestData[fuel];
        const todayPrice = t?.avg_price ?? null;
        const yestPrice = y?.avg_price ?? null;
        const delta = (todayPrice !== null && yestPrice !== null) ? +(todayPrice - yestPrice).toFixed(4) : null;
        const deltaPct = (delta !== null && yestPrice) ? +((delta / yestPrice) * 100).toFixed(2) : null;

        // Reverse history to get oldest -> newest
        const sparkline = history.map(h => h.avg_price).filter(p => p !== null).reverse();

        return {
            today: todayPrice,
            yesterday: yestPrice,
            delta,
            deltaPct,
            count: t?.count ?? 0,
            sparkline
        };
    };

    return c.json({
        date,
        v: '3.1.0', // Debug marker to verify deployment
        updatedAt: new Date().toISOString(),
        sp95: formatFuel('sp95', sp95History),
        dieselA: formatFuel('diesel_a', dieselAHistory),
    }, 200, {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=600',
    });
}
