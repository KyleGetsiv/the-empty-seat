-- 0005_add_service_area_geojson.sql
-- Adds a nullable jsonb column to cities for storing GeoJSON polygon geometry.
-- Reserved for future use; the 1.2.c coverage map does not consume this column yet.
-- When polygon data is later populated, the map will render polygons in place of
-- the sq_mi-derived circles.

alter table public.cities
  add column service_area_geojson jsonb;
