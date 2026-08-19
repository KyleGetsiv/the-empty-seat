"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { getCohortBucket } from "@/lib/cohorts";
import { addStateFill } from "@/lib/state-fill-layer";
import type { StateTier } from "@/lib/state-tiers";
import { format, parseISO } from "date-fns";

export interface MapCity {
  id: string;
  name: string;
  launch_date: string;
  service_area_sq_mi: number | null;
  status: string;
  latitude: number;
  longitude: number;
}

interface Props {
  cities: MapCity[];
  // Reports back which state tiers actually rendered, so the legend can list
  // only the steps present. Waymo's announced cities carry no launch_date and
  // are filtered out upstream, so tier 1 never appears on this map.
  onTiers?: (tiers: Record<string, StateTier>) => void;
}

function formatMonthYear(dateStr: string) {
  return format(parseISO(dateStr), "MMM yyyy");
}

// Generate an approximate GeoJSON circle polygon for geographic rendering.
// Uses the equirectangular approximation; accurate enough at US city scales.
function circlePolygon(
  centerLng: number,
  centerLat: number,
  radiusMeters: number,
  steps = 64
): GeoJSON.Polygon {
  const coords: [number, number][] = [];
  const latRad = (centerLat * Math.PI) / 180;
  const metersPerDegLat = 111_320;
  const metersPerDegLng = 111_320 * Math.cos(latRad);

  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLat = (radiusMeters * Math.sin(angle)) / metersPerDegLat;
    const dLng = (radiusMeters * Math.cos(angle)) / metersPerDegLng;
    coords.push([centerLng + dLng, centerLat + dLat]);
  }

  return { type: "Polygon", coordinates: [coords] };
}

function sqMiToRadiusMeters(sqMi: number): number {
  return Math.sqrt((sqMi * 2_589_988) / Math.PI);
}

