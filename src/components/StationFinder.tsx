'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
    getNavPreference,
    setNavPreference as saveNavPref,
    openNavigation as startNavigation,
    NAV_PREF_KEY
} from '../lib/navigation';
import type { NavApp } from '../lib/navigation';

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

interface PriceSnapshot {
    [stationId: string]: {
        [fuelCode: string]: {
            price: number;
            updatedAt: string;
            meta: {
                name: string;
                address: string;
                brand: string;
                lat: number | null;
                lon: number | null;
                municipality: string;
            }
        }
    }
}

interface PriceChange {
    id: string; // unique for list
    stationId: string;
    fuelCode: string;
    oldPrice: number;
    newPrice: number;
    delta: number;
    direction: 'up' | 'down';
    detectedAt: string;
    viewed: boolean;
    meta: {
        name: string;
        address: string;
        brand: string;
        lat: number | null;
        lon: number | null;
        municipality: string;
    }
}

type FuelFilter = 'sp95' | 'dieselA' | 'sp98' | 'glp' | 'gnc' | '';
type SortMode = 'price' | 'distance' | 'brand';
type SortOrder = 'asc' | 'desc';

const BRAND_LIST = ['Repsol', 'Cepsa', 'Moeve', 'BP', 'Shell', 'Galp', 'Plenoil', 'Ballenoil', 'Petroprix', 'Alcampo'];
const RADIUS_OPTIONS = [2, 5, 10, 25, 50];

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
            lat: params.get('lat') ? parseFloat(params.get('lat')!) : null,
            lon: params.get('lon') ? parseFloat(params.get('lon')!) : null,
            radius: params.get('radius') ? parseInt(params.get('radius')!, 10) : 10,
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
    const [radius, setRadius] = useState(initial.radius || 10);
    const [userPos, setUserPos] = useState<{ lat: number; lon: number } | null>(
        initial.lat && initial.lon ? { lat: initial.lat, lon: initial.lon } : null
    );

    const [stations, setStations] = useState<Station[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(initial.page || 1);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [geoStatus, setGeoStatus] = useState<'idle' | 'requesting' | 'active' | 'denied'>(
        initial.lat ? 'active' : 'idle'
    );

    const [favorites, setFavorites] = useState<Set<string>>(() => {
        if (typeof window === 'undefined') return new Set();
        try {
            const legacy = localStorage.getItem('favorites');
            if (legacy && !localStorage.getItem('fav-stations')) {
                localStorage.setItem('fav-stations', legacy);
                // NOT removing favorites immediately to be absolutely safe during rollout? 
                // No, user says unified properly.
                localStorage.removeItem('favorites');
            }
            const legacy2 = localStorage.getItem('gasoia:favorites');
            if (legacy2 && !localStorage.getItem('fav-stations')) {
                localStorage.setItem('fav-stations', legacy2);
                localStorage.removeItem('gasoia:favorites');
            }
            return new Set(JSON.parse(localStorage.getItem('fav-stations') ?? '[]'));
        } catch { return new Set(); }
    });

    const [navTarget, setNavTarget] = useState<Station | null>(null);
    const [navPref, setNavPref] = useState<NavApp | null>(getNavPreference());
    const [rememberNav, setRememberNav] = useState(true);
    const [nearestStation, setNearestStation] = useState<Station | null>(null);
    const [highlightedId, setHighlightedId] = useState<string | null>(null);

    // Alerts state
    const [priceChanges, setPriceChanges] = useState<PriceChange[]>(() => {
        if (typeof window === 'undefined') return [];
        try { return JSON.parse(localStorage.getItem('gasoia:favPriceChanges') ?? '[]'); } catch { return []; }
    });

    // Persistent toggle for "Only Favorites"
    const [onlyFavorites, setOnlyFavorites] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('gasoia:showOnlyFavorites') === 'true';
    });

    const [lastViewedAt, setLastViewedAt] = useState<string>(() => {
        if (typeof window === 'undefined') return new Date().toISOString();
        return localStorage.getItem('gasoia:favChangesLastViewedAt') ?? new Date().toISOString();
    });

    const isFirstRender = useRef(true);
    const resultsRef = useRef<HTMLDivElement>(null);

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

            if (onlyFavorites) {
                if (favorites.size === 0) {
                    setStations([]);
                    setTotal(0);
                    setLoading(false);
                    return;
                }
                params.ids = Array.from(favorites).join(',');
            }

            if (userPos) {
                params.lat = String(userPos.lat);
                params.lon = String(userPos.lon);
                params.radius = String(radius);
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
                newQs.delete('pageSize');
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
    }, [query, city, province, fuel, brand, sort, order, page, userPos, radius, onlyFavorites, favorites]);

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
        setRadius(10);
        setUserPos(null);
        setGeoStatus('idle');
        setOnlyFavorites(false);
        setPage(1);
        if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', window.location.pathname);
        }
    };

    const handleGeo = () => {
        if (geoStatus === 'active') {
            setUserPos(null);
            setGeoStatus('idle');
            setSort('price');
            return;
        }

        setGeoStatus('requesting');
        navigator.geolocation.getCurrentPosition(
            pos => {
                const lat = pos.coords.latitude, lon = pos.coords.longitude;
                setUserPos({ lat, lon });
                setSort('distance');
                setPage(1);
            },
            () => {
                setGeoStatus('denied');
                setError('No se pudo obtener la ubicación. Por favor, revisa los permisos.');
            },
            { timeout: 8000 }
        );
    };

    const refreshFavorites = useCallback(async () => {
        if (favorites.size === 0) return;
        try {
            const idsStr = Array.from(favorites).join(',');
            const res = await fetch(`/api/stations/by-ids?ids=${idsStr}&fuel=${fuel}`);
            if (!res.ok) return;
            const data: ApiResult = await res.json();
            detectPriceChanges(data.items);
        } catch (e) {
            console.error('Error refreshing favorites', e);
        }
    }, [favorites, fuel]);

    const detectPriceChanges = useCallback((updatedStations: Station[]) => {
        const snapshots: PriceSnapshot = JSON.parse(localStorage.getItem('gasoia:favPriceSnapshot') ?? '{}');
        const newChanges: PriceChange[] = [...priceChanges];
        let hasNewChange = false;

        updatedStations.forEach(s => {
            if (!favorites.has(s.id)) return;

            const fuelsToCheck: FuelFilter[] = ['sp95', 'dieselA', 'sp98'];

            fuelsToCheck.forEach(f => {
                const currentPrice = s.prices[f as keyof typeof s.prices];
                if (currentPrice === null || currentPrice <= 0) return;

                const prev = snapshots[s.id]?.[f];
                if (prev && Math.abs(currentPrice - prev.price) > 0.001) {
                    const direction = currentPrice > prev.price ? 'up' : 'down';

                    const lastChange = newChanges.find(c => c.stationId === s.id && c.fuelCode === f);
                    if (lastChange && lastChange.newPrice === currentPrice) return;

                    newChanges.unshift({
                        id: `${s.id}-${f}-${Date.now()}`,
                        stationId: s.id,
                        fuelCode: f,
                        oldPrice: prev.price,
                        newPrice: currentPrice,
                        delta: currentPrice - prev.price,
                        direction,
                        detectedAt: new Date().toISOString(),
                        viewed: false,
                        meta: {
                            name: s.name,
                            address: s.address,
                            brand: s.brand,
                            lat: s.lat,
                            lon: s.lon,
                            municipality: s.municipality
                        }
                    });
                    hasNewChange = true;
                }

                if (!snapshots[s.id]) snapshots[s.id] = {};
                snapshots[s.id][f] = {
                    price: currentPrice,
                    updatedAt: new Date().toISOString(),
                    meta: {
                        name: s.name,
                        address: s.address,
                        brand: s.brand,
                        lat: s.lat,
                        lon: s.lon,
                        municipality: s.municipality
                    }
                };
            });
        });

        if (hasNewChange) {
            const trimmed = newChanges.slice(0, 50);
            setPriceChanges(trimmed);
            localStorage.setItem('gasoia:favPriceChanges', JSON.stringify(trimmed));
        }
        localStorage.setItem('gasoia:favPriceSnapshot', JSON.stringify(snapshots));
    }, [favorites, priceChanges]);

    useEffect(() => {
        if (stations.length > 0) {
            detectPriceChanges(stations);
        }
    }, [stations, detectPriceChanges]);

    useEffect(() => {
        const interval = setInterval(refreshFavorites, 15 * 60 * 1000);
        return () => clearInterval(interval);
    }, [refreshFavorites]);

    useEffect(() => {
        refreshFavorites();
    }, []);

    const clearHistory = () => {
        setPriceChanges([]);
        localStorage.removeItem('gasoia:favPriceChanges');
    };

    const markAllViewed = () => {
        const now = new Date().toISOString();
        setLastViewedAt(now);
        localStorage.setItem('gasoia:favChangesLastViewedAt', now);
        setPriceChanges(prev => prev.map(c => ({ ...c, viewed: true })));
    };

    const unseenCount = priceChanges.filter(c => c.detectedAt > lastViewedAt).length;
    const handleFindNearest = () => {
        setGeoStatus('requesting');
        navigator.geolocation.getCurrentPosition(
            async pos => {
                const lat = pos.coords.latitude, lon = pos.coords.longitude;
                setUserPos({ lat, lon });
                setSort('distance');
                setGeoStatus('active');
                setPage(1);

                // Specifically fetch to find the nearest
                try {
                    const qs = new URLSearchParams({
                        lat: String(lat),
                        lon: String(lon),
                        radius: '25',
                        sort: 'distance',
                        order: 'asc',
                        pageSize: '1'
                    }).toString();
                    const res = await fetch(`/api/stations?${qs}`);
                    const data = await res.json();
                    if (data.items && data.items.length > 0) {
                        setNearestStation(data.items[0]);
                    }
                } catch (e) {
                    console.error("Error finding nearest:", e);
                }
            },
            () => {
                setGeoStatus('denied');
                setError('No se pudo obtener la ubicación para encontrar la más cercana.');
            }
        );
    };

    const scrollToString = (id: string) => {
        setHighlightedId(id);
        const el = document.getElementById(`station-${id}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setTimeout(() => setHighlightedId(null), 3000);
    };

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('gasoia:showOnlyFavorites', String(onlyFavorites));
        }
    }, [onlyFavorites]);

    // SEO & Page Title Update
    useEffect(() => {
        if (typeof window === 'undefined') return;
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

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            fetchStations();
        } else {
            setPage(1);
            fetchStations(false);
        }
    }, [city, fuel, brand, sort, order, userPos, radius, onlyFavorites, favorites.size]);

    useEffect(() => {
        if (typeof window !== 'undefined' && !isFirstRender.current) {
            const params = new URLSearchParams(window.location.search);
            if (params.get('nearby') === '1') {
                handleFindNearest();
                // Optional: Clean up parameter without page reload
                const newParams = new URLSearchParams(window.location.search);
                newParams.delete('nearby');
                const newPath = `${window.location.pathname}${newParams.toString() ? '?' + newParams.toString() : ''}`;
                window.history.replaceState({ path: newPath }, '', newPath);
            }
        }
    }, []);

    const toggleFav = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setFavorites(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            localStorage.setItem('fav-stations', JSON.stringify([...next]));
            return next;
        });
    };

    const openNavigation = (station: Station, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!station.lat || !station.lon) {
            setError('Esta gasolinera no tiene coordenadas válidas.');
            return;
        }
        if (navPref) {
            startNavigation(station.lat, station.lon, navPref);
        } else {
            setNavTarget(station);
        }
    };

    const setAppPreference = (app: NavApp) => {
        if (rememberNav) {
            setNavPref(app);
            saveNavPref(app);
        }
        if (navTarget) {
            if (navTarget.lat && navTarget.lon) {
                startNavigation(navTarget.lat, navTarget.lon, app);
            }
            setNavTarget(null);
        }
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

                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Provincia</label>
                            <input
                                type="text"
                                className="input w-full"
                                placeholder="Ej: Madrid..."
                                value={province}
                                onChange={e => setProvince(e.target.value)}
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Municipio</label>
                            <input
                                type="text"
                                className="input w-full"
                                placeholder="Ej: Sabadell..."
                                value={city}
                                onChange={e => setCity(e.target.value)}
                            />
                        </div>
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
                                <option value="brand">Nombre Marca</option>
                                {userPos && <option value="distance">Distancia</option>}
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

                    {userPos && (
                        <div>
                            <label className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Radio de búsqueda</label>
                            <select className="select w-full font-bold text-brand-500" value={radius} onChange={e => setRadius(parseInt(e.target.value, 10))}>
                                {RADIUS_OPTIONS.map(r => <option key={r} value={r}>{r} km</option>)}
                            </select>
                        </div>
                    )}

                    <div className={`flex items-end gap-2 ${userPos ? 'lg:col-span-1' : 'lg:col-span-2'}`}>
                        <button onClick={handleSearch} className="btn-primary flex-1 h-[42px]" disabled={loading}>
                            {loading ? 'Buscando...' : 'Buscar'}
                        </button>
                        <button onClick={handleReset} className="btn-secondary h-[42px]" title="Limpiar filtros">
                            ↺
                        </button>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={handleGeo}
                            disabled={geoStatus === 'requesting'}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border-2 ${geoStatus === 'active'
                                ? 'bg-brand-500 text-white border-brand-500 shadow-lg scale-105'
                                : geoStatus === 'denied'
                                    ? 'bg-red-50 text-red-500 border-red-200'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-500'
                                }`}
                        >
                            {geoStatus === 'active' ? '📍 Cerca de mí activado' : geoStatus === 'requesting' ? '⌛ Solicitando...' : geoStatus === 'denied' ? '⚠️ Ubicación denegada' : '📍 Cerca de mí'}
                        </button>

                        <button
                            onClick={handleFindNearest}
                            disabled={geoStatus === 'requesting'}
                            className="px-4 py-2 rounded-xl text-sm font-black uppercase tracking-tight bg-slate-900 dark:bg-brand-500 text-white shadow-xl hover:scale-105 transition-all flex items-center gap-2"
                        >
                            📍 Gasolinera más cerca de mí
                        </button>

                        {geoStatus === 'denied' && (
                            <span className="text-[10px] text-muted max-w-[150px] leading-tight flex items-center gap-1">
                                <span>⚠️ Activa el GPS para buscar por cercanía.</span>
                                <button onClick={handleGeo} className="underline font-bold">Reintentar</button>
                            </span>
                        )}
                        {geoStatus === 'active' && (
                            <button onClick={() => { setUserPos(null); setGeoStatus('idle'); setNearestStation(null); }} className="text-xs font-bold text-red-500 hover:underline">Quitar ubicación</button>
                        )}

                        <button
                            onClick={() => setOnlyFavorites(prev => !prev)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border-2 ${onlyFavorites
                                ? 'bg-amber-500 text-white border-amber-500 shadow-lg scale-105'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-500'
                                }`}
                            title={onlyFavorites ? 'Mostrar todas las estaciones' : 'Filtrar por tus estaciones favoritas'}
                        >
                            {onlyFavorites ? '⭐ Solo favoritas activado' : '⭐ Solo favoritas'}
                        </button>
                    </div>

                    {total > 0 && (
                        <p className="text-sm text-muted">
                            Encontradas <strong>{total}</strong> estaciones
                        </p>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2 animate-shake">
                    <span>⚠️</span> {error}
                </div>
            )}

            {/* Nearest Station Hero */}
            {nearestStation && (
                <div className="animate-fade-in bg-gradient-to-r from-brand-50 to-brand-100 dark:from-slate-800 dark:to-slate-900 border-2 border-brand-500 p-6 rounded-3xl shadow-2xl mb-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="text-8xl">📍</span>
                    </div>
                    <div className="relative z-10">
                        <span className="inline-block px-3 py-1 bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full mb-4 shadow-lg shadow-brand-500/30">
                            ✨ ¡La gasolinera más cercana!
                        </span>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <h2 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none mb-2">
                                    {nearestStation.name || nearestStation.brand}
                                </h2>
                                <p className="text-slate-600 dark:text-slate-400 font-bold flex items-center gap-2">
                                    <span>🏙️</span> {nearestStation.address} ({nearestStation.municipality}, {nearestStation.province})
                                </p>
                                <div className="flex gap-4 mt-4">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-muted font-black uppercase tracking-widest">Distancia</span>
                                        <span className="text-2xl font-black text-brand-500">{nearestStation.distKm?.toFixed(1)} <small className="text-sm">km</small></span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-muted font-black uppercase tracking-widest">Precio {fuel}</span>
                                        <span className="text-2xl font-black text-slate-800 dark:text-white">{fmt(nearestStation.prices[fuel === 'dieselA' ? 'dieselA' : fuel as keyof typeof nearestStation.prices])}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => openNavigation(nearestStation)}
                                    className="px-8 py-4 min-h-[44px] bg-brand-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-brand-500/20 hover:scale-105 active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
                                >
                                    🧭 Cómo llegar ahora
                                </button>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            if (nearestStation.lat && nearestStation.lon) {
                                                startNavigation(nearestStation.lat, nearestStation.lon, 'maps');
                                            }
                                        }}
                                        className="p-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-brand-500 transition-all shadow-md"
                                        title="Abrir en Google Maps"
                                    >
                                        🗺️
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (nearestStation.lat && nearestStation.lon) {
                                                startNavigation(nearestStation.lat, nearestStation.lon, 'waze');
                                            }
                                        }}
                                        className="p-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-brand-500 transition-all shadow-md"
                                        title="Abrir en Waze"
                                    >
                                        🚙
                                    </button>
                                </div>
                                <button
                                    onClick={() => {
                                        setNearestStation(null);
                                        scrollToString(nearestStation.id);
                                    }}
                                    className="px-6 py-3 min-h-[44px] bg-white dark:bg-slate-800 text-slate-700 dark:text-white border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-black uppercase tracking-widest hover:border-brand-500 transition-all text-xs flex items-center justify-center gap-2"
                                >
                                    Ver en lista
                                </button>
                                <button onClick={() => setNearestStation(null)} className="text-xs font-bold text-muted hover:text-red-500 text-center px-2">Cerrar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Results */}
            <div className="min-h-[400px] relative" ref={resultsRef}>
                {loading && stations.length === 0 && (
                    <div className="grid grid-cols-1 gap-4">
                        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-36 w-full rounded-2xl" />)}
                    </div>
                )}

                {stations.length > 0 ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                            {stations
                                .filter(s => !onlyFavorites || favorites.has(s.id))
                                .map(s => (
                                    <div
                                        key={s.id}
                                        id={`station-${s.id}`}
                                        className={`card p-5 flex flex-col sm:flex-row gap-5 transition-all group ${highlightedId === s.id ? 'border-brand-500 ring-2 ring-brand-500/20 bg-brand-50/30' : 'hover:border-brand-500'} hover:shadow-xl active:scale-[0.99]`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div>
                                                    <h3 className="font-bold text-xl group-hover:text-brand-500 transition-colors uppercase tracking-tight">{s.name || s.brand}</h3>
                                                    <p className="text-sm text-muted mt-1 font-medium">{s.address}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => toggleFav(s.id, e)}
                                                        className={`p-2 rounded-xl border transition-all ${favorites.has(s.id) ? 'bg-amber-50 border-amber-200 grayscale-0' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700 grayscale opacity-40 hover:opacity-100'}`}
                                                    >
                                                        ⭐
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted font-bold mt-4">
                                                <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">🏙️ {s.municipality}</span>
                                                {s.schedule && <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">🕐 {s.schedule}</span>}
                                                {s.distKm !== null && (
                                                    <span className="flex items-center gap-1.5 px-2 py-1 bg-brand-50 text-brand-600 rounded-lg">📍 {s.distKm.toFixed(1)} km</span>
                                                )}
                                            </div>

                                            {/* Variation Block */}
                                            <div className="mt-5">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="h-[1px] flex-1 bg-slate-100 dark:bg-slate-800"></div>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Variación hoy</span>
                                                    <div className="h-[1px] flex-1 bg-slate-100 dark:bg-slate-800"></div>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {Object.entries(s.prices).map(([fKey, currentPrice]) => {
                                                        if (!currentPrice) return null;
                                                        const change = priceChanges.find(c => c.stationId === s.id && c.fuelCode === fKey);
                                                        if (!change) return null;

                                                        const isDown = change.direction === 'down';
                                                        const colorClass = isDown ? 'text-green-600 bg-green-50/50 dark:bg-green-500/10' : 'text-red-600 bg-red-50/50 dark:bg-red-500/10';

                                                        return (
                                                            <div key={fKey} className={`flex flex-col px-2 py-1 rounded-lg border border-current/10 transition-all hover:scale-105 ${colorClass}`}>
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <span className="text-[8px] font-black uppercase tracking-tight opacity-70">
                                                                        {fKey === 'dieselA' ? 'DSL A' : fKey}
                                                                    </span>
                                                                    <span className="text-[9px] font-black font-mono">{isDown ? '↓' : '↑'} {Math.abs(change.delta).toFixed(3)}€</span>
                                                                </div>
                                                                <div className="text-[8px] font-bold opacity-60 text-right leading-none mt-0.5">
                                                                    {isDown ? '-' : '+'}{Math.abs((change.delta / change.oldPrice) * 100).toFixed(1)}%
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {Object.entries(s.prices).every(([fk]) => !priceChanges.some(c => c.stationId === s.id && c.fuelCode === fk)) && (
                                                        <div className="w-full text-center py-1">
                                                            <span className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest italic">Estable · Sin cambios</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-4 justify-center items-end min-w-[200px]">
                                            <div className="flex flex-wrap sm:flex-nowrap gap-3 items-center w-full sm:w-auto">
                                                {/* Main price highlighted if selected */}
                                                {fuel && s.prices[fuel === 'dieselA' ? 'dieselA' : fuel as keyof typeof s.prices] !== null && (
                                                    <div className="bg-brand-500 text-white rounded-xl px-5 py-3 text-center flex-1 sm:flex-none shadow-lg shadow-brand-500/20">
                                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{fuel}</p>
                                                        <p className="text-2xl font-black font-mono leading-none">
                                                            {fmt(s.prices[fuel === 'dieselA' ? 'dieselA' : fuel as keyof typeof s.prices])}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Other prices compact */}
                                                <div className="grid grid-cols-2 gap-2 flex-1 sm:flex-none">
                                                    {Object.entries(s.prices)
                                                        .filter(([key, val]) => val !== null && (fuel ? key !== fuel : true))
                                                        .slice(0, 2)
                                                        .map(([key, val]) => (
                                                            <div key={key} className="bg-slate-100 dark:bg-slate-800/80 rounded-xl px-3 py-1.5 text-center min-w-[70px] border border-transparent">
                                                                <p className="text-[8px] font-black text-muted uppercase tracking-tighter">{key === 'dieselA' ? 'DSL A' : key}</p>
                                                                <p className="text-xs font-black font-mono">{fmt(val as number)}</p>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                            <div className="w-full sm:w-auto flex flex-col items-center sm:items-end gap-3">
                                                <div className="flex w-full sm:w-auto gap-2">
                                                    <button
                                                        onClick={(e) => openNavigation(s, e)}
                                                        disabled={!s.lat || !s.lon}
                                                        className={`flex-1 sm:flex-none px-6 py-2.5 min-h-[44px] rounded-xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-500/10 ${!s.lat || !s.lon
                                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                            : 'bg-brand-500 text-white hover:scale-105 active:scale-95'
                                                            }`}
                                                    >
                                                        <span>🧭</span> {!s.lat || !s.lon ? 'Ubicación no disponible' : 'Cómo llegar'}
                                                    </button>

                                                    {s.lat && s.lon && (
                                                        <div className="flex gap-1.5">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); startNavigation(s.lat!, s.lon!, 'maps'); }}
                                                                className="p-2.5 min-w-[44px] min-h-[44px] bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl hover:border-brand-500 transition-all shadow-sm flex items-center justify-center text-xl"
                                                                title="Google Maps"
                                                            >
                                                                🗺️
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); startNavigation(s.lat!, s.lon!, 'waze'); }}
                                                                className="p-2.5 min-w-[44px] min-h-[44px] bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl hover:border-brand-500 transition-all shadow-sm flex items-center justify-center text-xl"
                                                                title="Waze"
                                                            >
                                                                🚙
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {navPref && (
                                                    <div className="hidden sm:block text-[8px] font-black text-muted uppercase tracking-widest opacity-60">
                                                        Preferencia: {navPref === 'waze' ? '🚙 Waze' : '🗺️ Maps'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </div>

                        {stations.length < total && (
                            <div className="pt-6 flex justify-center">
                                <button
                                    onClick={() => fetchStations(true)}
                                    className="btn-secondary px-10 py-4 font-black uppercase tracking-widest bg-white dark:bg-slate-900 shadow-xl border-2 border-slate-200 dark:border-slate-800 hover:border-brand-500 transition-all"
                                    disabled={loadingMore}
                                >
                                    {loadingMore ? '⌛ Cargando...' : `Más gasolineras (${total - stations.length})`}
                                </button>
                            </div>
                        )}
                    </div>
                ) : !loading && (
                    <div className="card-flat p-12 text-center text-muted animate-fade-in flex flex-col items-center">
                        {onlyFavorites ? (
                            <>
                                <div className="text-7xl mb-6">⭐</div>
                                <h3 className="text-2xl font-black mb-2 text-slate-800 dark:text-white uppercase tracking-tight">Todavía no tienes gasolineras favoritas</h3>
                                <p className="text-slate-500 max-w-sm mx-auto mb-8 font-medium">Pulsa la estrella de una gasolinera para guardarla aquí.</p>
                                <button
                                    onClick={() => setOnlyFavorites(false)}
                                    className="btn-brand px-8 py-3 rounded-2xl shadow-xl hover:scale-105 transition-all text-sm font-black uppercase tracking-widest"
                                >
                                    Ver todas las gasolineras
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="text-6xl mb-4">🔍</div>
                                <h3 className="text-xl font-bold mb-2 text-slate-700 dark:text-slate-300">No hay resultados</h3>
                                <p>Intenta ajustar los filtros de búsqueda o cambia la ubicación.</p>
                                <button onClick={handleReset} className="mt-6 text-brand-500 font-bold hover:underline">
                                    Limpiar todos los filtros
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Navigation Drawer / Modal */}
            {navTarget && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 animate-fade-in">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setNavTarget(null)}></div>
                    <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden animate-slide-up sm:animate-scale-in">
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight leading-tight">¿Cómo quieres llegar?</h3>
                                    <p className="text-sm text-muted font-medium mt-1">{navTarget.name || navTarget.brand}</p>
                                </div>
                                <button onClick={() => setNavTarget(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-xl">✕</button>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <button
                                    onClick={() => setAppPreference('maps')}
                                    className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 hover:border-brand-500 transition-all group"
                                >
                                    <span className="text-3xl">🗺️</span>
                                    <div className="text-left">
                                        <p className="font-bold text-slate-800 dark:text-white">Google Maps</p>
                                        <p className="text-xs text-muted">Abre la aplicación de Google</p>
                                    </div>
                                    <span className="ml-auto text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                                </button>

                                <button
                                    onClick={() => setAppPreference('waze')}
                                    className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 hover:border-brand-500 transition-all group"
                                >
                                    <span className="text-3xl">🚙</span>
                                    <div className="text-left">
                                        <p className="font-bold text-slate-800 dark:text-white">Waze</p>
                                        <p className="text-xs text-muted">Navegación con tráfico real</p>
                                    </div>
                                    <span className="ml-auto text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                                </button>
                            </div>

                            <div className="mt-6 flex items-center justify-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={rememberNav}
                                        onChange={e => setRememberNav(e.target.checked)}
                                        className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 text-brand-500 focus:ring-brand-500"
                                    />
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">Recordar mi elección</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {navPref && navTarget === null && (
                <button
                    onClick={() => { setNavPref(null); localStorage.removeItem(NAV_PREF_KEY); }}
                    className="fixed bottom-6 right-6 z-50 bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs font-bold text-muted hover:text-brand-500 transition-all hover:scale-110 group animate-fade-in"
                    title="Cambiar preferencia de mapas"
                >
                    <span className="text-xl group-hover:rotate-12 transition-transform">{navPref === 'maps' ? '🗺️' : '🚙'}</span>
                    <div className="text-left leading-tight hidden sm:block">
                        <p className="text-[10px] opacity-70 uppercase tracking-tighter">App favorita</p>
                        <p>{navPref === 'maps' ? 'Google Maps' : 'Waze'}</p>
                    </div>
                    <span className="ml-1 opacity-40">✕</span>
                </button>
            )}

        </div >
    );
}
