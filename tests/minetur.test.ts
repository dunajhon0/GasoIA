/**
 * Unit tests: MINETUR data parsing + aggregation
 */
import { describe, it, expect } from 'vitest';
import {
    normalizeStation,
    calcAvg,
    calcMin,
    calcMax,
    haversineKm,
    filterPeninsula,
    filterBaleares,
    filterCanarias,
} from '../worker/lib/minetur';
import type { RawStation } from '../worker/lib/minetur';

const RAW_MOCK: RawStation = {
    IDEESS: '1234',
    'C.P.': '28001',
    Dirección: 'CALLE MAYOR, 1',
    Horario: 'L-D: 24H',
    Latitud: '40,4168',
    'Longitud (WGS84)': '-3,7038',
    Localidad: 'MADRID',
    Municipio: 'MADRID',
    Provincia: 'MADRID',
    Rótulo: 'REPSOL',
    'Tipo Venta': 'P',
    PrecioProducto: '',
    'Precio Gasoleo A': '1,499',
    'Precio Gasoleo A+': '1,659',
    'Precio Gasoleo B': '',
    'Precio Gasoleo C': '',
    'Precio Gasolina 95 E5': '1,549',
    'Precio Gasolina 95 E5 Premium': '',
    'Precio Gasolina 95 E10': '',
    'Precio Gasolina 98 E5': '1,699',
    'Precio Gasolina 98 E10': '',
    'Precio Biodiesel': '',
    'Precio Bioetanol': '',
    'Precio Gas Natural Comprimido': '',
    'Precio Gas Natural Licuado': '',
    'Precio Gases licuados del petróleo': '0,899',
    'Precio Hidrogeno': '',
    IDCCAA: '13',
    Margen: 'D',
    Remisión: 'dm',
};

describe('normalizeStation', () => {
    it('parses an ID correctly', () => {
        const s = normalizeStation(RAW_MOCK);
        expect(s.id).toBe('1234');
    });

    it('parses SP95 price from comma-decimal format', () => {
        const s = normalizeStation(RAW_MOCK);
        expect(s.prices.sp95).toBe(1.549);
    });

    it('parses diesel A price', () => {
        const s = normalizeStation(RAW_MOCK);
        expect(s.prices.dieselA).toBe(1.499);
    });

    it('parses coordinates from comma format', () => {
        const s = normalizeStation(RAW_MOCK);
        expect(s.lat).toBeCloseTo(40.4168, 3);
        expect(s.lon).toBeCloseTo(-3.7038, 3);
    });

    it('returns null for empty prices', () => {
        const s = normalizeStation(RAW_MOCK);
        expect(s.prices.biodiesel).toBeNull();
        expect(s.prices.gnc).toBeNull();
    });

    it('parses GLP price', () => {
        const s = normalizeStation(RAW_MOCK);
        expect(s.prices.glp).toBe(0.899);
    });
});

describe('calcAvg', () => {
    it('returns average of valid values', () => {
        const avg = calcAvg([1.5, 1.6, 1.7]);
        expect(avg).toBeCloseTo((1.5 + 1.6 + 1.7) / 3, 5);
    });

    it('ignores nulls and zeros', () => {
        const avg = calcAvg([null, 0, 1.5, 1.6, null]);
        expect(avg).toBeCloseTo((1.5 + 1.6) / 2, 5);
    });

    it('returns null when all values are null', () => {
        expect(calcAvg([null, null])).toBeNull();
    });

    it('returns null for empty array', () => {
        expect(calcAvg([])).toBeNull();
    });
});

describe('calcMin / calcMax', () => {
    it('returns min of valid values', () => {
        expect(calcMin([1.5, 1.2, 1.8])).toBe(1.2);
    });

    it('returns max of valid values', () => {
        expect(calcMax([1.5, 1.2, 1.8])).toBe(1.8);
    });

    it('ignores nulls', () => {
        expect(calcMin([null, 1.3, null])).toBe(1.3);
        expect(calcMax([null, 1.3, null])).toBe(1.3);
    });
});

describe('haversineKm', () => {
    it('returns ~0 for same point', () => {
        expect(haversineKm(40.4, -3.7, 40.4, -3.7)).toBeCloseTo(0, 1);
    });

    it('Madrid-Barcelona is roughly 505-510km', () => {
        const dist = haversineKm(40.4168, -3.7038, 41.3874, 2.1686);
        expect(dist).toBeGreaterThan(490);
        expect(dist).toBeLessThan(530);
    });
});

describe('region filters', () => {
    const stationPeninsula = { ...normalizeStation(RAW_MOCK), regionCode: '13' };
    const stationBaleares = { ...normalizeStation(RAW_MOCK), regionCode: '04' };
    const stationCanarias = { ...normalizeStation(RAW_MOCK), regionCode: '05' };

    it('filterPeninsula excludes Canarias, Ceuta, Melilla', () => {
        const all = [stationPeninsula, stationBaleares, stationCanarias];
        const result = filterPeninsula(all);
        expect(result).toHaveLength(2);
        expect(result.find(s => s.regionCode === '05')).toBeUndefined();
    });

    it('filterBaleares returns only Baleares', () => {
        const all = [stationPeninsula, stationBaleares, stationCanarias];
        expect(filterBaleares(all)).toEqual([stationBaleares]);
    });

    it('filterCanarias returns only Canarias', () => {
        const all = [stationPeninsula, stationBaleares, stationCanarias];
        expect(filterCanarias(all)).toEqual([stationCanarias]);
    });
});
