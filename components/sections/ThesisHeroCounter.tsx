"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, animate } from "framer-motion";

interface Props {
  target: number;
}

export function ThesisHeroCounter({ target }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(0, target, {
      duration: 1.8,
      ease: "easeOut",
      onUpdate(value) {
        setDisplayed(Math.round(value));
      },
    });
    return () => controls.stop();
  }, [isInView, target]);

  return (
    <span ref={ref} className="font-serif text-[4.5rem] leading-none font-normal text-foreground tabular-nums">
      {displayed.toLocaleString("en-US")}
    </span>
  );
}
