'use client';
import { useState, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';

interface Brand {
    brand: string;
    display: string;
    color: string;
    sp95: number | null;
    dieselA: number | null;
    stationCount: number;
}

interface ApiResponse {
    date: string;
    brands: Brand[];
}

interface NationalAvg {
    sp95: number | null;
    dieselA: number | null;
}

function fmt(p: number | null): string {
    if (p === null) return '—';
    return p.toFixed(3) + ' €';
}

function deltaBg(mine: number | null, avg: number | null): string {
    if (mine === null || avg === null) return '';
    const d = mine - avg;
    if (d < -0.01) return 'text-emerald-600 dark:text-emerald-400';
    if (d > 0.01) return 'text-red-600 dark:text-red-400';
    return 'text-muted';
}

export default function BrandChart({ nationalAvg }: { nationalAvg: NationalAvg | null }) {
    const [data, setData] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [fuel, setFuel] = useState<'sp95' | 'dieselA'>('sp95');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/brands');
            if (!res.ok) throw new Error();
            setData(await res.json());
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    if (loading) return <div className="skeleton h-96 rounded-xl" />;
    if (!data) return <div className="card-flat p-8 text-center text-muted">Sin datos de marcas disponibles.</div>;

    const brands = data.brands.filter(b => b[fuel] !== null).sort((a, b) => ((a[fuel] ?? 999) - (b[fuel] ?? 999)));
    const avg = fuel === 'sp95' ? nationalAvg?.sp95 : nationalAvg?.dieselA;

    const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');

    const option = {
        backgroundColor: 'transparent',
        grid: { left: 120, right: 60, top: 20, bottom: 40 },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            backgroundColor: isDark ? '#1a2236' : '#fff',
            borderColor: isDark ? '#2d3748' : '#e2e8f0',
            textStyle: { color: isDark ? '#f1f5f9' : '#0f172a' },
            formatter: (params: { name: string; value: number }[]) => {
                const p = params[0]!;
                const d = avg ? (p.value - avg) : null;
                return `<b>${p.name}</b><br/>${p.value.toFixed(3)} €/L${d !== null ? `<br/><span style="color:${d > 0 ? '#ef4444' : '#10b981'}">${d > 0 ? '+' : ''}${d.toFixed(4)} vs media</span>` : ''}`;
            },
        },
        xAxis: {
            type: 'value',
            scale: true,
            axisLabel: { formatter: (v: number) => `${v.toFixed(2)}€`, color: isDark ? '#94a3b8' : '#64748b' },
            splitLine: { lineStyle: { color: isDark ? '#1e2a40' : '#f1f5f9', type: 'dashed' } },
        },
        yAxis: {
            type: 'category',
            data: brands.map(b => b.display),
            axisLabel: { color: isDark ? '#f1f5f9' : '#0f172a', fontWeight: 500 },
        },
        series: [{
            type: 'bar',
            data: brands.map(b => ({
                value: b[fuel],
                itemStyle: { color: b.color, borderRadius: [0, 6, 6, 0] },
            })),
            label: {
                show: true,
                position: 'right',
                formatter: (p: { value: number }) => `${p.value.toFixed(3)}€`,
                color: isDark ? '#94a3b8' : '#64748b',
                fontSize: 11,
            },
            barMaxWidth: 28,
        }, ...(avg ? [{
            type: 'line',
            data: brands.map(() => avg),
            symbol: 'none',
            lineStyle: { color: '#2aa5ff', type: 'dashed', width: 1.5 },
            tooltip: { show: false },
            silent: true,
        }] : [])],
    };

    return (
        <div className="space-y-6">
            {/* Fuel toggle */}
            <div className="flex gap-2">
                <button
                    onClick={() => setFuel('sp95')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${fuel === 'sp95' ? 'text-white border-transparent bg-indigo-500 shadow-glow-indigo' : 'btn-secondary'}`}
                    aria-pressed={fuel === 'sp95'}
                >
                    ⛽ Gasolina 95
                </button>
                <button
                    onClick={() => setFuel('dieselA')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${fuel === 'dieselA' ? 'text-white border-transparent bg-amber-500' : 'btn-secondary'}`}
                    aria-pressed={fuel === 'dieselA'}
                >
                    🚛 Gasóleo A
                </button>
            </div>

            {/* Chart */}
            <div className="card p-5">
                <ReactECharts option={option} style={{ height: `${Math.max(280, brands.length * 38)}px` }} opts={{ renderer: 'svg' }} lazyUpdate />
                {avg && <p className="text-xs text-muted mt-2 text-center">— Línea azul: media nacional ({avg.toFixed(3)} €/L)</p>}
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {brands.slice(0, 9).map(b => {
                    const price = b[fuel];
                    const delta = (price !== null && avg !== undefined && avg !== null) ? price - avg : null;
                    return (
                        <div key={b.brand} className="card p-4 flex items-center gap-3">
                            <div className="w-3 h-12 rounded-full shrink-0" style={{ background: b.color }} />
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate">{b.display}</p>
                                <p className="font-mono font-bold text-lg">{fmt(price)}</p>
                                <p className={`text-xs ${deltaBg(price, avg ?? null)}`}>
                                    {delta !== null ? `${delta > 0 ? '+' : ''}${delta.toFixed(4)} vs media` : ''}
                                </p>
                            </div>
                            <p className="text-xs text-muted shrink-0 text-right">{b.stationCount}<br />gasolineras</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
