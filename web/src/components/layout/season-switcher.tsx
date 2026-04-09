"use client";

import { ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function SeasonSwitcher({
  seasons,
}: {
  seasons: { id: string; name: string; year: number }[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const match = pathname.match(/\/registrations\/forms\/([^/]+)/);
  const currentId = match?.[1];
  const current = seasons.find((s) => s.id === currentId);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  if (seasons.length === 0) return null;

  function selectSeason(id: string) {
    if (currentId && pathname.includes(`/registrations/forms/${currentId}`)) {
      router.push(pathname.replace(`/registrations/forms/${currentId}`, `/registrations/forms/${id}`));
    } else {
      router.push(`/registrations/forms/${id}`);
    }
    setOpen(false);
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-[220px] items-center gap-2 rounded-lg border border-foreground/15 bg-foreground/[0.03] px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-foreground/[0.06] sm:max-w-xs"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="min-w-0 flex-1 truncate">
          {current ? (
            <>
              {current.name}
              <span className="ml-1 text-foreground/55">({current.year})</span>
            </>
          ) : (
            <span className="text-foreground/60">Season</span>
          )}
        </span>
        <ChevronDown className="size-4 shrink-0 text-foreground/50" aria-hidden />
      </button>
      {open ? (
        <ul
          className="absolute left-0 top-full z-50 mt-1 max-h-72 min-w-full overflow-auto rounded-lg border border-foreground/15 bg-background py-1 shadow-lg"
          role="listbox"
        >
          {seasons.map((s) => (
            <li key={s.id} role="option" aria-selected={s.id === currentId}>
              <button
                type="button"
                onClick={() => selectSeason(s.id)}
                className={`flex w-full px-3 py-2 text-left text-sm hover:bg-foreground/[0.06] ${
                  s.id === currentId ? "bg-brand/10 font-semibold text-brand" : ""
                }`}
              >
                {s.name}{" "}
                <span className="ml-1 text-foreground/50">({s.year})</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
