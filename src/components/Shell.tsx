import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Beranda", icon: "⌂" },
  { to: "/live", label: "Live TV", icon: "📺" },
  { to: "/sports", label: "Olahraga", icon: "⚽" },
  { to: "/favorites", label: "Favorit", icon: "★" },
  { to: "/history", label: "Riwayat", icon: "🕘" },
  { to: "/guide", label: "Panduan TV", icon: "🗓" },
  { to: "/playlists", label: "Playlist", icon: "☰" },
  { to: "/settings", label: "Pengaturan", icon: "⚙" },
] as const;

const MOBILE = ["/", "/live", "/favorites", "/guide", "/settings"];

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-app pb-20 lg:pb-0">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand font-display font-bold text-primary-foreground">
              AJ
            </div>
            <span className="font-display text-lg font-bold tracking-tight">
              AJ <span className="text-primary">TV</span>
            </span>
          </Link>
          <nav className="ml-auto hidden gap-1 lg:flex" aria-label="Navigasi utama">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: true }}
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                activeProps={{ className: "bg-primary/15 !text-primary font-semibold" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <Link to="/playlists" className="btn-ghost ml-auto lg:hidden">
            Playlist
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-4">{children}</main>
      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-background/95 backdrop-blur lg:hidden"
        aria-label="Navigasi bawah"
      >
        {NAV.filter((n) => MOBILE.includes(n.to)).map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: true }}
            className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground"
            activeProps={{ className: "!text-primary font-semibold" }}
          >
            <span className="text-lg leading-none" aria-hidden>
              {n.icon}
            </span>
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
