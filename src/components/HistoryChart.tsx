'use client';
import { useState, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';

type FuelKey = string;
type RangeDays = number;

interface FuelMeta {
    label: string;
    color: string;
}

const FUEL_MAP: Record<string, FuelMeta> = {
    'sp95': { label: 'Gasolina 95', color: '#6366f1' },
    'diesel_a': { label: 'Gasóleo A', color: '#f59e0b' },
    'sp98': { label: 'Gasolina 98', color: '#8b5cf6' },
    'diesel_a_plus': { label: 'Gasóleo A+', color: '#ea580c' },
    'glp': { label: 'GLP', color: '#10b981' },
    'gnc': { label: 'GNC', color: '#3b82f6' },
    'diesel_b': { label: 'Gasóleo B', color: '#94a3b8' },
    'biodiesel': { label: 'Biodiesel', color: '#84cc16' },
};

const RANGE_OPTIONS = [
    { label: '7d', value: 7 },
    { label: '30d', value: 30 },
    { label: '90d', value: 90 },
    { label: '180d', value: 180 },
];

interface HistoryData {
    rangeDays: number;
    fuels: string[];
    series: Record<string, any[]>;
    stats: Record<string, any>;
}

export default function HistoryChart() {
    const [fuel, setFuel] = useState<string>('sp95');
    const [range, setRange] = useState<RangeDays>(30);
    const [data, setData] = useState<HistoryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/history?fuel=${fuel}&range=${range}`);
            if (!res.ok) throw new Error('No se pudo cargar el histórico');
            const json = await res.json();
            setData(json);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    }, [fuel, range]);

    useEffect(() => { load(); }, [load]);

    const renderChart = () => {
        if (!data) return null;

        const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
        const fuels = data.fuels;

        const option = {
            backgroundColor: 'transparent',
            textStyle: { fontFamily: 'Inter, system-ui, sans-serif' },
            grid: { left: 40, right: 20, top: 40, bottom: 40, containLabel: true },
            tooltip: {
                trigger: 'axis',
                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                borderColor: isDark ? '#334155' : '#e2e8f0',
                textStyle: { color: isDark ? '#f8fafc' : '#0f172a' },
                shadowColor: 'rgba(0, 0, 0, 0.1)',
                shadowBlur: 10,
                formatter: (params: any[]) => {
                    let html = `<div class="font-bold mb-1">${params[0].axisValue}</div>`;
                    params.forEach(p => {
                        const meta = FUEL_MAP[p.seriesId] || { label: p.seriesId.toUpperCase(), color: p.color };
                        html += `
                            <div class="flex items-center justify-between gap-4 text-xs">
                                <span class="flex items-center gap-1.5">
                                    <span style="width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
                                    ${meta.label}
                                </span>
                                <span class="font-mono font-black">${p.value.toFixed(3)}€</span>
                            </div>
                        `;
                    });
                    return html;
                },
                confine: true
            },
            xAxis: {
                type: 'category',
                data: data.series[fuels[0]]?.map(pt => pt.day) || [],
                axisLabel: {
                    color: isDark ? '#94a3b8' : '#64748b',
                    formatter: (v: string) => v.split('-').slice(1).join('/'), // MM/DD
                    interval: 'auto',
                    hideOverlap: true
                },
                axisLine: { lineStyle: { color: isDark ? '#334155' : '#e2e8f0' } },
            },
            yAxis: {
                type: 'value',
                scale: true,
                axisLabel: {
                    color: isDark ? '#94a3b8' : '#64748b',
                    formatter: (v: number) => `${v.toFixed(2)}€`,
                },
                splitLine: { lineStyle: { color: isDark ? '#1e293b' : '#f1f5f9', type: 'dashed' } },
            },
            legend: {
                show: fuels.length > 1,
                top: 0,
                textStyle: { color: isDark ? '#cbd5e1' : '#475569' }
            },
            series: fuels.map(f => {
                const meta = FUEL_MAP[f] || { color: '#6366f1' };
                return {
                    id: f,
                    name: meta.label,
                    type: 'line',
                    data: data.series[f]?.map(pt => pt.avg) || [],
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: range > 30 ? 0 : 6,
                    lineStyle: { width: 3, color: meta.color },
                    itemStyle: { color: meta.color },
                    areaStyle: {
                        color: {
                            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                                { offset: 0, color: meta.color + '30' },
                                { offset: 1, color: meta.color + '00' }
                            ]
                        }
                    }
                };
            })
        };

        return <ReactECharts option={option} style={{ height: '400px' }} opts={{ renderer: 'svg' }} />;
    };

    const renderKPIs = () => {
        if (!data || !data.stats) return null;

        const stats = data.stats[fuel === 'ALL' ? data.fuels[0] : fuel];
        if (!stats) return null;

        const deltaColor = stats.deltaPct > 0 ? 'text-red-500' : stats.deltaPct < 0 ? 'text-green-500' : 'text-slate-400';
        const deltaIcon = stats.deltaPct > 0 ? '↗' : stats.deltaPct < 0 ? '↘' : '→';

        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="card p-4 flex flex-col justify-between border-b-4 border-brand-500 overflow-hidden relative group translate-y-0 hover:-translate-y-1 transition-all">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Media hoy</span>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black tracking-tighter text-slate-800 dark:text-white">{stats.todayAvg?.toFixed(3) || '---'}€</span>
                        {stats.deltaPct !== null && (
                            <span className={`text-xs font-bold ${deltaColor} flex items-center gap-0.5`}>
                                {deltaIcon} {Math.abs(stats.deltaPct).toFixed(1)}%
                            </span>
                        )}
                    </div>
                    <div className="absolute -right-2 -bottom-2 opacity-5 text-6xl group-hover:scale-110 transition-transform">⛽</div>
                </div>

                <div className="card p-4 flex flex-col justify-between border-b-4 border-slate-300 dark:border-slate-700">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Media ayer</span>
                    <span className="text-2xl font-black tracking-tighter text-slate-800 dark:text-white mt-1">{stats.yesterdayAvg?.toFixed(3) || '---'}€</span>
                </div>

                <div className="card p-4 flex flex-col justify-between border-b-4 border-green-500">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mín Histórico</span>
                    <span className="text-2xl font-black tracking-tighter text-green-600 mt-1">{stats.allTimeMin?.toFixed(3) || '---'}€</span>
                </div>

                <div className="card p-4 flex flex-col justify-between border-b-4 border-red-500">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Máx Histórico</span>
                    <span className="text-2xl font-black tracking-tighter text-red-600 mt-1">{stats.allTimeMax?.toFixed(3) || '---'}€</span>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setFuel('ALL')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${fuel === 'ALL'
                            ? 'bg-slate-900 dark:bg-brand-500 text-white shadow-lg'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}
                    >
                        Todos
                    </button>
                    {Object.entries(FUEL_MAP).map(([key, meta]) => (
                        <button
                            key={key}
                            onClick={() => setFuel(key)}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border-2 ${fuel === key
                                ? 'text-white border-transparent'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-700'}`}
                            style={fuel === key ? { backgroundColor: meta.color, boxShadow: `0 8px 16px ${meta.color}40` } : {}}
                        >
                            {meta.label}
                        </button>
                    ))}
                </div>

                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    {RANGE_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setRange(opt.value)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-tighter transition-all ${range === opt.value
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
                    </div>
                    <div className="skeleton h-[400px] w-full rounded-3xl" />
                </div>
            ) : error ? (
                <div className="card p-12 text-center">
                    <p className="text-4xl mb-4">⚠️</p>
                    <p className="font-bold text-slate-700 dark:text-slate-300 mb-4">{error}</p>
                    <button onClick={load} className="btn-brand px-8">Reintentar</button>
                </div>
            ) : (
                <div className="animate-fade-in">
                    {renderKPIs()}
                    <div className="card p-6 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                            <span className="text-[120px] font-black italic tracking-tighter">HISTORY</span>
                        </div>
                        {renderChart()}
                        {(!data || Object.keys(data.series).length === 0) && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-8 text-center">
                                <div>
                                    <p className="text-5xl mb-4">📊</p>
                                    <p className="font-bold text-slate-600 dark:text-slate-400">
                                        No hay datos históricos para este combustible todavía.<br />
                                        <small className="font-normal opacity-60">Se empezarán a acumular diariamente.</small>
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
