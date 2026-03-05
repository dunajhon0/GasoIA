-- Migration: 0002_daily_fuel_stats.sql
-- New aggregate table for historical fuel price stats

CREATE TABLE IF NOT EXISTS daily_fuel_stats (
    day             TEXT NOT NULL, -- YYYY-MM-DD
    fuel            TEXT NOT NULL, -- fuel code (sp95, diesel_a, etc.)
    avg_price       REAL,
    min_price       REAL,
    max_price       REAL,
    sample_count    INTEGER,
    PRIMARY KEY (day, fuel)
);

CREATE INDEX IF NOT EXISTS idx_df_stats_day ON daily_fuel_stats(day);
CREATE INDEX IF NOT EXISTS idx_df_stats_fuel ON daily_fuel_stats(fuel);
