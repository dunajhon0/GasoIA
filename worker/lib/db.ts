/**
 * D1 database helpers
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { NormalizedStation } from './minetur';

export type Fuel = 'sp95' | 'sp98' | 'diesel_a' | 'diesel_a_plus' | 'diesel_b' | 'diesel_c' | 'biodiesel' | 'glp' | 'gnc';
export type Scope = 'national' | 'peninsula' | 'baleares' | 'canarias';

export interface FuelAggregate {
    date: string;
    fuel_type: Fuel;
    scope: Scope;
    avg_price: number | null;
    min_price: number | null;
    max_price: number | null;
    count: number;
}

export interface CityAggregate {
    date: string;
    city: string;
    province: string;
    sp95_avg: number | null;
    diesel_a_avg: number | null;
    station_count: number;
}

export interface BrandAggregate {
    date: string;
    brand: string;
    sp95_avg: number | null;
    diesel_a_avg: number | null;
    station_count: number;
}

// ─── Station Upsert ─────────────────────────────────────────────────────────

export async function upsertStations(db: D1Database, stations: NormalizedStation[], updatedAt: string): Promise<void> {
    const CHUNK = 50;
    for (let i = 0; i < stations.length; i += CHUNK) {
        const batch = stations.slice(i, i + CHUNK);
        const stmts = batch.map(s =>
            db.prepare(`
        INSERT INTO stations (id, name, address, municipality, locality, province, postal_code, lat, lon, schedule, brand, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name, address=excluded.address, municipality=excluded.municipality,
          locality=excluded.locality, province=excluded.province, postal_code=excluded.postal_code,
          lat=excluded.lat, lon=excluded.lon, schedule=excluded.schedule, brand=excluded.brand, updated_at=excluded.updated_at
      `).bind(
                s.id, s.name, s.address, s.municipality, s.locality,
                s.province, s.postalCode, s.lat, s.lon, s.schedule, s.brand, updatedAt
            )
        );
        await db.batch(stmts);
    }
}

export async function upsertStationPrices(db: D1Database, stations: NormalizedStation[], date: string): Promise<void> {
    const CHUNK = 50;
    for (let i = 0; i < stations.length; i += CHUNK) {
        const batch = stations.slice(i, i + CHUNK);
        const stmts = batch.map(s =>
            db.prepare(`
        INSERT INTO station_prices (station_id, date, sp95, sp98, diesel_a, diesel_a_plus, diesel_b, diesel_c, biodiesel, glp, gnc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(station_id, date) DO UPDATE SET
          sp95=excluded.sp95, sp98=excluded.sp98, diesel_a=excluded.diesel_a,
          diesel_a_plus=excluded.diesel_a_plus, diesel_b=excluded.diesel_b,
          diesel_c=excluded.diesel_c, biodiesel=excluded.biodiesel,
          glp=excluded.glp, gnc=excluded.gnc
      `).bind(
                s.id, date, s.prices.sp95, s.prices.sp98, s.prices.dieselA,
                s.prices.dieselAPlus, s.prices.dieselB, s.prices.dieselC,
                s.prices.biodiesel, s.prices.glp, s.prices.gnc
            )
        );
        await db.batch(stmts);
    }
}

export async function upsertFuelAggregate(db: D1Database, agg: FuelAggregate): Promise<void> {
    await db.prepare(`
    INSERT INTO fuel_aggregates (date, fuel_type, scope, avg_price, min_price, max_price, count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date, fuel_type, scope) DO UPDATE SET
      avg_price=excluded.avg_price, min_price=excluded.min_price,
      max_price=excluded.max_price, count=excluded.count
  `).bind(agg.date, agg.fuel_type, agg.scope, agg.avg_price, agg.min_price, agg.max_price, agg.count).run();
}

export async function upsertCityAggregate(db: D1Database, agg: CityAggregate): Promise<void> {
    await db.prepare(`
    INSERT INTO city_aggregates (date, city, province, sp95_avg, diesel_a_avg, station_count)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(date, city) DO UPDATE SET
      province=excluded.province, sp95_avg=excluded.sp95_avg,
      diesel_a_avg=excluded.diesel_a_avg, station_count=excluded.station_count
  `).bind(agg.date, agg.city, agg.province, agg.sp95_avg, agg.diesel_a_avg, agg.station_count).run();
}

export async function upsertBrandAggregate(db: D1Database, agg: BrandAggregate): Promise<void> {
    await db.prepare(`
    INSERT INTO brand_aggregates (date, brand, sp95_avg, diesel_a_avg, station_count)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(date, brand) DO UPDATE SET
      sp95_avg=excluded.sp95_avg, diesel_a_avg=excluded.diesel_a_avg, station_count=excluded.station_count
  `).bind(agg.date, agg.brand, agg.sp95_avg, agg.diesel_a_avg, agg.station_count).run();
}

// ─── Query Helpers ───────────────────────────────────────────────────────────

export async function getFuelAggregateForDate(
    db: D1Database, date: string, scope: Scope = 'national'
): Promise<Record<Fuel, FuelAggregate | null>> {
    const rows = await db.prepare(
        `SELECT * FROM fuel_aggregates WHERE date=? AND scope=?`
    ).bind(date, scope).all<FuelAggregate>();

    const map: Partial<Record<Fuel, FuelAggregate | null>> = {};
    for (const r of rows.results ?? []) {
        map[r.fuel_type] = r;
    }
    return {
        sp95: map.sp95 ?? null,
        sp98: map.sp98 ?? null,
        diesel_a: map.diesel_a ?? null,
        diesel_a_plus: map.diesel_a_plus ?? null,
        diesel_b: map.diesel_b ?? null,
        diesel_c: map.diesel_c ?? null,
        biodiesel: map.biodiesel ?? null,
        glp: map.glp ?? null,
        gnc: map.gnc ?? null,
    };
}

export async function getFuelHistory(
    db: D1Database, fuel: Fuel, days: number
): Promise<{ date: string; avg_price: number | null }[]> {
    return (await db.prepare(
        `SELECT date, avg_price FROM fuel_aggregates
     WHERE fuel_type=? AND scope='national' AND avg_price IS NOT NULL
     ORDER BY date DESC LIMIT ?`
    ).bind(fuel, days).all<{ date: string; avg_price: number | null }>()).results ?? [];
}

export async function getCityAggregatesForDate(
    db: D1Database, date: string, cities: string[]
): Promise<CityAggregate[]> {
    const placeholders = cities.map(() => '?').join(',');
    return (await db.prepare(
        `SELECT * FROM city_aggregates WHERE date=? AND city IN (${placeholders})`
    ).bind(date, ...cities).all<CityAggregate>()).results ?? [];
}

export async function getBrandAggregatesForDate(
    db: D1Database, date: string
): Promise<BrandAggregate[]> {
    return (await db.prepare(
        `SELECT * FROM brand_aggregates WHERE date=? ORDER BY sp95_avg ASC`
    ).bind(date).all<BrandAggregate>()).results ?? [];
}

export async function getHistoricalMinMax(
    db: D1Database, fuel: Fuel
): Promise<{ min: number | null; min_date: string | null; max: number | null; max_date: string | null }> {
    const minRow = await db.prepare(
        `SELECT avg_price as val, date FROM fuel_aggregates WHERE fuel_type=? AND scope='national' AND avg_price IS NOT NULL ORDER BY avg_price ASC LIMIT 1`
    ).bind(fuel).first<{ val: number; date: string }>();
    const maxRow = await db.prepare(
        `SELECT avg_price as val, date FROM fuel_aggregates WHERE fuel_type=? AND scope='national' AND avg_price IS NOT NULL ORDER BY avg_price DESC LIMIT 1`
    ).bind(fuel).first<{ val: number; date: string }>();
    return {
        min: minRow?.val ?? null,
        min_date: minRow?.date ?? null,
        max: maxRow?.val ?? null,
        max_date: maxRow?.date ?? null,
    };
}
