/**
 * MINETUR (Ministerio de Industria) - Official fuel stations API parser
 * Source: https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/
 */

export interface RawStation {
    IDEESS: string;
    'C.P.': string;
    Dirección: string;
    Horario: string;
    Latitud: string;
    'Longitud (WGS84)': string;
    Localidad: string;
    Municipio: string;
    Provincia: string;
    Rótulo: string;
    'Tipo Venta': string;
    'PrecioProducto': string;
    'Precio Gasoleo A': string;
    'Precio Gasoleo A+': string;
    'Precio Gasoleo B': string;
    'Precio Gasoleo C': string;
    'Precio Gasolina 95 E5': string;
    'Precio Gasolina 95 E5 Premium': string;
    'Precio Gasolina 95 E10': string;
    'Precio Gasolina 98 E5': string;
    'Precio Gasolina 98 E10': string;
    'Precio Biodiesel': string;
    'Precio Bioetanol': string;
    'Precio Gas Natural Comprimido': string;
    'Precio Gas Natural Licuado': string;
    'Precio Gases licuados del petróleo': string;
    'Precio Hidrogeno': string;
    IDCCAA: string;
    'Margen': string;
    'Remisión': string;
}

export interface RawMineturResponse {
    Fecha: string;
    ListaEESSPrecio: RawStation[];
    Nota: string;
    ResultadoConsulta: string;
}

export interface NormalizedStation {
    id: string;
    name: string;
    address: string;
    municipality: string;
    locality: string;
    province: string;
    postalCode: string;
    lat: number | null;
    lon: number | null;
    schedule: string;
    brand: string;
    regionCode: string;
    prices: {
        sp95: number | null;
        sp98: number | null;
        dieselA: number | null;
        dieselAPlus: number | null;
        dieselB: number | null;
        dieselC: number | null;
        biodiesel: number | null;
        glp: number | null;
        gnc: number | null;
    };
}

function parsePrice(val: string | undefined): number | null {
    if (!val || val.trim() === '') return null;
    const num = parseFloat(val.replace(',', '.'));
    return isNaN(num) ? null : num;
}

function parseCoord(val: string | undefined): number | null {
    if (!val || val.trim() === '') return null;
    const num = parseFloat(val.replace(',', '.'));
    return isNaN(num) ? null : num;
}

export async function fetchMineturData(): Promise<NormalizedStation[]> {
    const url = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/';

    const resp = await fetch(url, {
        headers: { Accept: 'application/json' },
        cf: { cacheTtl: 3600, cacheEverything: false } as RequestInitCfProperties,
    });

    if (!resp.ok) {
        throw new Error(`MINETUR API error: ${resp.status} ${resp.statusText}`);
    }

    const data: RawMineturResponse = await resp.json();

    if (data.ResultadoConsulta !== 'OK') {
        throw new Error(`MINETUR returned non-OK result: ${data.ResultadoConsulta}`);
    }

    return data.ListaEESSPrecio.map(normalizeStation);
}

export function normalizeStation(raw: RawStation): NormalizedStation {
    return {
        id: raw.IDEESS,
        name: raw.Rótulo?.trim() ?? '',
        address: raw.Dirección?.trim() ?? '',
        municipality: raw.Municipio?.trim() ?? '',
        locality: raw.Localidad?.trim() ?? '',
        province: raw.Provincia?.trim() ?? '',
        postalCode: raw['C.P.']?.trim() ?? '',
        lat: parseCoord(raw.Latitud),
        lon: parseCoord(raw['Longitud (WGS84)']),
        schedule: raw.Horario?.trim() ?? '',
        brand: raw.Rótulo?.trim() ?? '',
        regionCode: raw.IDCCAA,
        prices: {
            sp95: parsePrice(raw['Precio Gasolina 95 E5']),
            sp98: parsePrice(raw['Precio Gasolina 98 E5']),
            dieselA: parsePrice(raw['Precio Gasoleo A']),
            dieselAPlus: parsePrice(raw['Precio Gasoleo A+']),
            dieselB: parsePrice(raw['Precio Gasoleo B']),
            dieselC: parsePrice(raw['Precio Gasoleo C']),
            biodiesel: parsePrice(raw['Precio Biodiesel']),
            glp: parsePrice(raw['Precio Gases licuados del petróleo']),
            gnc: parsePrice(raw['Precio Gas Natural Comprimido']),
        },
    };
}

export function getToday(): string {
    return new Date().toISOString().slice(0, 10);
}

export function getYesterday(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
}

// Canary Islands IDCCAA = '05', Ceuta = '18', Melilla = '19'
const EXCLUDED_REGIONS = new Set(['05', '18', '19']);

export function filterPeninsula(stations: NormalizedStation[]): NormalizedStation[] {
    return stations.filter(s => !EXCLUDED_REGIONS.has(s.regionCode));
}

export function filterBaleares(stations: NormalizedStation[]): NormalizedStation[] {
    return stations.filter(s => s.regionCode === '04');
}

export function filterCanarias(stations: NormalizedStation[]): NormalizedStation[] {
    return stations.filter(s => s.regionCode === '05');
}

export function calcAvg(values: (number | null)[]): number | null {
    const valid = values.filter((v): v is number => v !== null && v > 0);
    if (valid.length === 0) return null;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function calcMin(values: (number | null)[]): number | null {
    const valid = values.filter((v): v is number => v !== null && v > 0);
    if (valid.length === 0) return null;
    return Math.min(...valid);
}

export function calcMax(values: (number | null)[]): number | null {
    const valid = values.filter((v): v is number => v !== null && v > 0);
    if (valid.length === 0) return null;
    return Math.max(...valid);
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
