import { useEffect, useMemo, useState } from "react";
import type { Channel } from "@/lib/m3u";
import { useApp } from "@/lib/store";
import { Player } from "./Player";

const PAGE = 120;

export function PlayerSlot({ empty }: { empty?: string }) {
  const app = useApp();
  const cur = app.playing;
  if (!cur)
    return (
      <div className="grid aspect-video place-items-center rounded-2xl border border-border bg-hero p-6 text-center">
        <div>
          <p className="font-display text-2xl font-bold">Pilih channel untuk mulai menonton</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {empty ?? "Gunakan URL M3U yang sama seperti di OTT Navigator."}
          </p>
        </div>
      </div>
    );
  return (
    <Player
      key={cur.id}
      channel={cur}
      onPrev={() => app.step(-1)}
      onNext={() => app.step(1)}
      onStop={app.stop}
      quality={app.settings.quality}
      fit={app.settings.fit}
      onFitChange={(fit) => app.updateSettings({ fit })}
      isFav={app.favorites.includes(cur.id)}
      onToggleFav={() => app.toggleFav(cur.id)}
    />
  );
}

/** Channel list with search/filters. Selection is tracked by channel id, so filtering never plays the wrong channel. */
export function ChannelList({ base, emptyText }: { base: Channel[]; emptyText: string }) {
  const app = useApp();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [country, setCountry] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const groups = useMemo(() => [...new Set(base.map((c) => c.group))].sort(), [base]);
  const countries = useMemo(
    () => [...new Set(base.map((c) => c.country).filter(Boolean) as string[])].sort(),
    [base],
  );
  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return base.filter(
      (c) =>
        (!group || c.group === group) &&
        (!country || c.country === country) &&
        (!s || c.name.toLowerCase().includes(s)),
    );
  }, [base, q, group, country]);

  const { setVisibleIds } = app;
  useEffect(() => setVisibleIds(filtered.map((c) => c.id)), [filtered, setVisibleIds]);
  useEffect(() => {
    setGroup("");
    setCountry("");
    setLimit(PAGE);
  }, [base]);

  return (
    <aside className="flex min-h-0 flex-col gap-3 rounded-2xl border border-border bg-card p-3 lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
      <select
        className="field"
        value={app.selectedId}
        onChange={(e) => app.select(e.target.value)}
        aria-label="Sumber playlist"
      >
        {app.sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.kind === "local" ? "📁 " : ""}
            {s.name}
          </option>
        ))}
      </select>
      <input
        className="field"
        placeholder="Cari channel…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setLimit(PAGE);
        }}
        aria-label="Cari channel"
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          className="field"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          aria-label="Kategori"
        >
          <option value="">Semua kategori</option>
          {groups.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <select
          className="field"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          aria-label="Negara"
          disabled={!countries.length}
        >
          <option value="">{countries.length ? "Semua negara" : "Negara tidak tersedia"}</option>
          {countries.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </div>
      {app.status.kind === "loading" && (
        <p className="text-sm text-muted-foreground">Memuat playlist…</p>
      )}
      {app.status.kind === "error" && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
          {app.status.msg}{" "}
          <button className="ml-1 underline" onClick={app.reload}>
            Coba lagi
          </button>
        </div>
      )}
      {app.status.kind === "ok" && (
        <p className="text-xs text-muted-foreground">
          {app.status.msg} · {filtered.length} ditampilkan
        </p>
      )}
      <ul className="-mx-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-1 max-lg:max-h-[60vh]">
        {app.status.kind === "ok" && !filtered.length && (
          <li className="p-3 text-sm text-muted-foreground">{emptyText}</li>
        )}
        {filtered.slice(0, limit).map((c) => {
          const on = app.playingId === c.id;
          const fav = app.favorites.includes(c.id);
          return (
            <li
              key={c.id}
              className={`flex items-center gap-1 rounded-xl transition ${on ? "bg-primary/15 ring-1 ring-primary" : "hover:bg-muted"}`}
            >
              <button
                onClick={() => {
                  app.play(c);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="flex min-w-0 flex-1 items-center gap-3 p-2 text-left"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                  {c.logo ? (
                    <img
                      src={c.logo}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-contain"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  ) : (
                    c.name.slice(0, 2)
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {c.group}
                    {c.country ? ` · ${c.country}` : ""}
                  </div>
                </div>
              </button>
              <button
                className={`px-3 text-lg ${fav ? "text-primary" : "text-muted-foreground"}`}
                onClick={() => app.toggleFav(c.id)}
                aria-label={fav ? `Hapus ${c.name} dari favorit` : `Favoritkan ${c.name}`}
                aria-pressed={fav}
              >
                {fav ? "★" : "☆"}
              </button>
            </li>
          );
        })}
        {filtered.length > limit && (
          <li>
            <button className="btn-ghost w-full" onClick={() => setLimit((l) => l + PAGE)}>
              Tampilkan lebih banyak
            </button>
          </li>
        )}
      </ul>
    </aside>
  );
}

export function WatchPage({
  title,
  base,
  emptyText,
}: {
  title: string;
  base: Channel[];
  emptyText: string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <section className="space-y-3">
        <h1 className="font-display text-xl font-bold">{title}</h1>
        <PlayerSlot />
      </section>
      <ChannelList base={base} emptyText={emptyText} />
    </div>
  );
}
