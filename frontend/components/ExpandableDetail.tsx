"use client";

import { useEffect, useState } from "react";
import { useSimpleMode } from "./SimpleModeContext";

export function ExpandableDetail({ label = "Show the numbers", children }: { label?: string; children: React.ReactNode }) {
  const { simpleMode } = useSimpleMode();
  const [open, setOpen] = useState(!simpleMode);

  useEffect(() => {
    // Expert mode starts every detail section open; Simple mode starts them
    // closed. A manual click in between still overrides this until the
    // global mode changes again.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(!simpleMode);
  }, [simpleMode]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
      >
        {open ? "Hide the numbers" : label}
      </button>
      {open && <div className="mt-1 text-xs text-slate-500">{children}</div>}
    </div>
  );
}
