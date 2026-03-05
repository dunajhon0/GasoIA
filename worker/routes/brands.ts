import type { Context } from 'hono';
import type { Env } from '../index';
import { getBrandAggregatesForDate } from '../lib/db';
import { getToday } from '../lib/minetur';

const BRAND_META: Record<string, { display: string; color: string }> = {
    MOEVE: { display: 'Moeve (Cepsa)', color: '#e07322' },
    CEPSA: { display: 'Cepsa', color: '#e07322' },
    REPSOL: { display: 'Repsol', color: '#ef1111' },
    BP: { display: 'BP', color: '#007a33' },
    SHELL: { display: 'Shell', color: '#ffc407' },
    ALCAMPO: { display: 'Alcampo', color: '#003087' },
    PETROPRIX: { display: 'Petroprix', color: '#1a56db' },
    PLENOIL: { display: 'Plenoil', color: '#7c3aed' },
    BALLENOIL: { display: 'Ballenoil', color: '#0ea5e9' },
    GALP: { display: 'Galp', color: '#f97316' },
    CARREFOUR: { display: 'Carrefour', color: '#004a97' },
    AVIA: { display: 'Avia', color: '#1d4ed8' },
    DISA: { display: 'Disa', color: '#16a34a' },
    MEROIL: { display: 'Meroil', color: '#9333ea' },
    EROSKI: { display: 'Eroski', color: '#dc2626' },
    SUMA: { display: 'Suma', color: '#0891b2' },
    CAMPSA: { display: 'Campsa', color: '#b91c1c' },
};

export async function brandsRoute(c: Context<{ Bindings: Env }>) {
    const date = c.req.query('date') ?? getToday();
    const rows = await getBrandAggregatesForDate(c.env.DB, date);

    const brands = rows.map(r => ({
        brand: r.brand,
        display: BRAND_META[r.brand]?.display ?? r.brand,
        color: BRAND_META[r.brand]?.color ?? '#6366f1',
        sp95: r.sp95_avg,
        dieselA: r.diesel_a_avg,
        stationCount: r.station_count,
    }));

    return c.json({ date, brands }, 200, {
        'Cache-Control': 'public, max-age=3600',
    });
}
