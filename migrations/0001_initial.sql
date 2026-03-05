-- Migration: 0001_initial.sql
-- GasoIA D1 Database Schema

-- Raw stations snapshot (refreshed daily)
CREATE TABLE IF NOT EXISTS stations (
  id            TEXT PRIMARY KEY,  -- IDEESS field
  name          TEXT NOT NULL,
  address       TEXT,
  municipality  TEXT,
  locality      TEXT,
  province      TEXT,
  postal_code   TEXT,
  lat           REAL,
  lon           REAL,
  schedule      TEXT,
  brand         TEXT,
  updated_at    TEXT NOT NULL
);

-- Daily price records per station
CREATE TABLE IF NOT EXISTS station_prices (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id    TEXT NOT NULL,
  date          TEXT NOT NULL,  -- YYYY-MM-DD
  sp95          REAL,
  sp98          REAL,
  diesel_a      REAL,
  diesel_a_plus REAL,
  diesel_b      REAL,
  diesel_c      REAL,
  biodiesel     REAL,
  glp           REAL,
  gnc           REAL,
  UNIQUE(station_id, date),
  FOREIGN KEY(station_id) REFERENCES stations(id)
);

-- Daily national aggregates per fuel type
CREATE TABLE IF NOT EXISTS fuel_aggregates (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT NOT NULL,
  fuel_type     TEXT NOT NULL,  -- sp95, sp98, diesel_a, etc.
  scope         TEXT NOT NULL DEFAULT 'national', -- national, peninsula, baleares, canarias
  avg_price     REAL,
  min_price     REAL,
  max_price     REAL,
  count         INTEGER,
  UNIQUE(date, fuel_type, scope)
);

-- Daily city aggregates
CREATE TABLE IF NOT EXISTS city_aggregates (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT NOT NULL,
  city          TEXT NOT NULL,
  province      TEXT,
  sp95_avg      REAL,
  diesel_a_avg  REAL,
  station_count INTEGER,
  UNIQUE(date, city)
);

-- Daily brand aggregates
CREATE TABLE IF NOT EXISTS brand_aggregates (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT NOT NULL,
  brand         TEXT NOT NULL,
  sp95_avg      REAL,
  diesel_a_avg  REAL,
  station_count INTEGER,
  UNIQUE(date, brand)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_station_prices_date    ON station_prices(date);
CREATE INDEX IF NOT EXISTS idx_station_prices_station ON station_prices(station_id);
CREATE INDEX IF NOT EXISTS idx_fuel_agg_date_fuel     ON fuel_aggregates(date, fuel_type);
CREATE INDEX IF NOT EXISTS idx_city_agg_date_city     ON city_aggregates(date, city);
CREATE INDEX IF NOT EXISTS idx_brand_agg_date_brand   ON brand_aggregates(date, brand);
CREATE INDEX IF NOT EXISTS idx_stations_province      ON stations(province);
CREATE INDEX IF NOT EXISTS idx_stations_municipality  ON stations(municipality);
CREATE INDEX IF NOT EXISTS idx_stations_brand         ON stations(brand);
