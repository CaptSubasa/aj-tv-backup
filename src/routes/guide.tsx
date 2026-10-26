import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { nowNext, parseXmltv, type EpgData } from "@/lib/epg";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "Panduan TV (EPG) — AJ TV" },
      {
        name: "description",
        content: "Jadwal acara sekarang dan berikutnya untuk channel di playlist M3U Anda.",
      },
      { property: "og:title", content: "Panduan TV (EPG) — AJ TV" },
      {
        property: "og:description",
        content: "Jadwal acara sekarang dan berikutnya untuk channel Anda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Guide,
});

type EpgState = { kind: "idle" | "loading" | "error" | "ok"; msg?: string; data?: EpgData };

const fmt = (t: number) =>
  new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

function Guide() {
  const app = useApp();
  const navigate = useNavigate();
  const src = app.sources.find((s) => s.id === app.selectedId);
  const epgUrl = app.settings.epgUrl.trim() || src?.epgUrl || "";
  const [st, setSt] = useState<EpgState>({ kind: "idle" });
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!epgUrl) {
      setSt({ kind: "idle" });
      return;
    }
    let cancelled = false;
    setSt({ kind: "loading" });
    (async () => {
      try {
        const r = await fetch(`/api/playlist?kind=epg&url=${encodeURIComponent(epgUrl)}`);
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `Gagal memuat EPG (status ${r.status}).`);
        }
        const data = parseXmltv(await r.text());
        if (cancelled) return;
        setSt(
          data.programmeCount
            ? {
                kind: "ok",
                data,
                msg: `${data.channelCount} channel · ${data.programmeCount} acara`,
              }
            : {
                kind: "error",
                msg: "File EPG valid tetapi tidak ada acara dalam rentang waktu dekat.",
              },
        );
      } catch (e) {
        if (!cancelled)
          setSt({ kind: "error", msg: e instanceof Error ? e.message : "Gagal memuat EPG." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [epgUrl]);

  const rows = app.channels
    .map((c) => ({ c, nn: st.data ? nowNext(st.data, c) : null }))
    .filter((r) => r.nn?.matched)
    .filter((r) => !q || r.c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-3">
      <h1 className="font-display text-xl font-bold">Panduan TV (EPG)</h1>
      {!epgUrl && (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Playlist aktif tidak menyertakan URL EPG (x-tvg-url). Anda bisa mengisi URL EPG XMLTV
          manual di{" "}
          <a href="/settings" className="text-primary underline">
            Pengaturan
          </a>
          .
        </p>
      )}
      {st.kind === "loading" && (
        <p className="text-sm text-muted-foreground">Memuat jadwal acara…</p>
      )}
      {st.kind === "error" && (
        <p className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {st.msg}
        </p>
      )}
      {st.kind === "ok" && (
        <>
          <div className="flex items-center gap-3">
            <input
              className="field max-w-xs"
              placeholder="Cari channel…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Cari channel di panduan"
            />
            <span className="text-xs text-muted-foreground">
              {st.msg} · {rows.length} channel cocok
            </span>
          </div>
          <ul className="space-y-1">
            {rows.map(({ c, nn }) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-2"
              >
                <button
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => {
                    app.play(c);
                    navigate({ to: "/live" });
                  }}
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
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.name}</div>
                    {nn?.current ? (
                      <div className="truncate text-xs">
                        <span className="text-primary">●</span> {fmt(nn.current.start)}–
                        {fmt(nn.current.stop)} {nn.current.title}
                      </div>
                    ) : (
                      <div className="truncate text-xs text-muted-foreground">
                        Tidak ada acara saat ini
                      </div>
                    )}
                    {nn?.next && (
                      <div className="truncate text-xs text-muted-foreground">
                        Berikutnya {fmt(nn.next.start)}: {nn.next.title}
                      </div>
                    )}
                  </div>
                </button>
              </li>
            ))}
            {!rows.length && (
              <li className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                Tidak ada channel yang cocok dengan data EPG.
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
