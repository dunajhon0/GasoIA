async function test() {
    const url = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/Historial/03-03-2026';
    console.log(`Fetching ${url}...`);
    const resp = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    console.log(`Status: ${resp.status}`);
    const text = await resp.text();
    console.log(`Text Length: ${text.length}`);
    if (text.length > 0) {
        console.log(`Preview: ${text.substring(0, 100)}`);
    }
}
test();
