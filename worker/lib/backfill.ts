import type { D1Database } from '@cloudflare/workers-types';
import { FUEL_MAP, type Fuel } from './fuels';
import { fetchMineturHistoricalData, calcAvg, calcMin, calcMax, getToday } from './minetur';
import { upsertDailyFuelStat } from './db';

export interface BackfillOptions {
    targetDays: number;
    maxDaysPerRun: number;
}

export async function backfillMissingHistory(db: D1Database, options: BackfillOptions) {
    console.log(`[Backfill] Starting backfill process (target: ${options.targetDays} days, max runs: ${options.maxDaysPerRun})`);

    const fuels = Object.keys(FUEL_MAP) as Fuel[];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Normalize today

    let daysProcessed = 0;

    // We will walk backwards from today up to targetDays.
    for (let i = 1; i <= options.targetDays; i++) {
        if (daysProcessed >= options.maxDaysPerRun) {
            console.log(`[Backfill] Reached max days per run (${options.maxDaysPerRun}). Pausing until next run.`);
            break;
        }

        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateIso = d.toISOString().slice(0, 10);

        // Check if we need to fetch this day. We check if ALL active fuels exist.
        // If some are missing, we fetch the day and process.
        const existingCountResult = await db.prepare(
            `SELECT count(*) as c FROM daily_fuel_stats WHERE day = ?`
        ).bind(dateIso).first();

        const existingCount = (existingCountResult as any)?.c || 0;

        // If we already have entries for all fuels, skip to next day
        if (existingCount >= fuels.length) {
            continue;
        }

        console.log(`[Backfill] Missing data for ${dateIso} (found ${existingCount}/${fuels.length}). Fetching...`);

        try {
            const stations = await fetchMineturHistoricalData(dateIso);
            if (stations.length > 0) {
                // Insert for all fuels
                for (const [fuelDb, meta] of Object.entries(FUEL_MAP)) {
                    const field = meta.field;
                    const vals = stations.map(s => (s.prices as Record<string, any>)[field] as number | null);
                    const avg = calcAvg(vals);

                    if (avg !== null && avg > 0) {
                        await upsertDailyFuelStat(db, {
                            day: dateIso,
                            fuel: fuelDb,
                            avg_price: avg,
                            min_price: calcMin(vals),
                            max_price: calcMax(vals),
                            sample_count: vals.filter(v => v !== null && v > 0).length
                        });

                        // Update state tracking
                        await db.prepare(
                            `INSERT INTO history_backfill_state (fuel, last_filled_day, status, updated_at) 
                             VALUES (?, ?, 'COMPLETED', ?)
                             ON CONFLICT(fuel) DO UPDATE SET last_filled_day=excluded.last_filled_day, status='COMPLETED', updated_at=excluded.updated_at`
                        ).bind(fuelDb, dateIso, new Date().toISOString()).run();
                    }
                }
            } else {
                console.log(`[Backfill] No data available from MINETUR for ${dateIso}.`);
                // Mark state as completed for this day anyway to avoid infinite retries if the day was a holiday / missing
                for (const fuelDb of fuels) {
                    await db.prepare(
                        `INSERT INTO history_backfill_state (fuel, last_filled_day, status, updated_at) 
                         VALUES (?, ?, 'NO_DATA', ?)
                         ON CONFLICT(fuel) DO UPDATE SET last_filled_day=excluded.last_filled_day, status='NO_DATA', updated_at=excluded.updated_at`
                    ).bind(fuelDb, dateIso, new Date().toISOString()).run();
                }
            }
            daysProcessed++;
        } catch (err) {
            console.error(`[Backfill] Error processing ${dateIso}:`, err);
            // On error, we stop processing to avoid hitting rate limits or repeated errors
            for (const fuelDb of fuels) {
                await db.prepare(
                    `INSERT INTO history_backfill_state (fuel, last_filled_day, status, updated_at) 
                     VALUES (?, ?, 'ERROR', ?)
                     ON CONFLICT(fuel) DO UPDATE SET status='ERROR', updated_at=excluded.updated_at`
                ).bind(fuelDb, dateIso, new Date().toISOString()).run();
            }
            break;
        }
    }

    console.log(`[Backfill] Completed. Processed ${daysProcessed} days.`);
    return daysProcessed;
}
