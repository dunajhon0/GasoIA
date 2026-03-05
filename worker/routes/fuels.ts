import type { Context } from 'hono';
import type { Env } from '../index';
import { getFuelAggregateForDate, getHistoricalMinMax } from '../lib/db';
import type { Fuel, Scope } from '../lib/db';
import { getToday, getYesterday } from '../lib/minetur';

const FUEL_LIST: { key: Fuel; label: string }[] = [
    { key: 'sp95', label: 'Sin Plomo 95' },
    { key: 'sp98', label: 'Sin Plomo 98' },
    { key: 'diesel_a', label: 'Gasóleo A' },
    { key: 'diesel_a_plus', label: 'Gasóleo A+' },
    { key: 'diesel_b', label: 'Gasóleo B' },
    { key: 'diesel_c', label: 'Gasóleo C' },
    { key: 'biodiesel', label: 'Biodiésel' },
    { key: 'glp', label: 'Autogás / GLP' },
    { key: 'gnc', label: 'Gas Natural Comprimido' },
];

export async function fuelsRoute(c: Context<{ Bindings: Env }>) {
    const date = c.req.query('date') ?? getToday();
    const yesterday = getYesterday();
    const scope = (c.req.query('scope') ?? 'peninsula') as Scope;

    const [todayAgg, yesterdayAgg] = await Promise.all([
        getFuelAggregateForDate(c.env.DB, date, scope),
        getFuelAggregateForDate(c.env.DB, yesterday, scope),
    ]);

    const fuels = await Promise.all(FUEL_LIST.map(async ({ key, label }) => {
        const minmax = await getHistoricalMinMax(c.env.DB, key);
        return {
            key,
            label,
            today: todayAgg[key]?.avg_price ?? null,
            yesterday: yesterdayAgg[key]?.avg_price ?? null,
            minHist: minmax.min,
            minDate: minmax.min_date,
            maxHist: minmax.max,
            maxDate: minmax.max_date,
        };
    }));

    return c.json({ date, scope, fuels }, 200, {
        'Cache-Control': 'public, max-age=3600',
    });
}
