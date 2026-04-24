import { ReactNode } from "react";

type Level = 1 | 2 | 3 | 4;

interface HeadingProps {
  level: Level;
  children: ReactNode;
  className?: string;
}

const sizeMap: Record<Level, string> = {
  1: "text-[3.75rem] sm:text-[4.5rem] leading-[1.08] tracking-[-0.03em]",
  2: "text-[2.25rem] sm:text-[3rem] leading-[1.12] tracking-[-0.02em]",
  3: "text-[1.75rem] sm:text-[2.25rem] leading-[1.2] tracking-[-0.015em]",
  4: "text-[1.375rem] sm:text-[1.625rem] leading-[1.3] tracking-[-0.01em]",
};

const tagMap: Record<Level, "h1" | "h2" | "h3" | "h4"> = {
  1: "h1",
  2: "h2",
  3: "h3",
  4: "h4",
};

export function Heading({ level, children, className = "" }: HeadingProps) {
  const Tag = tagMap[level];
  return (
    <Tag
      className={`font-serif font-normal text-foreground ${sizeMap[level]} ${className}`}
    >
      {children}
    </Tag>
  );
}
