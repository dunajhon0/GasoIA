-- Migration: 0003_backfill_fuel_stats.sql
-- Backfill daily_fuel_stats from existing fuel_aggregates

INSERT OR IGNORE INTO daily_fuel_stats (day, fuel, avg_price, min_price, max_price, sample_count)
SELECT date, fuel_type, avg_price, min_price, max_price, count
FROM fuel_aggregates
WHERE scope = 'national' AND avg_price IS NOT NULL;
