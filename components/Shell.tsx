import Link from "next/link";
import type { ReactNode } from "react";
import { getDb, getMeta } from "@/lib/db";

function resolveActiveStoryHref(): string {
  try {
    const stored = getMeta("active_session_id");
    if (stored) {
      const row = getDb()
        .prepare<string, { id: string }>("SELECT id FROM session WHERE id = ?")
        .get(stored);
      if (row) return `/story/${row.id}`;
    }
    const latest = getDb()
      .prepare<[], { id: string }>("SELECT id FROM session ORDER BY updated_at DESC LIMIT 1")
      .get();
    if (latest) return `/story/${latest.id}`;
  } catch {}
  return "/story/new";
}

export function Shell({ children, active }: { children: ReactNode; active?: string }) {
  const storyHref = resolveActiveStoryHref();
  const hasActive = storyHref !== "/story/new";
  return (
    <div className="relative min-h-screen grain">
      <header
        className="sticky top-0 z-30 backdrop-blur-md"
        style={{
          background: "color-mix(in srgb, var(--color-bg-primary) 80%, transparent)",
          borderBottom: "0.5px solid var(--color-border)",
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md" style={{ background: "var(--color-accent)" }} />
            <div className="flex flex-col leading-none">
              <span style={{ fontFamily: "var(--font-display)", fontSize: 20, letterSpacing: "-0.02em" }}>
                Mesa
              </span>
              <span className="label">DM local — D&amp;D 5E</span>
            </div>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink href="/" active={active === "home"} label="Baúl" />
            <NavLink
              href={storyHref}
              active={active === "story"}
              label="Historia"
              badge={hasActive ? "en curso" : undefined}
            />
            <NavLink href="/character/new" active={active === "character"} label="Personajes" />
            <NavLink href="/settings" active={active === "settings"} label="Ajustes" />
          </nav>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-7xl px-6 py-10">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  label,
  active,
  badge,
}: {
  href: string;
  label: string;
  active?: boolean;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="relative rounded-md px-3 py-2 text-sm transition"
      style={{
        color: active ? "var(--color-accent)" : "var(--color-text-secondary)",
        background: active ? "var(--color-accent-bg)" : "transparent",
      }}
    >
      {label}
      {badge && (
        <span
          className="ml-2 rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wide"
          style={{
            background: "var(--color-accent)",
            color: "white",
            letterSpacing: "0.08em",
          }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
