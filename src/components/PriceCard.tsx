'use client';
import { useState, useEffect } from 'react';
import SparkLine from './SparkLine';

interface PriceData {
    today: number | null;
    yesterday: number | null;
    delta: number | null;
    deltaPct: number | null;
    count: number;
}

interface Props {
    label: string;
    icon: string;
    fuelKey: string;
    data: PriceData | null;
    sparkData?: { date: string; price: number }[];
    color?: string;
    loading?: boolean;
}

function fmt(p: number | null): string {
    if (p === null) return '—';
    return p.toFixed(3) + ' €/L';
}

function deltaClass(d: number | null): string {
    if (d === null || d === 0) return 'price-even';
    return d > 0 ? 'price-up' : 'price-down';
}

function deltaText(delta: number | null, pct: number | null): string {
    if (delta === null) return '';
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta.toFixed(4)} € (${sign}${pct?.toFixed(2) ?? '0.00'}%)`;
}

export default function PriceCard({ label, icon, fuelKey, data, sparkData, color = '#2aa5ff', loading }: Props) {
    if (loading) {
        return (
            <div className="card p-5 sm:p-6">
                <div className="skeleton h-5 w-24 mb-3" />
                <div className="skeleton h-9 w-32 mb-2" />
                <div className="skeleton h-4 w-20" />
            </div>
        );
    }

    const d = data?.delta ?? null;

    return (
        <div className="card p-5 sm:p-6 flex flex-col gap-3 group">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-2xl" aria-hidden="true">{icon}</span>
                    <span className="font-semibold text-sm text-muted">{label}</span>
                </div>
                {sparkData && sparkData.length > 1 && (
                    <SparkLine data={sparkData} color="trend" height={36} width={80} />
                )}
            </div>

            <div>
                <p
                    className="text-3xl font-bold font-mono tracking-tight"
                    aria-label={`Precio hoy: ${fmt(data?.today ?? null)}`}
                >
                    {fmt(data?.today ?? null)}
                </p>
                <p className="text-xs text-muted mt-0.5">
                    Ayer: <span className="font-medium">{fmt(data?.yesterday ?? null)}</span>
                </p>
            </div>

            {d !== null && (
                <div className={`flex items-center gap-1.5 text-sm font-semibold ${deltaClass(d)}`} aria-live="polite">
                    <span aria-hidden="true">{d > 0 ? '▲' : d < 0 ? '▼' : '→'}</span>
                    <span>{deltaText(d, data?.deltaPct ?? null)}</span>
                </div>
            )}

            <p className="text-xs text-muted mt-auto">
                {data?.count ? `${data.count.toLocaleString('es-ES')} gasolineras` : 'Sin datos'}
            </p>
        </div>
    );
}
