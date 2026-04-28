-- 0006_cities_external_keys.sql
-- Adds external_keys jsonb column to cities for cross-source identifier mapping.
-- Populated lazily as scrapers come online (empty {} by default).
-- Convention: keys are source slug strings (e.g. "robotaxi_tracker", "nhtsa"),
-- values are the external system's identifier for that city.
-- Phase 4 (earnings), Phase 6 (NHTSA, CA DMV) scrapers will write here.

ALTER TABLE cities
  ADD COLUMN external_keys jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX cities_external_keys_idx ON cities USING gin (external_keys);
