const FUEL_ALIASES = {
    'gasolina95': 'sp95',
    'sp95': 'sp95',
    'diesel': 'diesel_a',
    'diesel_a': 'diesel_a',
};

function normalizeFuel(f) {
    const clean = f.toLowerCase().trim();
    return FUEL_ALIASES[clean] || clean;
}

const ALL_FUELS = ['sp95', 'diesel_a', 'diesel_a_plus', 'sp98', 'glp', 'gnc'];

async function test(rawFuel) {
    const fuelParam = normalizeFuel(rawFuel);
    const fuelsToFetch = fuelParam.toUpperCase() === 'ALL'
        ? ALL_FUELS
        : FUEL_ALIASES[fuelParam] ? [FUEL_ALIASES[fuelParam]] : ['sp95'];

    console.log(`Input: ${rawFuel} -> Normalized: ${fuelParam} -> Fetching: ${JSON.stringify(fuelsToFetch)}`);
}

test('sp95');
test('diesel_a');
test('ALL');
test('Gasolina 95');
test('Gasóleo A');
