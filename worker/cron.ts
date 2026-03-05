/**
 * Cron handler - runs daily to fetch MINETUR data and persist aggregates
 */
import type { D1Database } from '@cloudflare/workers-types';
import {
    fetchMineturData,
    filterPeninsula,
    filterBaleares,
    filterCanarias,
    calcAvg, calcMin, calcMax,
    getToday,
} from './lib/minetur';
import {
    upsertStations,
    upsertStationPrices,
    upsertFuelAggregate,
    upsertCityAggregate,
    upsertBrandAggregate,
    upsertDailyFuelStat,
    type Fuel,
    type Scope,
    type CityAggregate,
} from './lib/db';

const TOP_CITIES: Record<string, string> = {
    'MADRID': 'Madrid',
    'BARCELONA': 'Barcelona',
    'VALÈNCIA': 'Valencia',
    'SEVILLA': 'Sevilla',
    'ZARAGOZA': 'Zaragoza',
    'MÁLAGA': 'Málaga',
    'MURCIA': 'Murcia',
    'PALMA': 'Baleares',
    'LAS PALMAS DE GRAN CANARIA': 'Canarias',
    'BILBAO': 'País Vasco',
};

const TOP_BRANDS = [
    'MOEVE', 'CEPSA', 'REPSOL', 'BP', 'SHELL', 'ALCAMPO', 'PETROPRIX',
    'PLENOIL', 'BALLENOIL', 'GALP', 'CARREFOUR', 'AVIA', 'DISA',
    'MEROIL', 'EROSKI', 'SUMA', 'CAMPSA',
];

const FUEL_KEYS: { db: Fuel; field: keyof ReturnType<typeof getStationPrices> }[] = [
    { db: 'sp95', field: 'sp95' },
    { db: 'sp98', field: 'sp98' },
    { db: 'diesel_a', field: 'dieselA' },
    { db: 'diesel_a_plus', field: 'dieselAPlus' },
    { db: 'diesel_b', field: 'dieselB' },
    { db: 'diesel_c', field: 'dieselC' },
    { db: 'biodiesel', field: 'biodiesel' },
    { db: 'glp', field: 'glp' },
    { db: 'gnc', field: 'gnc' },
];

function getStationPrices(s: { prices: Record<string, number | null> }) {
    return s.prices as {
        sp95: number | null; sp98: number | null; dieselA: number | null;
        dieselAPlus: number | null; dieselB: number | null; dieselC: number | null;
        biodiesel: number | null; glp: number | null; gnc: number | null;
    };
}

export async function runCron(db: D1Database): Promise<void> {
    console.log('[GasoIA Cron] Starting daily update...');
    const today = getToday();

    // 1. Fetch raw data
    const stations = await fetchMineturData();
    console.log(`[GasoIA Cron] Fetched ${stations.length} stations for ${today}`);

    // 2. Upsert station master data
    await upsertStations(db, stations, today);

    // 3. Upsert station prices
    await upsertStationPrices(db, stations, today);

    // 4. Compute and store fuel aggregates by scope
    const peninsula = filterPeninsula(stations);
    const baleares = filterBaleares(stations);
    const canarias = filterCanarias(stations);
    const scopes: { scope: Scope; data: typeof stations }[] = [
        { scope: 'national', data: stations },
        { scope: 'peninsula', data: peninsula },
        { scope: 'baleares', data: baleares },
        { scope: 'canarias', data: canarias },
    ];

    for (const { scope, data } of scopes) {
        for (const { db: fuelDb, field } of FUEL_KEYS) {
            const vals = data.map(s => s.prices[field as keyof typeof s.prices] as number | null);
            const avg = calcAvg(vals);
            const min = calcMin(vals);
            const max = calcMax(vals);
            const count = vals.filter(v => v !== null && v > 0).length;

            await upsertFuelAggregate(db, {
                date: today,
                fuel_type: fuelDb,
                scope,
                avg_price: avg,
                min_price: min,
                max_price: max,
                count: count,
            });

            // Also update the new daily_fuel_stats table for national scope
            if (scope === 'national') {
                await upsertDailyFuelStat(db, {
                    day: today,
                    fuel: fuelDb,
                    avg_price: avg,
                    min_price: min,
                    max_price: max,
                    sample_count: count,
                });
            }
        }
    }

    // 5. City aggregates (ALL Cities)
    const cityAggs = new Map<string, { city: string, province: string, sp95: number[], dieselA: number[] }>();
    for (const s of stations) {
        const key = `${s.municipality.toUpperCase()}|${s.province.toUpperCase()}`;
        if (!cityAggs.has(key)) {
            cityAggs.set(key, { city: s.municipality.toUpperCase(), province: s.province, sp95: [], dieselA: [] });
        }
        const c = cityAggs.get(key)!;
        if (s.prices.sp95) c.sp95.push(s.prices.sp95);
        if (s.prices.dieselA) c.dieselA.push(s.prices.dieselA);
    }

    const cityRecords: CityAggregate[] = [];
    for (const agg of cityAggs.values()) {
        if (agg.sp95.length === 0 && agg.dieselA.length === 0) continue;
        cityRecords.push({
            date: today,
            city: agg.city,
            province: agg.province,
            sp95_avg: calcAvg(agg.sp95),
            diesel_a_avg: calcAvg(agg.dieselA),
            station_count: Math.max(agg.sp95.length, agg.dieselA.length, 1), // Approximate
        });
    }

    // Batch upsert cities
    const CHUNK_CITIES = 50;
    for (let i = 0; i < cityRecords.length; i += CHUNK_CITIES) {
        const batch = cityRecords.slice(i, i + CHUNK_CITIES);
        const stmts = batch.map(agg =>
            db.prepare(`
                INSERT INTO city_aggregates (date, city, province, sp95_avg, diesel_a_avg, station_count)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(date, city) DO UPDATE SET
                province=excluded.province, sp95_avg=excluded.sp95_avg,
                diesel_a_avg=excluded.diesel_a_avg, station_count=excluded.station_count
            `).bind(agg.date, agg.city, agg.province, agg.sp95_avg, agg.diesel_a_avg, agg.station_count)
        );
        await db.batch(stmts);
    }

    // 6. Brand aggregates
    for (const brand of TOP_BRANDS) {
        const brandStations = stations.filter(s =>
            s.brand.toUpperCase().includes(brand)
        );
        if (brandStations.length === 0) continue;
        await upsertBrandAggregate(db, {
            date: today,
            brand,
            sp95_avg: calcAvg(brandStations.map(s => s.prices.sp95)),
            diesel_a_avg: calcAvg(brandStations.map(s => s.prices.dieselA)),
            station_count: brandStations.length,
        });
    }

    console.log('[GasoIA Cron] Daily update complete.');
}
