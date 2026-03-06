-- Migration: 0004_history_backfill_state.sql
-- State tracking for incremental backfill process

CREATE TABLE IF NOT EXISTS history_backfill_state (
    fuel            TEXT PRIMARY KEY,
    last_filled_day TEXT, -- Usually the oldest day we've processed (e.g. YYYY-MM-DD)
    status          TEXT, -- 'PENDING', 'COMPLETED', 'ERROR'
    updated_at      TEXT
);
