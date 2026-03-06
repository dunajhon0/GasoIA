export type Fuel = 'sp95' | 'sp98' | 'diesel_a' | 'diesel_a_plus' | 'diesel_b' | 'diesel_c' | 'biodiesel' | 'glp' | 'gnc';

export interface FuelMeta {
    label: string;
    color: string;
    field: string;
}

export const FUEL_MAP: Record<Fuel, FuelMeta> = {
    'sp95': { label: 'Gasolina 95 (SP95)', color: '#6366f1', field: 'sp95' },
    'diesel_a': { label: 'Gasóleo A (Diesel)', color: '#f59e0b', field: 'dieselA' },
    'sp98': { label: 'Gasolina 98 (SP98)', color: '#8b5cf6', field: 'sp98' },
    'diesel_a_plus': { label: 'Gasóleo A+ (Diesel+)', color: '#ea580c', field: 'dieselAPlus' },
    'glp': { label: 'GLP', color: '#10b981', field: 'glp' },
    'gnc': { label: 'GNC', color: '#3b82f6', field: 'gnc' },
    'diesel_b': { label: 'Gasóleo B (Agrícola)', color: '#94a3b8', field: 'dieselB' },
    'diesel_c': { label: 'Gasóleo C (Calefacción)', color: '#64748b', field: 'dieselC' },
    'biodiesel': { label: 'Biodiesel', color: '#84cc16', field: 'biodiesel' },
};

export const FUEL_ALIASES: Record<string, Fuel> = {
    'sp95': 'sp95',
    ' gasolina 95 ': 'sp95',
    ' gasolina 95 (sp95) ': 'sp95',
    ' gasolina 95 e5 ': 'sp95',
    '95': 'sp95',
    'diesel_a': 'diesel_a',
    ' gasoleo a ': 'diesel_a',
    ' gasóleo a ': 'diesel_a',
    ' diesel ': 'diesel_a',
    'sp98': 'sp98',
    ' gasolina 98 ': 'sp98',
    ' gasolina 98 (sp98) ': 'sp98',
    ' gasolina 98 e5 ': 'sp98',
    '98': 'sp98',
    'diesel_a_plus': 'diesel_a_plus',
    ' gasoleo a+ ': 'diesel_a_plus',
    ' gasóleo a+ ': 'diesel_a_plus',
    ' diesel+ ': 'diesel_a_plus',
    ' gasoleo premium ': 'diesel_a_plus',
    ' glp ': 'glp',
    ' gnc ': 'gnc',
    ' gas natural comprimido ': 'gnc',
    ' diesel_b ': 'diesel_b',
    ' gasoleo b ': 'diesel_b',
    ' gasóleo b ': 'diesel_b',
    ' diesel_c ': 'diesel_c',
    ' gasoleo c ': 'diesel_c',
    ' gasóleo c ': 'diesel_c',
    ' biodiesel ': 'biodiesel',
};

export function normalizeFuel(input: string): Fuel | null {
    if (!input) return null;
    const clean = input.toLowerCase().trim();
    if (FUEL_MAP[clean as Fuel]) return clean as Fuel;

    // Check aliases
    for (const [alias, key] of Object.entries(FUEL_ALIASES)) {
        if (clean.includes(alias.trim()) || alias.trim().includes(clean)) {
            return key;
        }
    }
    return null;
}
