'use client';
import { useState, useEffect, useCallback } from 'react';

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
    showing: number;
    stations: Station[];
}

type FuelFilter = 'sp95' | 'diesel_a' | 'sp98' | '';
type SortMode = 'price' | 'distance' | 'brand';

const BRAND_LIST = ['Repsol', 'Cepsa', 'Moeve', 'BP', 'Shell', 'Galp', 'Plenoil', 'Ballenoil', 'Petroprix', 'Alcampo'];

function fmt(p: number | null): string {
    if (p === null) return '—';
    return p.toFixed(3) + '€';
}

export default function StationFinder() {
    const [mode, setMode] = useState<'geo' | 'city'>('city');
    const [query, setQuery] = useState('');
    const [city, setCity] = useState('');
    const [fuel, setFuel] = useState<FuelFilter>('sp95');
    const [brand, setBrand] = useState('');
    const [sort, setSort] = useState<SortMode>('price');
    const [results, setResults] = useState<ApiResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'ok' | 'denied'>('idle');
    const [userPos, setUserPos] = useState<{ lat: number; lon: number } | null>(null);
    const [favorites, setFavorites] = useState<Set<string>>(() => {
        try { return new Set(JSON.parse(localStorage.getItem('fav-stations') ?? '[]')); } catch { return new Set(); }
    });

    const search = useCallback(async (params: Record<string, string>) => {
        setLoading(true);
        setError(null);
        try {
            const qs = new URLSearchParams({ limit: '30', ...params }).toString();
            const res = await fetch(`/api/stations/search?${qs}`);
            if (!res.ok) throw new Error('Error al buscar gasolineras');
            setResults(await res.json());
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleGeo = () => {
        setGeoStatus('loading');
        navigator.geolocation.getCurrentPosition(
            pos => {
                const lat = pos.coords.latitude, lon = pos.coords.longitude;
                setUserPos({ lat, lon });
                setGeoStatus('ok');
                setMode('geo');
                search({ lat: String(lat), lon: String(lon), radius: '10', fuel, brand, sort });
            },
            () => setGeoStatus('denied'),
            { timeout: 8000 }
        );
    };

    const handleSearch = () => {
        if (mode === 'geo' && userPos) {
            search({ lat: String(userPos.lat), lon: String(userPos.lon), radius: '10', fuel, brand, sort });
        } else {
            search({ q: query, city, fuel, brand, sort });
        }
    };

    const toggleFav = (id: string) => {
        setFavorites(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            localStorage.setItem('fav-stations', JSON.stringify([...next]));
            return next;
        });
    };

    const fuelKey = fuel === 'diesel_a' ? 'dieselA' : (fuel || 'sp95') as keyof Station['prices'];

    return (
        <div className="space-y-6">
            {/* Search controls */}
            <div className="card p-5">
                <div className="flex flex-wrap gap-3 mb-4">
                    <button
                        onClick={() => { setMode('city'); setGeoStatus('idle'); }}
                        className={mode === 'city' ? 'btn-primary' : 'btn-secondary'}
                        aria-pressed={mode === 'city'}
                    >
                        🏙️ Por ciudad
                    </button>
                    <button
                        onClick={handleGeo}
                        className={mode === 'geo' ? 'btn-primary' : 'btn-secondary'}
                        aria-pressed={mode === 'geo'}
                        disabled={geoStatus === 'loading'}
                    >
                        {geoStatus === 'loading' ? '⌛ Buscando…' : geoStatus === 'denied' ? '🚫 Sin permiso' : '📍 Mi ubicación'}
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    {mode === 'city' && (
                        <>
                            <input
                                type="search"
                                className="input"
                                placeholder="Buscar ciudad, CP, marca…"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                aria-label="Buscar gasolinera"
                            />
                            <input
                                type="text"
                                className="input"
                                placeholder="Ciudad / municipio"
                                value={city}
                                onChange={e => setCity(e.target.value)}
                                aria-label="Filtrar por ciudad"
                            />
                        </>
                    )}
                    <select className="select" value={fuel} onChange={e => setFuel(e.target.value as FuelFilter)} aria-label="Combustible">
                        <option value="">Cualquier combustible</option>
                        <option value="sp95">Gasolina 95</option>
                        <option value="diesel_a">Gasóleo A</option>
                        <option value="sp98">Gasolina 98</option>
                    </select>
                    <select className="select" value={brand} onChange={e => setBrand(e.target.value)} aria-label="Marca">
                        <option value="">Cualquier marca</option>
                        {BRAND_LIST.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <select className="select" value={sort} onChange={e => setSort(e.target.value as SortMode)} aria-label="Ordenar por">
                        <option value="price">Precio más bajo</option>
                        <option value="distance">Distancia</option>
                        <option value="brand">Marca A-Z</option>
                    </select>
                </div>

                <button onClick={handleSearch} className="btn-primary" disabled={loading}>
                    {loading ? '⌛ Buscando…' : '🔍 Buscar gasolineras'}
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="card-flat p-4 border-red-300 dark:border-red-800 text-red-600 dark:text-red-400">
                    ⚠️ {error}
                </div>
            )}

            {/* Results */}
            {results && (
                <div>
                    <p className="text-sm text-muted mb-3">
                        Mostrando <strong>{results.showing}</strong> de <strong>{results.total}</strong> gasolineras
                    </p>
                    <div className="space-y-3">
                        {results.stations.map(s => (
                            <div key={s.id} className="card p-4 flex flex-col sm:flex-row gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <h3 className="font-semibold truncate">{s.name || s.brand}</h3>
                                        <button
                                            onClick={() => toggleFav(s.id)}
                                            className="text-lg shrink-0 transition-transform hover:scale-110"
                                            aria-label={favorites.has(s.id) ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                                            title={favorites.has(s.id) ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                                        >
                                            {favorites.has(s.id) ? '⭐' : '☆'}
                                        </button>
                                    </div>
                                    <p className="text-sm text-muted truncate">{s.address}, {s.municipality}</p>
                                    {s.schedule && <p className="text-xs text-muted mt-0.5">🕐 {s.schedule}</p>}
                                    {s.distKm !== null && (
                                        <p className="text-xs text-brand-500 mt-0.5">📍 {s.distKm.toFixed(1)} km</p>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-3 shrink-0">
                                    {s.prices.sp95 !== null && <PriceBadge label="SP95" price={s.prices.sp95} color="#6366f1" />}
                                    {s.prices.dieselA !== null && <PriceBadge label="Diesel" price={s.prices.dieselA} color="#f59e0b" />}
                                    {s.prices.sp98 !== null && <PriceBadge label="SP98" price={s.prices.sp98} color="#8b5cf6" />}
                                    {s.prices.glp !== null && <PriceBadge label="GLP" price={s.prices.glp} color="#10b981" />}
                                    {s.prices.gnc !== null && <PriceBadge label="GNC" price={s.prices.gnc} color="#3b82f6" />}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {results?.showing === 0 && (
                <div className="card-flat p-8 text-center text-muted">
                    <p className="text-4xl mb-3">🔍</p>
                    <p>No se encontraron gasolineras con esos filtros.</p>
                </div>
            )}
        </div>
    );
}

function PriceBadge({ label, price, color }: { label: string; price: number; color: string }) {
    return (
        <div className="text-center rounded-lg px-3 py-2 min-w-[64px]" style={{ background: `${color}18`, border: `1px solid ${color}40` }}>
            <p className="text-[10px] font-semibold text-muted">{label}</p>
            <p className="text-sm font-bold font-mono" style={{ color }}>{price.toFixed(3)}€</p>
        </div>
    );
}
