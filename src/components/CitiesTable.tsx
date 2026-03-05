'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

interface City {
    city: string;
    province: string;
    sp95: number | null;
    dieselA: number | null;
    stationCount: number;
}

interface ApiResult {
    total: number;
    items: City[];
}

type SortField = 'city' | 'province' | 'sp95_avg' | 'diesel_a_avg' | 'station_count';
type SortOrder = 'asc' | 'desc';

function fmt(p: number | null): string {
    if (p === null) return '—';
    return p.toFixed(3) + ' €/L';
}

export default function CitiesTable() {
    // URL Sync
    const getInitialParams = () => {
        if (typeof window === 'undefined') return {};
        const params = new URLSearchParams(window.location.search);
        return {
            q: params.get('q') || '',
            sort: (params.get('sort') || 'sp95_avg') as SortField,
            order: (params.get('order') || 'asc') as SortOrder,
        };
    };

    const initial = getInitialParams();

    const [query, setQuery] = useState(initial.q || '');
    const [sort, setSort] = useState<SortField>(initial.sort || 'sp95_avg');
    const [order, setOrder] = useState<SortOrder>(initial.order || 'asc');

    const [items, setItems] = useState<City[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const LIMIT = 50;
    const isFirstRender = useRef(true);

    const fetchCities = useCallback(async (isLoadMore = false) => {
        if (isLoadMore) setLoadingMore(true); else setLoading(true);
        setError(null);

        try {
            const currentOffset = isLoadMore ? offset + LIMIT : 0;
            const params = new URLSearchParams({
                q: query,
                sort,
                order,
                limit: String(LIMIT),
                offset: String(currentOffset)
            });

            const res = await fetch(`/api/cities?${params.toString()}`);
            if (!res.ok) throw new Error('Error al conectar con la API');

            const data: ApiResult = await res.json();

            if (isLoadMore) {
                setItems(prev => [...prev, ...data.items]);
                setOffset(currentOffset);
            } else {
                setItems(data.items);
                setTotal(data.total);
                setOffset(0);
            }

            // Sync URL
            if (typeof window !== 'undefined') {
                const urlParams = new URLSearchParams();
                if (query) urlParams.set('q', query);
                if (sort !== 'sp95_avg') urlParams.set('sort', sort);
                if (order !== 'asc') urlParams.set('order', order);
                const path = `${window.location.pathname}${urlParams.toString() ? '?' + urlParams.toString() : ''}`;
                window.history.replaceState({ path }, '', path);
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [query, sort, order, offset]);

    // Initial load
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            fetchCities();
        }
    }, [fetchCities]);

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!isFirstRender.current) {
                setOffset(0);
                fetchCities(false);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [query]);

    // Fast change for sort/order
    const handleSort = (field: SortField) => {
        if (sort === field) {
            setOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSort(field);
            setOrder('asc');
        }
        setOffset(0);
    };

    const Th = ({ field, label, hideOnMobile = false }: { field: SortField, label: string, hideOnMobile?: boolean }) => (
        <th
            className={`cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left transition-colors hover:text-brand-500 ${hideOnMobile ? 'hidden sm:table-cell' : ''}`}
            onClick={() => handleSort(field)}
        >
            <div className="flex items-center gap-1">
                {label}
                <span className="text-[10px] opacity-50">
                    {sort === field ? (order === 'asc' ? '▲' : '▼') : '↕'}
                </span>
            </div>
        </th>
    );

    return (
        <div className="space-y-6">
            {/* Search bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="relative w-full max-w-sm">
                    <input
                        type="search"
                        placeholder="Buscar por ciudad o provincia…"
                        className="input pl-10 w-full"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">🔍</span>
                </div>
                {total > 0 && (
                    <p className="text-sm text-muted">
                        Total: <strong>{total}</strong> municipios
                    </p>
                )}
            </div>

            {/* Error state */}
            {error && (
                <div className="card p-6 border-red-200 bg-red-50 text-center">
                    <p className="text-red-600 font-medium mb-3">⚠️ {error}</p>
                    <button onClick={() => fetchCities(false)} className="btn-secondary text-sm">Reintentar</button>
                </div>
            )}

            {/* Table */}
            <div className="card overflow-hidden">
                <div className="overflow-x-auto overflow-y-hidden">
                    <table className="w-full text-sm border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                            <tr>
                                <th className="px-4 py-3 text-left text-muted font-bold text-[10px] uppercase tracking-wider w-12">#</th>
                                <Th field="city" label="Ciudad" />
                                <Th field="province" label="Provincia" hideOnMobile />
                                <Th field="sp95_avg" label="Gasolina 95" />
                                <Th field="diesel_a_avg" label="Gasóleo A" />
                                <Th field="station_count" label="Gasolineras" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {items.map((c, i) => (
                                <tr key={`${c.city}-${c.province}`} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                    <td className="px-4 py-3 text-muted text-xs font-mono">{i + 1}</td>
                                    <td className="px-4 py-3">
                                        <a
                                            href={`/gasolineras?city=${encodeURIComponent(c.city)}`}
                                            className="font-bold text-slate-700 dark:text-slate-200 hover:text-brand-500 transition-colors"
                                        >
                                            {c.city}
                                        </a>
                                        <div className="sm:hidden text-[10px] text-muted font-medium uppercase tracking-wider">{c.province}</div>
                                    </td>
                                    <td className="px-4 py-3 hidden sm:table-cell text-muted">{c.province}</td>
                                    <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{fmt(c.sp95)}</td>
                                    <td className="px-4 py-3 font-mono font-bold text-amber-600 dark:text-amber-400">{fmt(c.dieselA)}</td>
                                    <td className="px-4 py-3 flex items-center justify-between gap-2">
                                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-muted">
                                            {c.stationCount}
                                        </span>
                                        <a
                                            href={`/gasolineras?city=${encodeURIComponent(c.city)}`}
                                            className="hidden lg:inline-flex items-center gap-1 text-[10px] font-bold text-brand-500 hover:underline"
                                        >
                                            Ver estaciones →
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {loading && items.length === 0 && (
                    <div className="p-12 space-y-4">
                        {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton h-8 w-full rounded" />)}
                    </div>
                )}

                {!loading && items.length === 0 && !error && (
                    <div className="p-12 text-center text-muted">
                        <p className="text-4xl mb-4">🔍</p>
                        <h3 className="text-lg font-bold">No se encontraron ciudades</h3>
                        <p className="text-sm">Prueba con otros términos de búsqueda.</p>
                        <button onClick={() => setQuery('')} className="mt-4 text-brand-500 hover:underline">Limpiar búsqueda</button>
                    </div>
                )}

                {items.length < total && (
                    <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-center">
                        <button
                            onClick={() => fetchCities(true)}
                            className="btn-secondary px-8"
                            disabled={loadingMore}
                        >
                            {loadingMore ? 'Cargando…' : `Cargar más municipios (${total - items.length} restantes)`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
