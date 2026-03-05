'use client';
import { useState } from 'react';

interface City {
    city: string;
    province: string;
    sp95: number | null;
    dieselA: number | null;
    stationCount: number;
}

interface Props {
    cities: City[];
    loading: boolean;
}

type SortField = 'city' | 'sp95' | 'dieselA' | 'stationCount';

function fmt(p: number | null): string {
    if (p === null) return '—';
    return p.toFixed(3) + ' €';
}

export default function CitiesTable({ cities, loading }: Props) {
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<SortField>('sp95');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const toggle = (f: SortField) => {
        if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(f); setSortDir('asc'); }
    };

    const filtered = cities.filter(c =>
        c.city.toLowerCase().includes(search.toLowerCase()) ||
        c.province.toLowerCase().includes(search.toLowerCase())
    );

    const sorted = [...filtered].sort((a, b) => {
        const va = a[sortField] ?? -1;
        const vb = b[sortField] ?? -1;
        if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
        return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });

    const Th = ({ field, label }: { field: SortField; label: string }) => (
        <th
            className="cursor-pointer select-none hover:text-brand-500 transition-colors"
            onClick={() => toggle(field)}
            aria-sort={sortField === field ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
            {label} {sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </th>
    );

    if (loading) {
        return <div className="skeleton h-48 rounded-xl" />;
    }

    return (
        <div>
            <div className="mb-4">
                <input
                    type="search"
                    placeholder="Buscar ciudad o provincia…"
                    className="input max-w-xs"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    aria-label="Filtrar ciudades"
                />
            </div>
            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <Th field="city" label="Ciudad" />
                            <th className="hidden sm:table-cell">Provincia</th>
                            <Th field="sp95" label="Gasolina 95" />
                            <Th field="dieselA" label="Gasóleo A" />
                            <Th field="stationCount" label="Gasolineras" />
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((c, i) => (
                            <tr key={c.city}>
                                <td className="text-muted text-xs">{i + 1}</td>
                                <td className="font-semibold">{c.city}</td>
                                <td className="hidden sm:table-cell text-muted text-sm">{c.province}</td>
                                <td className="font-mono text-indigo-600 dark:text-indigo-400">{fmt(c.sp95)}</td>
                                <td className="font-mono text-amber-600 dark:text-amber-400">{fmt(c.dieselA)}</td>
                                <td className="text-muted text-sm">{c.stationCount}</td>
                            </tr>
                        ))}
                        {sorted.length === 0 && (
                            <tr>
                                <td colSpan={6} className="text-center text-muted py-8">No se encontraron ciudades</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
