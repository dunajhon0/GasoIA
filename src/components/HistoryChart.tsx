'use client';
import { useState, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';

type FuelKey = 'sp95' | 'sp98' | 'diesel_a' | 'glp' | 'gnc';
type DaysKey = 30 | 90 | 180 | 365;

const FUEL_OPTIONS: { value: FuelKey; label: string; color: string }[] = [
    { value: 'sp95', label: 'Gasolina 95', color: '#6366f1' },
    { value: 'sp98', label: 'Gasolina 98', color: '#8b5cf6' },
    { value: 'diesel_a', label: 'Gasóleo A', color: '#f59e0b' },
    { value: 'glp', label: 'GLP / Autogás', color: '#10b981' },
    { value: 'gnc', label: 'GNC', color: '#3b82f6' },
];

const DAYS_OPTIONS: { value: DaysKey; label: string }[] = [
    { value: 30, label: '30 d' },
    { value: 90, label: '90 d' },
    { value: 180, label: '6 m' },
    { value: 365, label: '1 año' },
];

interface SeriesPoint {
    date: string;
    price: number | null;
}

export default function HistoryChart() {
    const [fuel, setFuel] = useState<FuelKey>('sp95');
    const [days, setDays] = useState<DaysKey>(90);
    const [series, setSeries] = useState<SeriesPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fuelMeta = FUEL_OPTIONS.find(f => f.value === fuel)!;

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/history?fuel=${fuel}&days=${days}`);
            if (!res.ok) throw new Error('Error al cargar datos');
            const json = await res.json();
            setSeries(json.series ?? []);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    }, [fuel, days]);

    useEffect(() => { load(); }, [load]);

    const isDark = document.documentElement.classList.contains('dark');

    const option = {
        backgroundColor: 'transparent',
        textStyle: { fontFamily: 'Inter, system-ui, sans-serif' },
        grid: { left: 60, right: 20, top: 20, bottom: 50 },
        tooltip: {
            trigger: 'axis',
            backgroundColor: isDark ? '#1a2236' : '#ffffff',
            borderColor: isDark ? '#2d3748' : '#e2e8f0',
            textStyle: { color: isDark ? '#f1f5f9' : '#0f172a' },
            formatter: (params: { axisValue: string; value: number }[]) => {
                const p = params[0];
                return `<b>${p?.axisValue}</b><br/>${fuelMeta.label}: <b>${(p?.value ?? 0).toFixed(3)} €/L</b>`;
            },
        },
        xAxis: {
            type: 'category',
            data: series.map(s => s.date),
            axisLabel: {
                color: isDark ? '#94a3b8' : '#64748b',
                formatter: (v: string) => v.slice(5), // show MM-DD
                interval: Math.max(1, Math.floor(series.length / 8)),
            },
            axisLine: { lineStyle: { color: isDark ? '#2d3748' : '#e2e8f0' } },
            splitLine: { show: false },
        },
        yAxis: {
            type: 'value',
            scale: true,
            axisLabel: {
                color: isDark ? '#94a3b8' : '#64748b',
                formatter: (v: number) => `${v.toFixed(2)}€`,
            },
            splitLine: { lineStyle: { color: isDark ? '#1e2a40' : '#f1f5f9', type: 'dashed' } },
        },
        series: [{
            type: 'line',
            data: series.map(s => s.price),
            smooth: true,
            lineStyle: { color: fuelMeta.color, width: 2.5 },
            itemStyle: { color: fuelMeta.color },
            symbol: 'none',
            areaStyle: {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: fuelMeta.color + '40' },
                        { offset: 1, color: fuelMeta.color + '00' },
                    ],
                },
            },
        }],
    };

    return (
        <div className="card p-5 sm:p-6">
            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex flex-wrap gap-2">
                    {FUEL_OPTIONS.map(f => (
                        <button
                            key={f.value}
                            onClick={() => setFuel(f.value)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${fuel === f.value
                                    ? 'text-white border-transparent'
                                    : 'btn-secondary border-transparent'
                                }`}
                            style={fuel === f.value ? { background: f.color, boxShadow: `0 0 12px ${f.color}60` } : {}}
                            aria-pressed={fuel === f.value}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                <div className="flex gap-1 p-1 rounded-lg border border-color bg-surface-2">
                    {DAYS_OPTIONS.map(d => (
                        <button
                            key={d.value}
                            onClick={() => setDays(d.value)}
                            className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${days === d.value
                                    ? 'bg-brand-500 text-white shadow-sm'
                                    : 'text-muted hover:text-gray-900 dark:hover:text-white'
                                }`}
                            aria-pressed={days === d.value}
                        >
                            {d.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart */}
            {loading ? (
                <div className="h-72 flex items-center justify-center">
                    <div className="skeleton w-full h-full rounded-xl" />
                </div>
            ) : error ? (
                <div className="h-72 flex items-center justify-center text-muted">
                    <p>⚠️ {error} — <button onClick={load} className="underline">Reintentar</button></p>
                </div>
            ) : series.length === 0 ? (
                <div className="h-72 flex items-center justify-center text-muted">
                    <p>No hay datos disponibles todavía. El histórico se acumula con el tiempo.</p>
                </div>
            ) : (
                <ReactECharts
                    option={option}
                    style={{ height: '320px' }}
                    opts={{ renderer: 'svg' }}
                    lazyUpdate
                />
            )}
        </div>
    );
}
