import type { Context } from 'hono';
import type { Env } from '../index';
import { fetchMineturData, haversineKm } from '../lib/minetur';
import type { NormalizedStation } from '../lib/minetur';

const MAX_RESULTS = 50;
const DEFAULT_RADIUS = 10; // km

export async function stationsRoute(c: Context<{ Bindings: Env }>) {
    const q = c.req.query('q') ?? '';
    const city = c.req.query('city') ?? '';
    const province = c.req.query('province') ?? '';
    const latQ = c.req.query('lat');
    const lonQ = c.req.query('lon');
    const radiusQ = c.req.query('radius');
    const fuel = c.req.query('fuel') ?? '';
    const brand = c.req.query('brand') ?? '';
    const sort = c.req.query('sort') ?? 'price'; // price | distance | brand
    const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), MAX_RESULTS);

    // Cache key agnostic of request — fetch fresh data (worker always has latest)
    // In production, you'd cache this in KV or use the D1 stations + prices tables
    let stations: NormalizedStation[] = [];
    try {
        stations = await fetchMineturData();
    } catch (e) {
        return c.json({ error: 'Failed to fetch station data' }, 503);
    }

    // ─── Filter ────────────────────────────────────────────────────────────────
    let filtered = stations;

    if (q) {
        const qLow = q.toLowerCase();
        filtered = filtered.filter(s =>
            s.address.toLowerCase().includes(qLow) ||
            s.municipality.toLowerCase().includes(qLow) ||
            s.locality.toLowerCase().includes(qLow) ||
            s.brand.toLowerCase().includes(qLow) ||
            s.postalCode.includes(q)
        );
    }

    if (city) {
        const cLow = city.toLowerCase();
        filtered = filtered.filter(s =>
            s.municipality.toLowerCase().includes(cLow) ||
            s.locality.toLowerCase().includes(cLow)
        );
    }

    if (province) {
        const pLow = province.toLowerCase();
        filtered = filtered.filter(s => s.province.toLowerCase().includes(pLow));
    }

    if (brand) {
        const bLow = brand.toLowerCase();
        filtered = filtered.filter(s => s.brand.toLowerCase().includes(bLow));
    }

    if (fuel) {
        filtered = filtered.filter(s => {
            const p = s.prices[fuel as keyof typeof s.prices];
            return p !== null && (p as number) > 0;
        });
    }

    // ─── Geo filter ────────────────────────────────────────────────────────────
    const lat = latQ ? parseFloat(latQ) : null;
    const lon = lonQ ? parseFloat(lonQ) : null;
    const radius = radiusQ ? parseFloat(radiusQ) : DEFAULT_RADIUS;

    type WithDist = NormalizedStation & { distKm?: number };
    let withDist: WithDist[] = filtered as WithDist[];

    if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
        withDist = filtered
            .filter(s => s.lat !== null && s.lon !== null)
            .map(s => ({
                ...s,
                distKm: haversineKm(lat, lon, s.lat!, s.lon!),
            }))
            .filter(s => s.distKm! <= radius) as WithDist[];
    }

    // ─── Sort ──────────────────────────────────────────────────────────────────
    if (sort === 'distance' && lat !== null) {
        withDist.sort((a, b) => (a.distKm ?? 999) - (b.distKm ?? 999));
    } else if (sort === 'brand') {
        withDist.sort((a, b) => a.brand.localeCompare(b.brand));
    } else {
        // price: sort by SP95 or selected fuel
        const fuelKey = (fuel || 'sp95') as keyof NormalizedStation['prices'];
        withDist.sort((a, b) => {
            const pa = a.prices[fuelKey] ?? 999;
            const pb = b.prices[fuelKey] ?? 999;
            return (pa as number) - (pb as number);
        });
    }

    const results = withDist.slice(0, limit).map(s => ({
        id: s.id,
        name: s.name,
        address: s.address,
        municipality: s.municipality,
        locality: s.locality,
        province: s.province,
        postalCode: s.postalCode,
        lat: s.lat,
        lon: s.lon,
        schedule: s.schedule,
        brand: s.brand,
        distKm: (s as WithDist).distKm ?? null,
        prices: s.prices,
    }));

    return c.json({ total: withDist.length, showing: results.length, stations: results }, 200, {
        'Cache-Control': 'public, max-age=300',
    });
}