export function CoverageMap({ cities, onTiers }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

    const validCities = cities.filter((c) => c.latitude && c.longitude);

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      attributionControl: false,
      interactive: true,
      // Center on continental US, zoom tuned so Phoenix's 315 sq mi circle
      // reads as a visible blob and all 11 cities are in frame on desktop.
      center: [-98, 37],
      zoom: 4.0,
    });

    mapRef.current = map;


    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
      maxWidth: "220px",
    });

    map.on("load", () => {
      // Override base style to match editorial palette
      const styleLayers = map.getStyle().layers ?? [];
      for (const layer of styleLayers) {
        if (layer.type === "background") {
          map.setPaintProperty(layer.id, "background-color", "#FAFAF7");
        }
        if (layer.id.includes("water") && layer.type === "fill") {
          map.setPaintProperty(layer.id, "fill-color", "#E8E8E3");
        }
        if (
          (layer.id.includes("water") || layer.id.includes("waterway")) &&
          layer.type === "line"
        ) {
          map.setPaintProperty(layer.id, "line-color", "#D8D8D2");
        }
        if (layer.id.includes("road") && layer.type === "line") {
          map.setPaintProperty(layer.id, "line-color", "#D8D8D2");
          map.setPaintProperty(layer.id, "line-opacity", 0.4);
        }
        if (layer.type === "symbol" && layer.id.includes("poi")) {
          map.setLayoutProperty(layer.id, "visibility", "none");
        }
      }

      // State presence fill beneath everything. Opacity is held well down for
      // two reasons: the cohort service-area circles are 25% opacity fills,
      // and the cohort dot ramp runs pale at the recent end (#B8D4E8 for 2026
      // launches). At 0.55 the deepest fill composited to luminance 0.652
      // against that dot's 0.631, technically lighter but far too close to
      // read, which washed out Nashville, Las Vegas and Miami on their own
      // shaded states. 0.35 composites to 0.751 and separates properly.
      addStateFill(
        map,
        validCities.map((c) => ({
          status: c.status,
          latitude: c.latitude,
          longitude: c.longitude,
        })),
        { fillOpacity: 0.35 }
      ).then((tiers) => {
        if (tiers) onTiers?.(tiers);
      });

      // Every city gets one uniform dot; only cities with a disclosed
      // service area also get a true-to-scale polygon.
      //
      // These used to be alternatives, which inverted the visual hierarchy:
      // a disclosed area rendered as its real size (Phoenix's 315 sq mi is
      // 3.9px at zoom 4, Orlando's 50 sq mi is 1.5px) while an undisclosed
      // one rendered as a fixed 8px pin. A service area would need to reach
      // ~1,300 sq mi just to equal that pin, so the cities we knew least
      // about were the largest marks on the map. Size now carries only
      // service area, at national zoom it carries nothing at all, and
      // non-disclosure is the quiet absence of a polygon rather than a
      // bigger dot.
      const circlesPublic: GeoJSON.Feature[] = [];
      const circlesWaitlist: GeoJSON.Feature[] = [];
      const cityPoints: GeoJSON.Feature[] = [];

      for (const city of validCities) {
        const cohort = getCohortBucket(city.launch_date);
        const isPublic = city.status === "public";
        const hasArea = city.service_area_sq_mi !== null;

        const sharedProps = {
          name: city.name,
          launch_date: city.launch_date,
          service_area_sq_mi: city.service_area_sq_mi,
          status: city.status,
          cohortColor: cohort.color,
          isPublic: isPublic ? 1 : 0,
        };

        cityPoints.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [city.longitude, city.latitude] },
          properties: sharedProps,
        });

        if (hasArea) {
          const radiusM = sqMiToRadiusMeters(city.service_area_sq_mi!);
          const feature: GeoJSON.Feature = {
            type: "Feature",
            geometry: circlePolygon(city.longitude, city.latitude, radiusM),
            properties: sharedProps,
          };
          if (isPublic) circlesPublic.push(feature);
          else circlesWaitlist.push(feature);
        }
      }

      function fc(features: GeoJSON.Feature[]): GeoJSON.FeatureCollection {
        return { type: "FeatureCollection", features };
      }

      // Add fill layers for sq_mi circles
      map.addSource("circles-public", { type: "geojson", data: fc(circlesPublic) });
      map.addLayer({
        id: "circles-public-fill",
        type: "fill",
        source: "circles-public",
        paint: { "fill-color": ["get", "cohortColor"], "fill-opacity": 0.25 },
      });
      map.addLayer({
        id: "circles-public-outline",
        type: "line",
        source: "circles-public",
        paint: {
          "line-color": ["get", "cohortColor"],
          "line-width": 1.5,
          "line-opacity": 0.8,
        },
      });

      map.addSource("circles-waitlist", { type: "geojson", data: fc(circlesWaitlist) });
      map.addLayer({
        id: "circles-waitlist-fill",
        type: "fill",
        source: "circles-waitlist",
        paint: { "fill-color": ["get", "cohortColor"], "fill-opacity": 0.55 },
      });
      map.addLayer({
        id: "circles-waitlist-outline",
        type: "line",
        source: "circles-waitlist",
        paint: {
          "line-color": ["get", "cohortColor"],
          "line-width": 2,
          "line-opacity": 1,
          "line-dasharray": [3, 3],
        },
      });

      // One uniform dot per city, on top of the polygons so it stays the
      // city marker as the service area grows around it on zoom. Matches the
      // landscape map's encoding: solid = public, ringed = limited access.
      // The white halo keeps the dot legible over the state fill.
      map.addSource("city-points", { type: "geojson", data: fc(cityPoints) });
      map.addLayer({
        id: "city-halo",
        type: "circle",
        source: "city-points",
        paint: {
          "circle-radius": 9,
          "circle-color": "#FFFFFF",
          // Needed at national zoom to separate the dot from the state fill,
          // but at metro zoom it would punch a white hole in the middle of a
          // large service area, so it fades out as the polygon takes over.
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.9, 8, 0],
        },
      });
      map.addLayer({
        id: "city-dot",
        type: "circle",
        source: "city-points",
        paint: {
          "circle-radius": ["case", ["==", ["get", "isPublic"], 1], 6.5, 5.5],
          "circle-color": ["get", "cohortColor"],
          "circle-opacity": ["case", ["==", ["get", "isPublic"], 1], 1, 0.85],
          "circle-stroke-color": ["get", "cohortColor"],
          "circle-stroke-width": ["case", ["==", ["get", "isPublic"], 1], 0, 2],
        },
      });

      // TODO: when service_area_geojson is populated, replace the circle
      // polygon layers above with fill layers sourced from that column.

      // Hover tooltips on all layers
      const interactiveLayers = [
        "circles-public-fill",
        "circles-waitlist-fill",
        "city-dot",
      ];

      function showPopup(e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) {
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features?.[0];
        if (!feature) return;

        const p = feature.properties as {
          name: string;
          launch_date: string;
          service_area_sq_mi: number | null;
          status: string;
        };

        // For polygon features, use the event lngLat; for points, use the geometry
        let lngLat: mapboxgl.LngLat;
        if (feature.geometry.type === "Point") {
          const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
          lngLat = new mapboxgl.LngLat(lng, lat);
        } else {
          lngLat = e.lngLat;
        }

        const areaLabel =
          p.service_area_sq_mi != null ? `${p.service_area_sq_mi} sq mi` : "Not yet disclosed";
        const statusLabels: Record<string, string> = {
          public: "Public",
          waitlist: "Waitlist",
          employee: "Employee-only",
          announced: "Announced",
          paused: "Paused",
        };
        const statusLabel = statusLabels[p.status] ?? p.status;

        popup
          .setLngLat(lngLat)
          .setHTML(
            `<div style="font-family:var(--font-inter,ui-sans-serif,system-ui,sans-serif);font-size:13px;line-height:1.5;color:#0A0A0A;padding:2px 0;">
              <div style="font-weight:600;margin-bottom:3px;">${p.name}</div>
              <div style="color:#6B6B6B;">${formatMonthYear(p.launch_date)}</div>
              <div style="color:#6B6B6B;">${areaLabel}</div>
              <div style="color:#6B6B6B;">${statusLabel}</div>
            </div>`
          )
          .addTo(map);
      }

      function hidePopup() {
        map.getCanvas().style.cursor = "";
        popup.remove();
      }

      for (const layerId of interactiveLayers) {
        map.on("mouseenter", layerId, showPopup);
        map.on("mouseleave", layerId, hidePopup);
      }
    });

    return () => {
      popup.remove();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="mt-10 w-full overflow-hidden rounded-md border border-border"
      style={{ height: "65vh", minHeight: "360px" }}
      aria-label="Waymo service areas, over a fill showing operator presence by state"
    />
  );
}
