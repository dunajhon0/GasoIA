import type { Context } from 'hono';
import type { Env } from '../index';
import { getCityAggregatesByNames, searchCityAggregates } from '../lib/db';
import { getToday } from '../lib/minetur';

const HOME_CITIES = [
    'MADRID', 'BARCELONA', 'VALENCIA', 'SEVILLA', 'ZARAGOZA',
    'MÁLAGA', 'MURCIA', 'PALMA', 'BILBAO', 'ALICANTE/ALACANT',
];

const CITY_DISPLAY: Record<string, string> = {
    'MADRID': 'Madrid',
    'BARCELONA': 'Barcelona',
    'VALENCIA': 'Valencia',
    'SEVILLA': 'Sevilla',
    'ZARAGOZA': 'Zaragoza',
    'MÁLAGA': 'Málaga',
    'MURCIA': 'Murcia',
    'PALMA': 'Palma',
    'BILBAO': 'Bilbao',
    'ALICANTE/ALACANT': 'Alicante',
};

/**
 * GET /api/cities
 * Supports q, sort, order, limit, offset
 */
export async function citiesRoute(c: Context<{ Bindings: Env }>) {
    const date = c.req.query('date') ?? getToday();
    const q = c.req.query('q') ?? '';
    const sort = c.req.query('sort') ?? 'sp95_avg';
    const order = (c.req.query('order') ?? 'asc') as 'asc' | 'desc';
    const limit = parseInt(c.req.query('limit') ?? '50', 10);
    const offset = parseInt(c.req.query('offset') ?? '0', 10);

    const { items, total } = await searchCityAggregates(c.env.DB, date, { q, sort, order, limit, offset });

    const result = items.map(r => ({
        city: CITY_DISPLAY[r.city] ?? r.city,
        province: r.province,
        sp95: r.sp95_avg,
        dieselA: r.diesel_a_avg,
        stationCount: r.station_count,
    }));

    return c.json({ total, date, items: result }, 200, {
        'Cache-Control': 'public, max-age=3600',
    });
}

/**
 * GET /api/cities/top10
 * Returns exactly the 10 main cities for the home page
 */
export async function top10CitiesRoute(c: Context<{ Bindings: Env }>) {
    const date = c.req.query('date') ?? getToday();
    const rows = await getCityAggregatesByNames(c.env.DB, date, HOME_CITIES);

    const cityMap = new Map(rows.map(r => [r.city, r]));
    const result = HOME_CITIES.map(city => {
        const r = cityMap.get(city);
        return {
            city: CITY_DISPLAY[city] ?? city,
            province: r?.province ?? '',
            sp95: r?.sp95_avg ?? null,
            dieselA: r?.diesel_a_avg ?? null,
            stationCount: r?.station_count ?? 0,
        };
    }).sort((a, b) => (a.sp95 || 999) - (b.sp95 || 999));

    return c.json({ date, cities: result }, 200, {
        'Cache-Control': 'public, max-age=3600',
    });
}
