import type { Context } from 'hono';
import type { Env } from '../index';
import { getCityAggregatesForDate } from '../lib/db';
import { getToday } from '../lib/minetur';

const TOP_CITIES = [
    'MADRID', 'BARCELONA', 'VALÈNCIA', 'SEVILLA', 'ZARAGOZA',
    'MÁLAGA', 'MURCIA', 'PALMA', 'LAS PALMAS DE GRAN CANARIA', 'BILBAO',
];

const CITY_DISPLAY: Record<string, string> = {
    'MADRID': 'Madrid',
    'BARCELONA': 'Barcelona',
    'VALÈNCIA': 'Valencia',
    'SEVILLA': 'Sevilla',
    'ZARAGOZA': 'Zaragoza',
    'MÁLAGA': 'Málaga',
    'MURCIA': 'Murcia',
    'PALMA': 'Palma',
    'LAS PALMAS DE GRAN CANARIA': 'Las Palmas',
    'BILBAO': 'Bilbao',
};

export async function citiesRoute(c: Context<{ Bindings: Env }>) {
    const date = c.req.query('date') ?? getToday();
    const rows = await getCityAggregatesForDate(c.env.DB, date, TOP_CITIES);

    const cityMap = new Map(rows.map(r => [r.city, r]));
    const result = TOP_CITIES.map(city => {
        const r = cityMap.get(city);
        return {
            city: CITY_DISPLAY[city] ?? city,
            province: r?.province ?? '',
            sp95: r?.sp95_avg ?? null,
            dieselA: r?.diesel_a_avg ?? null,
            stationCount: r?.station_count ?? 0,
        };
    });

    return c.json({ date, cities: result }, 200, {
        'Cache-Control': 'public, max-age=3600',
    });
}
