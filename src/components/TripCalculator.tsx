'use client';
import { useState } from 'react';

interface ApiSummary {
    sp95?: { today: number | null };
    dieselA?: { today: number | null };
}

interface Props {
    summary: ApiSummary | null;
}

const PRESETS = [
    { label: 'Económico (5 L/100)', value: 5.0 },
    { label: 'Híbrido (6 L/100)', value: 6.0 },
    { label: 'Medio (8 L/100)', value: 8.0 },
    { label: 'SUV (10 L/100)', value: 10.0 },
    { label: 'Deportivo (13 L/100)', value: 13.0 },
    { label: 'Manual', value: -1 },
];

export default function TripCalculator({ summary }: Props) {
    const [fuel, setFuel] = useState<'sp95' | 'diesel_a'>('sp95');
    const [priceMode, setPriceMode] = useState<'avg' | 'custom'>('avg');
    const [customPrice, setCustomPrice] = useState('');
    const [km, setKm] = useState('');
    const [preset, setPreset] = useState(6.0);
    const [consumption, setConsumption] = useState('');

    const avgPrice = fuel === 'sp95' ? (summary?.sp95?.today ?? null) : (summary?.dieselA?.today ?? null);
    const activePrice = priceMode === 'avg' ? avgPrice : parseFloat(customPrice) || null;
    const activeConsumption = preset === -1 ? parseFloat(consumption) || null : preset;
    const kmNum = parseFloat(km) || null;

    const cost = (activePrice && activeConsumption && kmNum)
        ? (kmNum / 100) * activeConsumption * activePrice
        : null;
    const costPer100 = (activePrice && activeConsumption)
        ? activeConsumption * activePrice
        : null;
    const costAvg = (avgPrice && activeConsumption && kmNum && priceMode === 'custom')
        ? (kmNum / 100) * activeConsumption * avgPrice
        : null;

    const fuelLabel = fuel === 'sp95' ? 'Gasolina 95' : 'Gasóleo A';
    const fuelColor = fuel === 'sp95' ? '#6366f1' : '#f59e0b';

    return (
        <div className="card p-5 sm:p-6 max-w-2xl mx-auto">
            <div className="grid gap-6 sm:grid-cols-2">
                {/* Left: inputs */}
                <div className="space-y-5">
                    {/* Fuel selector */}
                    <div>
                        <label className="block text-sm font-semibold mb-2">Combustible</label>
                        <div className="flex gap-2">
                            {(['sp95', 'diesel_a'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFuel(f)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${fuel === f ? 'text-white border-transparent' : 'btn-secondary'
                                        }`}
                                    style={fuel === f ? { background: fuelColor } : {}}
                                    aria-pressed={fuel === f}
                                >
                                    {f === 'sp95' ? '⛽ Gasolina 95' : '🚛 Gasóleo A'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Price mode */}
                    <div>
                        <label className="block text-sm font-semibold mb-2">Precio</label>
                        <div className="flex gap-2 mb-3">
                            <button
                                onClick={() => setPriceMode('avg')}
                                className={`flex-1 py-2 rounded-lg text-sm border transition-all ${priceMode === 'avg' ? 'btn-primary' : 'btn-secondary'}`}
                                aria-pressed={priceMode === 'avg'}
                            >
                                Media nacional ({avgPrice ? avgPrice.toFixed(3) + '€' : '—'})
                            </button>
                            <button
                                onClick={() => setPriceMode('custom')}
                                className={`flex-1 py-2 rounded-lg text-sm border transition-all ${priceMode === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                                aria-pressed={priceMode === 'custom'}
                            >
                                Mi precio
                            </button>
                        </div>
                        {priceMode === 'custom' && (
                            <input
                                type="number"
                                className="input"
                                placeholder="Ej: 1.459"
                                step="0.001"
                                min="0"
                                value={customPrice}
                                onChange={e => setCustomPrice(e.target.value)}
                                aria-label="Tu precio por litro"
                            />
                        )}
                    </div>

                    {/* Km */}
                    <div>
                        <label className="block text-sm font-semibold mb-2" htmlFor="km-input">Kilómetros del viaje</label>
                        <input
                            id="km-input"
                            type="number"
                            className="input"
                            placeholder="Ej: 250"
                            min="1"
                            value={km}
                            onChange={e => setKm(e.target.value)}
                        />
                    </div>

                    {/* Consumption */}
                    <div>
                        <label className="block text-sm font-semibold mb-2">Consumo</label>
                        <select
                            className="select"
                            value={preset}
                            onChange={e => setPreset(parseFloat(e.target.value))}
                            aria-label="Consumo del vehículo"
                        >
                            {PRESETS.map(p => (
                                <option key={p.label} value={p.value}>{p.label}</option>
                            ))}
                        </select>
                        {preset === -1 && (
                            <input
                                type="number"
                                className="input mt-2"
                                placeholder="Consumo L/100km"
                                step="0.1"
                                min="1"
                                value={consumption}
                                onChange={e => setConsumption(e.target.value)}
                                aria-label="Consumo manual en litros por 100km"
                            />
                        )}
                    </div>
                </div>

                {/* Right: results */}
                <div className="flex flex-col justify-center gap-4">
                    <div
                        className="rounded-xl p-5 text-center"
                        style={{ background: `${fuelColor}15`, border: `1.5px solid ${fuelColor}40` }}
                    >
                        <p className="text-sm text-muted mb-1">Coste estimado del viaje</p>
                        <p className="text-4xl font-bold font-mono" style={{ color: fuelColor }}>
                            {cost !== null ? cost.toFixed(2) + ' €' : '—'}
                        </p>
                        {kmNum && <p className="text-xs text-muted mt-1">{kmNum.toFixed(0)} km · {fuelLabel}</p>}
                    </div>

                    <div className="card-flat p-4 text-center">
                        <p className="text-xs text-muted mb-1">Coste por 100 km</p>
                        <p className="text-2xl font-bold font-mono">
                            {costPer100 !== null ? costPer100.toFixed(2) + ' €' : '—'}
                        </p>
                    </div>

                    {costAvg !== null && cost !== null && (
                        <div className="card-flat p-4 text-center">
                            <p className="text-xs text-muted mb-1">Vs. precio medio nacional</p>
                            <p className={`text-xl font-bold font-mono ${cost - costAvg > 0 ? 'price-up' : 'price-down'}`}>
                                {cost > costAvg ? '+' : ''}{(cost - costAvg).toFixed(2)} €
                            </p>
                            <p className="text-xs text-muted">
                                {cost > costAvg ? 'Más caro que la media' : 'Más barato que la media'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
