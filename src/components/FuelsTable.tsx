'use client';
import { useState } from 'react';

interface Fuel {
    key: string;
    label: string;
    today: number | null;
    yesterday: number | null;
    minHist: number | null;
    minDate: string | null;
    maxHist: number | null;
    maxDate: string | null;
}

interface Props {
    fuels: Fuel[];
    loading: boolean;
}

function fmt(p: number | null): string {
    if (p === null) return '—';
    return p.toFixed(3) + ' €';
}

function delta(today: number | null, yesterday: number | null) {
    if (today === null || yesterday === null) return null;
    return +(today - yesterday).toFixed(4);
}

export default function FuelsTable({ fuels, loading }: Props) {
    const [sortField, setSortField] = useState<'label' | 'today' | 'yesterday'>('label');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const toggle = (f: typeof sortField) => {
        if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(f); setSortDir('asc'); }
    };

    const sorted = [...fuels].sort((a, b) => {
        let va: string | number = sortField === 'label' ? a.label : (a[sortField] ?? -1);
        let vb: string | number = sortField === 'label' ? b.label : (b[sortField] ?? -1);
        if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
        return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });

    const Th = ({ field, label }: { field: typeof sortField; label: string }) => (
        <th
            className="cursor-pointer select-none hover:text-brand-500 transition-colors"
            onClick={() => toggle(field)}
            aria-sort={sortField === field ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
            {label} {sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </th>
    );

    if (loading) {
        return (
            <div className="table-container">
                <div className="skeleton h-48 rounded-xl" />
            </div>
        );
    }

    return (
        <div className="table-container" role="region" aria-label="Tabla de combustibles">
            <table className="data-table">
                <thead>
                    <tr>
                        <Th field="label" label="Combustible" />
                        <Th field="today" label="Hoy (€/L)" />
                        <Th field="yesterday" label="Ayer (€/L)" />
                        <th>Variación</th>
                        <th>Mín. Histórico</th>
                        <th>Máx. Histórico</th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map(f => {
                        const d = delta(f.today, f.yesterday);
                        const dClass = d === null ? '' : d > 0 ? 'price-up' : d < 0 ? 'price-down' : 'price-even';
                        return (
                            <tr key={f.key}>
                                <td className="font-medium">{f.label}</td>
                                <td className="font-mono font-semibold">{fmt(f.today)}</td>
                                <td className="font-mono text-muted">{fmt(f.yesterday)}</td>
                                <td className={`font-mono font-semibold ${dClass}`}>
                                    {d !== null ? `${d > 0 ? '+' : ''}${d.toFixed(4)}` : '—'}
                                </td>
                                <td className="font-mono text-emerald-600 dark:text-emerald-400 text-xs">
                                    {fmt(f.minHist)}{f.minDate && <span className="text-muted ml-1">({f.minDate})</span>}
                                </td>
                                <td className="font-mono text-red-600 dark:text-red-400 text-xs">
                                    {fmt(f.maxHist)}{f.maxDate && <span className="text-muted ml-1">({f.maxDate})</span>}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
