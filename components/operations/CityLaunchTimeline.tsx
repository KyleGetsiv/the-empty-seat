"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getCohortBucket } from "@/lib/cohorts";
import { format, parseISO } from "date-fns";

export interface TimelineCity {
  id: string;
  name: string;
  metro_area: string | null;
  launch_date: string;
  public_access_date: string | null;
  service_area_sq_mi: number | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
}

interface Props {
  cities: TimelineCity[];
}

function formatMonthYear(dateStr: string) {
  return format(parseISO(dateStr), "MMM yyyy");
}

function formatFullDate(dateStr: string) {
  return format(parseISO(dateStr), "MMMM d, yyyy");
}

function StatusBadge({ status }: { status: string }) {
  const isPublic = status === "public";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        isPublic
          ? "bg-accent/10 text-accent"
          : "bg-border text-muted"
      }`}
    >
      {isPublic ? "Public" : "Announced"}
    </span>
  );
}

export function CityLaunchTimeline({ cities }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  const sorted = [...cities].sort(
    (a, b) => new Date(a.launch_date).getTime() - new Date(b.launch_date).getTime()
  );

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="mt-10 flex flex-col">
      {sorted.map((city, idx) => {
        const cohort = getCohortBucket(city.launch_date);
        const isOpen = openId === city.id;
        const isLast = idx === sorted.length - 1;

        return (
          <div key={city.id} className="flex gap-5">
            {/* Timeline spine */}
            <div className="flex flex-col items-center">
              <div
                className="mt-[1.1rem] h-3 w-3 shrink-0 rounded-full ring-2 ring-white"
                style={{ backgroundColor: cohort.color }}
              />
              {!isLast && (
                <div className="mt-1 w-px flex-1 bg-border" />
              )}
            </div>

            {/* Row content */}
            <div className={`flex-1 pb-0 ${isLast ? "pb-0" : "pb-1"}`}>
              <button
                onClick={() => toggle(city.id)}
                className="flex w-full items-baseline gap-3 py-3 text-left group"
                aria-expanded={isOpen}
              >
                <span className="w-20 shrink-0 text-sm text-muted tabular-nums">
                  {formatMonthYear(city.launch_date)}
                </span>
                <span className="flex-1 font-serif text-[1.0625rem] text-foreground group-hover:text-accent transition-colors">
                  {city.name}
                </span>
                <StatusBadge status={city.status} />
                {city.service_area_sq_mi !== null && (
                  <span className="hidden sm:inline text-sm text-muted tabular-nums">
                    {city.service_area_sq_mi} sq mi
                  </span>
                )}
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  className={`shrink-0 text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                >
                  <path
                    d="M2 5l5 5 5-5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </button>

              {/* Accordion panel */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="panel"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="mb-5 ml-0 rounded-md border border-border bg-surface p-4 text-sm">
                      <dl className="grid grid-cols-1 gap-y-2 sm:grid-cols-2 sm:gap-x-8">
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-muted">Launch date</dt>
                          <dd className="mt-0.5 text-foreground">{formatFullDate(city.launch_date)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-muted">Metro area</dt>
                          <dd className="mt-0.5 text-foreground">{city.metro_area ?? city.name}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-muted">Service area</dt>
                          <dd className="mt-0.5 text-foreground">
                            {city.service_area_sq_mi !== null
                              ? `${city.service_area_sq_mi} sq mi`
                              : "Not yet disclosed"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-muted">Status</dt>
                          <dd className="mt-0.5">
                            <StatusBadge status={city.status} />
                          </dd>
                        </div>
                      </dl>
                      <div className="mt-4">
                        {/* TODO: city detail pages land in a later module */}
                        <span className="cursor-default text-muted">
                          View city detail
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        );
      })}
    </div>
  );
}
