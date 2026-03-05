'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

interface Station {
    id: string;
    name: string;
    address: string;
    municipality: string;
    province: string;
    brand: string;
    lat: number | null;
    lon: number | null;
    schedule: string;
    distKm: number | null;
    prices: {
        sp95: number | null;
        sp98: number | null;
        dieselA: number | null;
        glp: number | null;
        gnc: number | null;
    };
}

interface ApiResult {
    total: number;
    page: number;
    pageSize: number;
    items: Station[];
}

type FuelFilter = 'sp95' | 'dieselA' | 'sp98' | 'glp' | 'gnc' | '';
type SortMode = 'price' | 'distance' | 'brand';
type SortOrder = 'asc' | 'desc';

const BRAND_LIST = ['Repsol', 'Cepsa', 'Moeve', 'BP', 'Shell', 'Galp', 'Plenoil', 'Ballenoil', 'Petroprix', 'Alcampo'];

function fmt(p: number | null): string {
    if (p === null) return '—';
    return p.toFixed(3) + '€';
}

export default function StationFinder() {
    // Initial state from URL
    const getInitialParams = () => {
        if (typeof window === 'undefined') return {};
        const params = new URLSearchParams(window.location.search);
        return {
            q: params.get('q') || '',
            city: params.get('city') || '',
            province: params.get('province') || '',
            fuel: (params.get('fuel') || 'sp95') as FuelFilter,
            brand: params.get('brand') || '',
            sort: (params.get('sort') || 'price') as SortMode,
            order: (params.get('order') || 'asc') as SortOrder,
            page: parseInt(params.get('page') || '1', 10),
        };
    };

    const initial = getInitialParams();

    const [query, setQuery] = useState(initial.q || '');
    const [city, setCity] = useState(initial.city || '');
    const [province, setProvince] = useState(initial.province || '');
    const [fuel, setFuel] = useState<FuelFilter>(initial.fuel || 'sp95');
    const [brand, setBrand] = useState(initial.brand || '');
    const [sort, setSort] = useState<SortMode>(initial.sort || 'price');
    const [order, setOrder] = useState<SortOrder>(initial.order || 'asc');

    const [stations, setStations] = useState<Station[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(initial.page || 1);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userPos, setUserPos] = useState<{ lat: number; lon: number } | null>(null);
    const [favorites, setFavorites] = useState<Set<string>>(() => {
        if (typeof window === 'undefined') return new Set();
        try { return new Set(JSON.parse(localStorage.getItem('fav-stations') ?? '[]')); } catch { return new Set(); }
    });

    const isFirstRender = useRef(true);

    const fetchStations = useCallback(async (isLoadMore = false) => {
        if (isLoadMore) setLoadingMore(true); else setLoading(true);
        setError(null);

        try {
            const params: any = {
                q: query,
                city,
                province,
                fuel,
                brand,
                sort,
                order,
                page: isLoadMore ? page + 1 : 1,
                pageSize: '24'
            };

            if (userPos) {
                params.lat = String(userPos.lat);
                params.lon = String(userPos.lon);
            }

            const qs = new URLSearchParams(params).toString();
            const res = await fetch(`/api/stations?${qs}`);
            if (!res.ok) throw new Error('Error al conectar con la API');

            const data: ApiResult = await res.json();

            if (isLoadMore) {
                setStations(prev => [...prev, ...data.items]);
                setPage(data.page);
            } else {
                setStations(data.items);
                setTotal(data.total);
                setPage(1);
            }

            // Update URL
            if (typeof window !== 'undefined') {
                const newQs = new URLSearchParams(params);
                newQs.delete('pageSize'); // Hide pageSize if it's default
                if (!isLoadMore) newQs.delete('page');
                const path = `${window.location.pathname}?${newQs.toString()}`;
                window.history.replaceState({ path }, '', path);
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [query, city, province, fuel, brand, sort, order, page, userPos]);

    // Search on changes (or triggered by button)
    const handleSearch = () => {
        setPage(1);
        fetchStations(false);
    };

    const handleReset = () => {
        setQuery('');
        setCity('');
        setProvince('');
        setFuel('sp95');
        setBrand('');
        setSort('price');
        setOrder('asc');
        setPage(1);
        if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', window.location.pathname);
        }
    };

    const handleGeo = () => {
        setLoading(true);
        navigator.geolocation.getCurrentPosition(
            pos => {
                const lat = pos.coords.latitude, lon = pos.coords.longitude;
                setUserPos({ lat, lon });
                setSort('distance');
                // We'll let the user click search after getting location
                setLoading(false);
            },
            () => {
                setError('No se pudo obtener la ubicación. Por favor, revisa los permisos.');
                setLoading(false);
            },
            { timeout: 8000 }
        );
    };

    // SEO & Page Title Update
    useEffect(() => {
        if (!typeof window) return;
        const baseTitle = "Buscador de gasolineras baratas cerca de mí – GasoIA";
        const baseDesc = "Encuentra las gasolineras más baratas cerca de tu ubicación o en cualquier ciudad de España. Precios actualizados hoy. Filtra por combustible y marca.";

        if (city) {
            const cityName = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
            document.title = `Gasolineras en ${cityName} hoy | Precio gasolina – GasoIA`;
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) metaDesc.setAttribute('content', `Consulta las gasolineras más baratas en ${cityName} hoy. Precios actualizados de gasolina 95 y gasóleo A.`);
        } else {
            document.title = baseTitle;
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) metaDesc.setAttribute('content', baseDesc);
        }
    }, [city]);

    // Initial load & Re-fetch on city change (from URL or clear button)
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            fetchStations();
        } else {
            // If city changes (e.g. from clear button), reset and fetch
            setPage(1);
            fetchStations(false);
        }
    }, [city]); // city is now a dependency to trigger re-fetch

    const toggleFav = (id: string) => {
        setFavorites(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            localStorage.setItem('fav-stations', JSON.stringify([...next]));
            return next;
        });
    };

    return (
        <div className="space-y-6">
            {/* Results Title (Dynamic) */}
            {city && (
                <div className="flex items-center justify-between gap-4 animate-fade-in">
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
                        Gasolineras en <span className="text-brand-500">{city}</span>
                    </h2>
                    <button
                        onClick={() => { setCity(''); }}
                        className="text-xs font-bold text-muted hover:text-red-500 transition-colors flex items-center gap-1"
                    >
                        ✕ Quitar filtro ciudad
                    </button>
                </div>
            )}
            {/* Filter Panel */}
            <div className="card p-5 animate-slide-up">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Main search */}
                    <div className="lg:col-span-2">
                        <label className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Buscar por nombre o dirección</label>
                        <div className="relative">
                            <input
                                type="search"
                                className="input pl-10 w-full"
                                placeholder="Ej: Plenoil, Calle Mayor, 28001..."
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">🔍</span>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Provincia</label>
                        <input
                            type="text"
                            className="input w-full"
                            placeholder="Ej: Madrid, Barcelona..."
                            value={province}
                            onChange={e => setProvince(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Municipio</label>
                        <input
                            type="text"
                            className="input w-full"
                            placeholder="Ej: Getafe, Sabadell..."
                            value={city}
                            onChange={e => setCity(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Combustible</label>
                        <select className="select w-full" value={fuel} onChange={e => setFuel(e.target.value as FuelFilter)}>
                            <option value="sp95">Gasolina 95 (E5)</option>
                            <option value="dieselA">Gasóleo A</option>
                            <option value="sp98">Gasolina 98 (E5)</option>
                            <option value="glp">GLP</option>
                            <option value="gnc">GNC</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Marca</label>
                        <select className="select w-full" value={brand} onChange={e => setBrand(e.target.value)}>
                            <option value="">Todas las marcas</option>
                            {BRAND_LIST.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Ordenar por</label>
                        <div className="flex gap-2">
                            <select className="select flex-1" value={sort} onChange={e => setSort(e.target.value as SortMode)}>
                                <option value="price">Precio más bajo</option>
                                <option value="distance">Distancia</option>
                                <option value="brand">Nombre Marca</option>
                            </select>
                            <button
                                onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}
                                className="btn-secondary px-3"
                                title={order === 'asc' ? 'Ascendente' : 'Descendente'}
                            >
                                {order === 'asc' ? '↑' : '↓'}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-end gap-2">
                        <button onClick={handleSearch} className="btn-primary flex-1 h-[42px]" disabled={loading}>
                            {loading ? 'Buscando...' : 'Aplicar Filtros'}
                        </button>
                        <button onClick={handleReset} className="btn-secondary h-[42px]" title="Limpiar filtros">
                            ↺
                        </button>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <button
                        onClick={handleGeo}
                        className={`text-sm flex items-center gap-2 transition-colors ${userPos ? 'text-indigo-500 font-semibold' : 'text-muted hover:text-indigo-500'}`}
                    >
                        {userPos ? '📍 Ubicación activada' : '📍 Usar mi ubicación para calcular distancias'}
                    </button>

                    {total > 0 && (
                        <p className="text-sm text-muted">
                            Encontradas <strong>{total}</strong> estaciones
                        </p>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
                    <span>⚠️</span> {error}
                </div>
            )}

            {/* Results */}
            <div className="min-h-[400px] relative">
                {loading && stations.length === 0 && (
                    <div className="grid grid-cols-1 gap-4">
                        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-32 w-full rounded-2xl" />)}
                    </div>
                )}

                {stations.length > 0 ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                            {stations.map(s => (
                                <div key={s.id} className="card p-5 flex flex-col sm:flex-row gap-5 hover:border-indigo-500/50 transition-colors group">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div>
                                                <h3 className="font-bold text-lg group-hover:text-indigo-500 transition-colors">{s.name || s.brand}</h3>
                                                <p className="text-sm text-muted mt-0.5">{s.address}</p>
                                            </div>
                                            <button
                                                onClick={() => toggleFav(s.id)}
                                                className={`text-2xl transition-all hover:scale-125 ${favorites.has(s.id) ? 'grayscale-0' : 'grayscale opacity-30 hover:opacity-100'}`}
                                            >
                                                ⭐
                                            </button>
                                        </div>

                                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted font-medium mt-3">
                                            <span className="flex items-center gap-1">🏙️ {s.municipality}, {s.province}</span>
                                            {s.schedule && <span className="flex items-center gap-1">🕐 {s.schedule}</span>}
                                            {s.distKm !== null && (
                                                <span className="flex items-center gap-1 text-indigo-500">📍 {s.distKm.toFixed(1)} km</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap sm:flex-nowrap gap-3 self-center">
                                        {/* Main price highlighted if selected */}
                                        {fuel && s.prices[fuel === 'dieselA' ? 'dieselA' : fuel as keyof typeof s.prices] !== null && (
                                            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3 text-center min-w-[90px]">
                                                <p className="text-[10px] font-bold text-indigo-500 uppercase">{fuel}</p>
                                                <p className="text-xl font-black font-mono text-indigo-600 dark:text-indigo-400">
                                                    {fmt(s.prices[fuel === 'dieselA' ? 'dieselA' : fuel as keyof typeof s.prices])}
                                                </p>
                                            </div>
                                        )}

                                        {/* Other prices compact */}
                                        <div className="grid grid-cols-2 gap-2">
                                            {Object.entries(s.prices)
                                                .filter(([key, val]) => val !== null && (fuel ? key !== fuel : true))
                                                .slice(0, 4)
                                                .map(([key, val]) => (
                                                    <div key={key} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg px-2 py-1 text-center min-w-[60px] border border-transparent">
                                                        <p className="text-[8px] font-bold text-muted uppercase">{key === 'dieselA' ? 'Dsl' : key}</p>
                                                        <p className="text-[11px] font-bold font-mono">{fmt(val as number)}</p>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {stations.length < total && (
                            <div className="pt-6 flex justify-center">
                                <button
                                    onClick={() => fetchStations(true)}
                                    className="btn-secondary px-8 py-3 font-semibold shadow-sm"
                                    disabled={loadingMore}
                                >
                                    {loadingMore ? '⌛ Cargando más...' : `Cargar más gasolineras (${total - stations.length} restantes)`}
                                </button>
                            </div>
                        )}
                    </div>
                ) : !loading && (
                    <div className="card-flat p-12 text-center text-muted animate-fade-in">
                        <div className="text-6xl mb-4">🔍</div>
                        <h3 className="text-xl font-bold mb-2 text-slate-700 dark:text-slate-300">No hay resultados</h3>
                        <p>Intenta ajustar los filtros de búsqueda o cambia la ubicación.</p>
                        <button onClick={handleReset} className="mt-6 text-indigo-500 font-semibold hover:underline">
                            Limpiar todos los filtros
                        </button>
                    </div>
                )}
            </div>
        </div >
    );
}
