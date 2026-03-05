'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
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

/**
 * Super lightweight Sparkline component using SVG
 */
function Sparkline({ data, color, height = 30 }: { data: number[], color: string, height?: number }) {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((val - min) / range) * 100;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg viewBox="0 0 100 100" className="w-full overflow-visible" style={{ height }} preserveAspectRatio="none">
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
            />
        </svg>
    );
}

export default function HistoryChart() {
    const [fuel, setFuel] = useState<string>('sp95');
    const [range, setRange] = useState<RangeDays>(30);
    const [data, setData] = useState<HistoryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isMobile = windowWidth < 768;

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Using range or days param for compatibility
            const res = await fetch(`/api/history?fuel=${fuel}&range=${range}`);
            if (!res.ok) throw new Error('Error de conexión con la API');
            const json = await res.json();
            setData(json);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    }, [fuel, range]);

    useEffect(() => { load(); }, [load]);

    const activeFuels = useMemo(() => {
        if (!data) return [];
        if (fuel !== 'ALL') return [fuel];
        // If ALL and mobile, we might want to prioritize top 2
        if (isMobile) return data.fuels.slice(0, 2);
        return data.fuels;
    }, [data, fuel, isMobile]);

    const renderChart = () => {
        if (!data || activeFuels.length === 0) return null;

        const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

        const option = {
            backgroundColor: 'transparent',
            textStyle: { fontFamily: 'Inter, system-ui, sans-serif' },
            grid: {
                left: isMobile ? 10 : 40,
                right: isMobile ? 10 : 20,
                top: 60,
                bottom: 20,
                containLabel: true
            },
            tooltip: {
                trigger: 'axis',
                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                borderColor: isDark ? '#334155' : '#e2e8f0',
                textStyle: { color: isDark ? '#f8fafc' : '#0f172a' },
                shadowColor: 'rgba(0, 0, 0, 0.1)',
                shadowBlur: 10,
                formatter: (params: any[]) => {
                    let html = `<div class="font-bold mb-2 text-sm border-b pb-1 border-slate-200/50">${params[0].axisValue}</div>`;
                    params.forEach(p => {
                        const meta = FUEL_MAP[p.seriesId] || { label: p.seriesId.toUpperCase(), color: p.color };
                        html += `
                            <div class="flex items-center justify-between gap-6 py-1">
                                <span class="flex items-center gap-2 text-xs">
                                    <span style="width:10px;height:10px;border-radius:3px;background:${p.color};box-shadow: 0 0 5px ${p.color}80"></span>
                                    ${meta.label}
                                </span>
                                <span class="font-mono font-black text-sm">${p.value.toFixed(3)}€</span>
                            </div>
                        `;
                    });
                    return html;
                },
                confine: true
            },
            xAxis: {
                type: 'category',
                data: data.series[activeFuels[0]]?.map(pt => pt.day) || [],
                axisLabel: {
                    color: isDark ? '#94a3b8' : '#64748b',
                    formatter: (v: string) => v.split('-').slice(1).join('/'), // MM/DD
                    fontSize: 10,
                    interval: 'auto',
                    hideOverlap: true
                },
                axisLine: { lineStyle: { color: isDark ? '#334155' : '#e2e8f0' } },
                boundaryGap: false
            },
            yAxis: {
                type: 'value',
                scale: true,
                axisLabel: {
                    color: isDark ? '#94a3b8' : '#64748b',
                    formatter: (v: number) => `${v.toFixed(2)}€`,
                    fontSize: 10
                },
                splitLine: { lineStyle: { color: isDark ? '#1e293b' : '#f1f5f9', type: 'dashed' } },
            },
            legend: {
                show: true,
                top: 0,
                icon: 'roundRect',
                itemWidth: 12,
                itemHeight: 12,
                textStyle: { color: isDark ? '#cbd5e1' : '#475569', fontSize: 11 }
            },
            series: activeFuels.map(f => {
                const meta = FUEL_MAP[f] || { color: '#6366f1', label: f.toUpperCase() };
                const points = data.series[f] || [];
                return {
                    id: f,
                    name: meta.label,
                    type: 'line',
                    data: points.map(pt => pt.avg),
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: range > 60 ? 0 : 6,
                    lineStyle: { width: 3, color: meta.color },
                    itemStyle: { color: meta.color },
                    areaStyle: {
                        color: {
                            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                                { offset: 0, color: meta.color + '25' },
                                { offset: 1, color: meta.color + '00' }
                            ]
                        }
                    },
                    // Annotations only for single fuel to keep it clean
                    markPoint: fuel !== 'ALL' ? {
                        data: [
                            { type: 'min', name: 'Mín', symbol: 'pin', symbolSize: 30, itemStyle: { color: '#10b981' }, label: { fontSize: 8, fontWeight: 'bold', offset: [0, 2] } },
                            { type: 'max', name: 'Máx', symbol: 'pin', symbolSize: 30, itemStyle: { color: '#ef4444' }, label: { fontSize: 8, fontWeight: 'bold', offset: [0, 2] } }
                        ]
                    } : undefined
                };
            })
        };

        return (
            <div className="relative">
                <ReactECharts
                    option={option}
                    style={{ height: isMobile ? '300px' : '420px', width: '100%' }}
                    opts={{ renderer: 'svg' }}
                />
            </div>
        );
    };

    const renderKPIs = () => {
        if (!data || !data.stats) return null;

        const stats = data.stats[fuel === 'ALL' ? data.fuels[0] : fuel];
        if (!stats) return null;

        const deltaColor = stats.deltaPct > 0 ? 'text-red-500' : stats.deltaPct < 0 ? 'text-green-500' : 'text-slate-400';
        const deltaIcon = stats.deltaPct > 0 ? '↗' : stats.deltaPct < 0 ? '↘' : '→';
        const sparkData = data.series[fuel === 'ALL' ? data.fuels[0] : fuel]?.map(p => p.avg) || [];
        const fuelColor = FUEL_MAP[fuel === 'ALL' ? data.fuels[0] : fuel]?.color || '#6366f1';

        return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <div className="card p-4 flex flex-col justify-between border-b-4 border-brand-500 relative transition-transform hover:-translate-y-1">
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Media hoy</span>
                        {stats.deltaPct !== null && (
                            <span className={`text-[10px] font-black ${deltaColor} flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full`}>
                                {deltaIcon} {Math.abs(stats.deltaPct).toFixed(1)}%
                            </span>
                        )}
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black tracking-tighter text-slate-800 dark:text-white leading-none">
                            {stats.todayAvg ? stats.todayAvg.toFixed(3) : '---'}
                        </span>
                        <span className="text-sm font-bold opacity-40">€/L</span>
                    </div>
                    <div className="mt-3 opacity-40">
                        <Sparkline data={sparkData} color={fuelColor} height={20} />
                    </div>
                </div>

                <div className="card p-4 flex flex-col justify-between border-b-4 border-slate-300 dark:border-slate-700">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Media ayer</span>
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-black tracking-tighter text-slate-800 dark:text-white leading-none">
                            {stats.yesterdayAvg ? stats.yesterdayAvg.toFixed(3) : '---'}
                        </span>
                        <span className="text-sm font-bold opacity-40">€/L</span>
                    </div>
                    <p className="text-[9px] text-muted mt-2 font-bold uppercase italic">Variación diaria</p>
                </div>

                <div className="card p-4 flex flex-col justify-between border-b-4 border-green-500 bg-green-50/20 dark:bg-green-500/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-green-600/60 dark:text-green-400/60">Mín Histórico</span>
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-black tracking-tighter text-green-600 leading-none">
                            {stats.allTimeMin ? stats.allTimeMin.toFixed(3) : '---'}
                        </span>
                        <span className="text-sm font-bold text-green-600 opacity-40">€/L</span>
                    </div>
                    <p className="text-[9px] text-green-600/60 mt-2 font-bold uppercase italic">Mejor precio registrado</p>
                </div>

                <div className="card p-4 flex flex-col justify-between border-b-4 border-red-500 bg-red-50/20 dark:bg-red-500/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-red-600/60 dark:text-red-400/60">Máx Histórico</span>
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-black tracking-tighter text-red-600 leading-none">
                            {stats.allTimeMax ? stats.allTimeMax.toFixed(3) : '---'}
                        </span>
                        <span className="text-sm font-bold text-red-600 opacity-40">€/L</span>
                    </div>
                    <p className="text-[9px] text-red-600/60 mt-2 font-bold uppercase italic">Pico más alto</p>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm relative z-10">
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setFuel('ALL')}
                        className={`px-4 py-2 border-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${fuel === 'ALL'
                            ? 'bg-slate-900 border-slate-900 dark:bg-brand-500 dark:border-brand-500 text-white shadow-lg'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-700 hover:border-brand-500'}`}
                    >
                        Todos
                    </button>
                    {Object.entries(FUEL_MAP).map(([key, meta]) => (
                        <button
                            key={key}
                            onClick={() => setFuel(key)}
                            className={`px-4 py-2 border-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${fuel === key
                                ? 'text-white border-transparent shadow-xl'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-700 hover:border-brand-500'}`}
                            style={fuel === key ? { backgroundColor: meta.color, borderColor: meta.color, boxShadow: `0 8px 20px ${meta.color}30` } : {}}
                        >
                            {meta.label}
                        </button>
                    ))}
                </div>

                <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-fit">
                    {RANGE_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setRange(opt.value)}
                            className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${range === opt.value
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
                    </div>
                    <div className="skeleton h-[400px] w-full rounded-3xl" />
                </div>
            ) : error ? (
                <div className="card p-12 text-center shadow-xl border-dashed border-2 border-red-100 dark:border-red-900/30">
                    <p className="text-5xl mb-4">🔌</p>
                    <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight mb-2">Error de conexión</h3>
                    <p className="text-sm text-muted mb-6">{error}</p>
                    <button onClick={load} className="px-8 py-3 bg-brand-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all">Reintentar</button>
                </div>
            ) : (
                <div className="animate-fade-in">
                    {renderKPIs()}
                    <div className="card p-4 sm:p-8 shadow-2xl relative overflow-hidden bg-white/50 dark:bg-slate-900/40 backdrop-blur-sm border-2 border-slate-50 dark:border-slate-800/50">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none hidden sm:block">
                            <span className="text-[120px] font-black italic tracking-tighter select-none">PRECIOS</span>
                        </div>

                        {renderChart()}

                        {(!data || Object.keys(data.series).length === 0 || activeFuels.every(f => !data.series[f] || data.series[f].length === 0)) && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/80 backdrop-blur-md p-8 text-center z-20">
                                <div className="max-w-xs animate-bounce-slow">
                                    <p className="text-6xl mb-4">⌛</p>
                                    <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tight mb-2">Histórico insuficiente</h3>
                                    <p className="text-xs text-muted font-medium">
                                        Estamos recopilando datos diarios oficiales para construir este gráfico. Vuelve mañana para ver la evolución.
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
