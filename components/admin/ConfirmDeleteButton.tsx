"use client";

// Two-step delete confirmation for admin server-action forms. The original
// companies page tried `onSubmit={() => confirm(...) || event?.preventDefault()}`
// on a server-component form, which never registers a client handler; this
// component replaces browser confirm() dialogs entirely. First click arms
// the button, second click submits the surrounding <form action={remove}>.
// Clicking elsewhere or waiting 5 seconds disarms.

import { useEffect, useRef, useState } from "react";

export function ConfirmDeleteButton({ label }: { label: string }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!armed) {
      e.preventDefault();
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), 5000);
    }
    // armed: allow default submit of the surrounding form
  }

  return (
    <button
      type="submit"
      onClick={handleClick}
      onBlur={() => setArmed(false)}
      className={`rounded px-4 py-2 text-sm font-medium text-white transition-colors ${
        armed ? "bg-red-700 ring-2 ring-red-300" : "bg-red-600 hover:bg-red-700"
      }`}
    >
      {armed ? "Click again to confirm" : label}
    </button>
  );
}
