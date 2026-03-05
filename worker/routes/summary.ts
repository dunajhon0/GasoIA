import type { Context } from 'hono';
import type { Env } from '../index';
import { getFuelAggregateForDate } from '../lib/db';
import { getToday, getYesterday } from '../lib/minetur';

export async function summaryRoute(c: Context<{ Bindings: Env }>) {
    const date = c.req.query('date') ?? getToday();
    const yesterday = getYesterday();

    const [todayData, yestData] = await Promise.all([
        getFuelAggregateForDate(c.env.DB, date, 'national'),
        getFuelAggregateForDate(c.env.DB, yesterday, 'national'),
    ]);

    const formatFuel = (fuel: 'sp95' | 'diesel_a') => {
        const t = todayData[fuel];
        const y = yestData[fuel];
        const todayPrice = t?.avg_price ?? null;
        const yestPrice = y?.avg_price ?? null;
        const delta = (todayPrice !== null && yestPrice !== null) ? +(todayPrice - yestPrice).toFixed(4) : null;
        const deltaPct = (delta !== null && yestPrice) ? +((delta / yestPrice) * 100).toFixed(2) : null;
        return { today: todayPrice, yesterday: yestPrice, delta, deltaPct, count: t?.count ?? 0 };
    };

    return c.json({
        date,
        updatedAt: new Date().toISOString(),
        sp95: formatFuel('sp95'),
        dieselA: formatFuel('diesel_a'),
    }, 200, {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    });
}
