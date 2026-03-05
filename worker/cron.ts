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
    type Fuel,
    type Scope,
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
            await upsertFuelAggregate(db, {
                date: today,
                fuel_type: fuelDb,
                scope,
                avg_price: calcAvg(vals),
                min_price: calcMin(vals),
                max_price: calcMax(vals),
                count: vals.filter(v => v !== null && v > 0).length,
            });
        }
    }

    // 5. City aggregates
    for (const [rawCity] of Object.entries(TOP_CITIES)) {
        // Match municipio containing city name (case-insensitive)
        const cityStations = stations.filter(s =>
            s.municipality.toUpperCase().includes(rawCity) ||
            s.locality.toUpperCase().includes(rawCity)
        );
        if (cityStations.length === 0) continue;

        const province = cityStations[0]?.province ?? '';
        await upsertCityAggregate(db, {
            date: today,
            city: rawCity,
            province,
            sp95_avg: calcAvg(cityStations.map(s => s.prices.sp95)),
            diesel_a_avg: calcAvg(cityStations.map(s => s.prices.dieselA)),
            station_count: cityStations.length,
        });
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
