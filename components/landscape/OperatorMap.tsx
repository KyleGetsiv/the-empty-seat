"use client";

// OperatorMap: multi-operator deployment map. Distinct from the Waymo
// CoverageMap on purpose (open decision 4, resolved 2026-08-15 as a
// separate lighter component): markers only, no service-area polygons,
// because non-Waymo service areas are mostly undisclosed. One color per
// program, marker style by status: solid = public, ring = employee/waitlist,
// hollow = announced.

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { LandscapeCity } from "@/lib/landscape-types";

// Editorial palette: accent for Waymo, muted distinct hues for others.
const PROGRAM_COLORS: Record<string, string> = {
  "waymo-one": "#1E3A5F",
  zoox: "#7A4A1E",
  "tesla-robotaxi": "#8A1E1E",
  "uber-nuro-lucid": "#1E6B4F",
  "apollo-go": "#5A3A7A",
  "pony-ai": "#8A6A1E",
  weride: "#1E6B7A",
  avride: "#6B6B6B",
  "may-mobility": "#6B6B6B",
  motional: "#6B6B6B",
  didi: "#6B6B6B",
};
const FALLBACK = "#6B6B6B";

export function programColor(slug: string): string {
  return PROGRAM_COLORS[slug] ?? FALLBACK;
}

interface Props {
  cities: LandscapeCity[];
  // 'us' frames the continental US; 'world' frames the whole map.
  region: "us" | "world";
}

export function OperatorMap({ cities, region }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      attributionControl: false,
      center: region === "us" ? [-96, 37.5] : [30, 25],
      zoom: region === "us" ? 3.4 : 1.4,
      projection: region === "us" ? "mercator" : "naturalEarth",
    });
    mapRef.current = map;

    const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 10, maxWidth: "240px" });

    map.on("load", () => {
      for (const layer of map.getStyle().layers ?? []) {
        if (layer.type === "background") map.setPaintProperty(layer.id, "background-color", "#FAFAF7");
        if (layer.id.includes("water") && layer.type === "fill") map.setPaintProperty(layer.id, "fill-color", "#E8E8E3");
        if (layer.id.includes("road") && layer.type === "line") map.setPaintProperty(layer.id, "line-opacity", 0.25);
        if (layer.type === "symbol" && (layer.id.includes("poi") || layer.id.includes("road-label"))) {
          map.setLayoutProperty(layer.id, "visibility", "none");
        }
      }

      const features: GeoJSON.Feature[] = cities.map((c) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [c.longitude, c.latitude] },
        properties: {
          name: c.name,
          program: c.program_name,
          status: c.status,
          color: programColor(c.program_slug),
          notes: c.notes ?? "",
          isPublic: c.status === "public" ? 1 : 0,
          isAnnounced: c.status === "announced" ? 1 : 0,
        },
      }));

      map.addSource("ops", { type: "geojson", data: { type: "FeatureCollection", features } });

      // Public: solid dot. Employee/waitlist: dot with white ring. Announced: hollow.
      map.addLayer({
        id: "ops-halo",
        type: "circle",
        source: "ops",
        paint: {
          "circle-radius": 9,
          "circle-color": "#FFFFFF",
          "circle-opacity": 0.9,
        },
      });
      map.addLayer({
        id: "ops-dot",
        type: "circle",
        source: "ops",
        paint: {
          "circle-radius": ["case", ["==", ["get", "isPublic"], 1], 6.5, 5.5],
          "circle-color": ["case", ["==", ["get", "isAnnounced"], 1], "#FAFAF7", ["get", "color"]],
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-width": ["case", ["==", ["get", "isPublic"], 1], 0, 2],
          "circle-opacity": ["case", ["==", ["get", "isPublic"], 1], 1, 0.85],
        },
      });

      const statusLabel: Record<string, string> = {
        public: "Public",
        waitlist: "Waitlist",
        employee: "Employee-only",
        announced: "Announced",
        paused: "Paused",
      };

      map.on("mouseenter", "ops-dot", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as { name: string; program: string; status: string; notes: string };
        const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        popup
          .setLngLat([lng, lat])
          .setHTML(
            `<div style="font-family:var(--font-inter,ui-sans-serif,system-ui,sans-serif);font-size:13px;line-height:1.5;color:#0A0A0A;padding:2px 0;">
              <div style="font-weight:600;">${p.name}</div>
              <div style="color:#6B6B6B;">${p.program}</div>
              <div style="color:#6B6B6B;">${statusLabel[p.status] ?? p.status}</div>
            </div>`
          )
          .addTo(map);
      });
      map.on("mouseleave", "ops-dot", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
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
      className="w-full overflow-hidden rounded-md border border-border"
      style={{ height: region === "us" ? "55vh" : "45vh", minHeight: "320px" }}
      aria-label={region === "us" ? "US robotaxi deployment map by operator" : "Global robotaxi deployment map by operator"}
    />
  );
}
