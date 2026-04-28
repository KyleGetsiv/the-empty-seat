-- 0007_ride_estimates_vehicle_miles.sql
-- Adds vehicle_miles_traveled column to ride_estimates.
-- Used by CPUC scraper to store quarterly VMT ZEV (vehicle miles traveled,
-- zero-emission) from California Public Utilities Commission quarterly filings.
-- Nullable: only populated for rows sourced from CPUC or equivalent VMT-reporting sources.

ALTER TABLE ride_estimates
  ADD COLUMN vehicle_miles_traveled numeric;
