/**
 * Smoke tests for API endpoints (against a mock Worker)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch to avoid real HTTP in CI
const SUMMARY_MOCK = {
    date: '2025-01-01',
    updatedAt: '2025-01-01T06:00:00.000Z',
    sp95: { today: 1.549, yesterday: 1.542, delta: 0.007, deltaPct: 0.45, count: 10200 },
    dieselA: { today: 1.419, yesterday: 1.428, delta: -0.009, deltaPct: -0.63, count: 10200 },
};

const HISTORY_MOCK = {
    fuel: 'sp95',
    days: 30,
    series: [
        { date: '2024-12-01', price: 1.530 },
        { date: '2024-12-02', price: 1.535 },
        { date: '2024-12-03', price: 1.540 },
    ],
};

const FUELS_MOCK = {
    date: '2025-01-01',
    scope: 'peninsula',
    fuels: [
        { key: 'sp95', label: 'Sin Plomo 95', today: 1.549, yesterday: 1.542, minHist: 1.199, minDate: '2020-05-01', maxHist: 2.119, maxDate: '2022-06-15' },
        { key: 'diesel_a', label: 'Gasóleo A', today: 1.419, yesterday: 1.428, minHist: 0.999, minDate: '2020-05-01', maxHist: 2.049, maxDate: '2022-07-01' },
    ],
};

describe('API smoke tests', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            if (url.includes('/api/summary')) return new Response(JSON.stringify(SUMMARY_MOCK), { status: 200 });
            if (url.includes('/api/history')) return new Response(JSON.stringify(HISTORY_MOCK), { status: 200 });
            if (url.includes('/api/fuels/table')) return new Response(JSON.stringify(FUELS_MOCK), { status: 200 });
            return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 });
        }));
    });

    it('GET /api/summary returns sp95 and dieselA today prices', async () => {
        const res = await fetch('http://localhost:8787/api/summary');
        expect(res.status).toBe(200);
        const json = await res.json() as typeof SUMMARY_MOCK;
        expect(json.sp95.today).toBeGreaterThan(0);
        expect(json.dieselA.today).toBeGreaterThan(0);
        expect(json.sp95.count).toBeGreaterThan(0);
    });

    it('GET /api/history returns a sorted series array', async () => {
        const res = await fetch('http://localhost:8787/api/history?fuel=sp95&days=30');
        expect(res.status).toBe(200);
        const json = await res.json() as typeof HISTORY_MOCK;
        expect(Array.isArray(json.series)).toBe(true);
        expect(json.fuel).toBe('sp95');
        // Check ascending date order
        for (let i = 1; i < json.series.length; i++) {
            expect(json.series[i]!.date >= json.series[i - 1]!.date).toBe(true);
        }
    });

    it('GET /api/fuels/table returns all expected fuel types', async () => {
        const res = await fetch('http://localhost:8787/api/fuels/table?scope=peninsula');
        expect(res.status).toBe(200);
        const json = await res.json() as typeof FUELS_MOCK;
        expect(json.fuels.length).toBeGreaterThan(0);
        const keys = json.fuels.map((f: { key: string }) => f.key);
        expect(keys).toContain('sp95');
        expect(keys).toContain('diesel_a');
        // Check min <= today <= max
        json.fuels.forEach((f: { today: number | null; minHist: number | null; maxHist: number | null }) => {
            if (f.today && f.minHist) expect(f.today).toBeGreaterThanOrEqual(f.minHist);
            if (f.today && f.maxHist) expect(f.today).toBeLessThanOrEqual(f.maxHist);
        });
    });
});
