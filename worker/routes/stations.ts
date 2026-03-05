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
    const ids = c.req.query('ids') ?? '';
    const latQ = c.req.query('lat');
    const lonQ = c.req.query('lon');
    const radiusQ = c.req.query('radius');
    const fuel = c.req.query('fuel') ?? '';
    const brand = c.req.query('brand') ?? '';
    const sort = c.req.query('sort') ?? 'price';
    const order = c.req.query('order') ?? 'asc';
    const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
    const pageSize = Math.min(Math.max(1, parseInt(c.req.query('pageSize') ?? '25', 10)), 100);

    let stations: NormalizedStation[] = [];
    try {
        stations = await fetchMineturData();
    } catch (e) {
        return c.json({ error: 'Failed to fetch station data' }, 503);
    }

    const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    // ─── Filter ────────────────────────────────────────────────────────────────
    let filtered = stations;

    if (q) {
        const qNorm = normalize(q);
        filtered = filtered.filter(s =>
            normalize(s.address).includes(qNorm) ||
            normalize(s.municipality).includes(qNorm) ||
            normalize(s.locality).includes(qNorm) ||
            normalize(s.brand).includes(qNorm) ||
            s.postalCode.includes(q)
        );
    }

    if (city) {
        const cNorm = normalize(city);
        filtered = filtered.filter(s =>
            normalize(s.municipality).includes(cNorm) ||
            normalize(s.locality).includes(cNorm)
        );
    }

    if (province) {
        const pNorm = normalize(province);
        filtered = filtered.filter(s => normalize(s.province).includes(pNorm));
    }

    if (brand) {
        const bBrands = brand.split(',').map(b => b.trim().toLowerCase());
        filtered = filtered.filter(s => bBrands.some(b => s.brand.toLowerCase().includes(b)));
    }

    if (fuel) {
        filtered = filtered.filter(s => {
            const val = s.prices[fuel as keyof typeof s.prices];
            return val !== null && (val as number) > 0;
        });
    }

    if (ids) {
        const idSet = new Set(ids.split(',').map(id => id.trim()));
        filtered = filtered.filter(s => idSet.has(s.id));
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
            }));

        if (radiusQ) {
            withDist = withDist.filter(s => s.distKm! <= radius);
        }
    }

    // ─── Sort ──────────────────────────────────────────────────────────────────
    const isAsc = order === 'asc';
    const mult = isAsc ? 1 : -1;

    withDist.sort((a, b) => {
        if (sort === 'distance' && a.distKm !== undefined && b.distKm !== undefined) {
            if (a.distKm !== b.distKm) return (a.distKm - b.distKm) * mult;
            // Tie-break by price
            const fuelKey = (fuel || 'sp95') as keyof NormalizedStation['prices'];
            const pa = (a.prices[fuelKey] ?? 999) as number;
            const pb = (b.prices[fuelKey] ?? 999) as number;
            if (pa !== pb) return pa - pb;
            return a.id.localeCompare(b.id);
        }

        if (sort === 'brand') {
            const cmp = a.brand.localeCompare(b.brand);
            if (cmp !== 0) return cmp * mult;
            return a.id.localeCompare(b.id);
        }

        if (sort === 'price') {
            const fuelKey = (fuel || 'sp95') as keyof NormalizedStation['prices'];
            const pa = a.prices[fuelKey] ?? (isAsc ? 999 : -1);
            const pb = b.prices[fuelKey] ?? (isAsc ? 999 : -1);
            if (pa !== pb) return ((pa as number) - (pb as number)) * mult;
            return a.id.localeCompare(b.id);
        }

        return a.id.localeCompare(b.id);
    });

    // ─── Pagination ────────────────────────────────────────────────────────────
    const total = withDist.length;
    const start = (page - 1) * pageSize;
    const paginated = withDist.slice(start, start + pageSize);

    const items = paginated.map(s => ({
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
        distKm: s.distKm ?? null,
        prices: s.prices,
    }));

    return c.json({
        total,
        page,
        pageSize,
        items
    }, 200, {
        'Cache-Control': 'public, max-age=300',
    });
}
