

async function backfill(dateIso) {
    const [y, m, d] = dateIso.split('-');
    const dateFormatted = `${d}-${m}-${y}`;
    const url = `https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/Historial/${dateFormatted}`;

    console.error(`Fetching ${dateIso}...`);
    try {
        const resp = await fetch(url);
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.ResultadoConsulta !== 'OK') return;

        const fuels = [
            { key: 'sp95', field: 'Precio Gasolina 95 E5' },
            { key: 'diesel_a', field: 'Precio Gasoleo A' },
            { key: 'sp98', field: 'Precio Gasolina 98 E5' },
            { key: 'diesel_a_plus', field: 'Precio Gasoleo A+' },
            { key: 'glp', field: 'Precio Gases licuados del petróleo' },
            { key: 'gnc', field: 'Precio Gas Natural Comprimido' }
        ];

        for (const fuel of fuels) {
            const prices = data.ListaEESSPrecio
                .map(s => s[fuel.field])
                .filter(p => !!p)
                .map(p => parseFloat(p.replace(',', '.')))
                .filter(p => !isNaN(p) && p > 0);

            if (prices.length === 0) continue;

            const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
            const min = Math.min(...prices);
            const max = Math.max(...prices);
            const count = prices.length;

            console.log(`INSERT OR IGNORE INTO daily_fuel_stats (day, fuel, avg_price, min_price, max_price, sample_count) VALUES ('${dateIso}', '${fuel.key}', ${avg}, ${min}, ${max}, ${count});`);
        }
    } catch (e) {
        console.error(e);
    }
}

async function run() {
    // March 1 to March 4
    await backfill('2026-03-01');
    await backfill('2026-03-02');
    await backfill('2026-03-03');
    await backfill('2026-03-04');
}

run();
