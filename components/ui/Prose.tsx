import { ReactNode } from "react";

interface ProseProps {
  children: ReactNode;
  className?: string;
}

export function Prose({ children, className = "" }: ProseProps) {
  return (
    <div
      className={`
        font-sans text-[1.125rem] leading-[1.75] text-foreground
        [&_p]:mb-5 [&_p:last-child]:mb-0
        [&_a]:text-accent [&_a]:underline [&_a:hover]:text-accent-hover
        [&_strong]:font-semibold
        [&_em]:italic
        ${className}
      `}
    >
      {children}
    </div>
  );
}
