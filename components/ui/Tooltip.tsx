"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  /** Delay before showing on hover, ms */
  delayDuration?: number;
}

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RadixTooltip.Provider delayDuration={300} skipDelayDuration={100}>
      {children}
    </RadixTooltip.Provider>
  );
}

export function Tooltip({
  content,
  children,
  delayDuration = 300,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleOpenChange(next: boolean) {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setOpen(next);
    if (next) {
      // Auto-dismiss after 8 seconds (mobile UX)
      dismissTimer.current = setTimeout(() => setOpen(false), 8000);
    }
  }

  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  return (
    <RadixTooltip.Root
      open={open}
      onOpenChange={handleOpenChange}
      delayDuration={delayDuration}
    >
      <RadixTooltip.Trigger asChild>
        {/* Wrap in span so any child works as trigger */}
        <span
          className="cursor-help"
          onClick={() => handleOpenChange(!open)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleOpenChange(!open);
            }
          }}
          role="button"
          tabIndex={0}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          {children}
        </span>
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          sideOffset={6}
          collisionPadding={16}
          className="
            z-50 max-w-xs rounded-md border border-border bg-white px-3.5 py-2.5
            text-sm leading-relaxed text-foreground shadow-lg
            data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0
            data-[state=delayed-open]:zoom-in-95
            data-[state=closed]:animate-out data-[state=closed]:fade-out-0
            data-[state=closed]:zoom-out-95
          "
        >
          {content}
          <RadixTooltip.Arrow className="fill-white drop-shadow-sm" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
