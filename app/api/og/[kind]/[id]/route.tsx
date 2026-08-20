// app/api/og/[kind]/[id]/route.tsx
//
// The shared social card renderer (module 4.6b). Phase 5.1 extends it by
// adding a `kind`, not by adding a caller.
//
// The route takes an id, never card text. An /api/og?title=... endpoint is
// one line shorter and lets anyone on the internet stamp arbitrary words onto
// this site's branding, which cannot be walked back once permalink URLs are
// in circulation. Every string below is read from the database, so a card can
// never disagree with the page it represents.
//
// Node runtime, not edge: the fonts are read off disk with fs. Satori parses
// ttf, otf and woff, and CANNOT parse woff2, which is why _fonts holds woff.

import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import { getEarningsEventBySlug } from "@/lib/earnings-public";
import { eventTypeShort, formatEventDate } from "@/lib/earnings-mentions";
import { cardHeadline } from "@/lib/earnings-card";

export const runtime = "nodejs";
export const revalidate = 3600;

const WIDTH = 1200;
const HEIGHT = 630;

// Matches app/globals.css @theme.
const BACKGROUND = "#FAFAF7";
const FOREGROUND = "#0A0A0A";
const ACCENT = "#1E3A5F";
const MUTED = "#6B6B6B";
const BORDER = "#E5E4DF";

const SUPPORTED_KINDS = new Set(["earnings"]);

async function fonts() {
  const [serif, sans] = await Promise.all([
    readFile(new URL("../../_fonts/Fraunces-600.woff", import.meta.url)),
    readFile(new URL("../../_fonts/Inter-400.woff", import.meta.url)),
  ]);
  return [
    { name: "Fraunces", data: serif, weight: 600 as const, style: "normal" as const },
    { name: "Inter", data: sans, weight: 400 as const, style: "normal" as const },
  ];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string; id: string }> }
) {
  const { kind, id } = await params;

  if (!SUPPORTED_KINDS.has(kind)) {
    return new Response("Unknown card kind", { status: 404 });
  }

  const event = await getEarningsEventBySlug(id);
  if (!event) {
    return new Response("Not found", { status: 404 });
  }

  const headline = cardHeadline(event);
  const fontList = await fonts();

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: BACKGROUND,
        padding: "72px 80px",
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 24, color: MUTED }}>
        <span style={{ color: FOREGROUND }}>{event.filerName}</span>
        <span>{event.fiscalPeriod}</span>
        <span>{eventTypeShort(event.eventType)}</span>
        <span>{formatEventDate(event.eventDate)}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {headline.kind === "quote" && (
          <div style={{ display: "flex", fontSize: 22, color: ACCENT, letterSpacing: 1 }}>
            VERIFIED VERBATIM AGAINST THE FILING
          </div>
        )}
        <div
          style={{
            display: "flex",
            fontFamily: "Fraunces",
            fontSize: headline.kind === "figure" ? 92 : headline.text.length > 150 ? 44 : 56,
            lineHeight: 1.2,
            color: FOREGROUND,
          }}
        >
          {headline.kind === "quote" ? `“${headline.text}”` : headline.text}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `2px solid ${BORDER}`,
          paddingTop: 28,
          fontSize: 24,
          color: MUTED,
        }}
      >
        <span style={{ color: ACCENT }}>The Empty Seat</span>
        <span>
          {event.mentions.length > 0
            ? `${event.mentions.length} approved ${
                event.mentions.length === 1 ? "statement" : "statements"
              } about ${event.subjectName}`
            : `No published statement about ${event.subjectName}`}
        </span>
      </div>
    </div>,
    // The loaded faces have to be handed to satori explicitly; without this
    // the card silently renders in a fallback face and stops looking like the
    // site, which is most of the reason to build it.
    { width: WIDTH, height: HEIGHT, fonts: fontList }
  );
}
