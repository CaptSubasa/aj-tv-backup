import { Link, createFileRoute } from "@tanstack/react-router";
import { useApp } from "@/lib/store";
import { isSportsChannel } from "@/lib/m3u";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AJ TV — NusaPlay IPTV, TV Online dari Playlist M3U" },
      {
        name: "description",
        content:
          "Putar playlist IPTV M3U/M3U8 langsung dari browser Android atau laptop. Cari channel, favorit, riwayat, dan panduan acara.",
      },
      { property: "og:title", content: "AJ TV — NusaPlay IPTV" },
      {
        property: "og:description",
        content: "Pemutar playlist IPTV M3U modern untuk Android dan laptop.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const app = useApp();
  const sports = app.channels.filter(isSportsChannel).length;
  const recent = app.history.slice(0, 6);
  const src = app.sources.find((s) => s.id === app.selectedId);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-hero p-6 lg:p-10">
        <h1 className="font-display text-3xl font-bold lg:text-4xl">
          Nonton TV dari playlist M3U Anda
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Pakai URL M3U yang sama seperti di OTT Navigator. Short URL didukung bila tujuannya file
          M3U publik. Layanan berbayar/berlogin (Xtream, portal MAC, DRM) tidak didukung.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/live" className="btn-primary">
            Mulai menonton
          </Link>
          <Link to="/playlists" className="btn-ghost">
            Kelola playlist
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Channel dimuat", value: app.channels.length, to: "/live" },
          { label: "Channel olahraga", value: sports, to: "/sports" },
          { label: "Favorit", value: app.favorites.length, to: "/favorites" },
          { label: "Sumber playlist", value: app.sources.length, to: "/playlists" },
        ].map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className="rounded-2xl border border-border bg-card p-4 transition hover:border-primary/60"
          >
            <div className="font-display text-2xl font-bold text-primary">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </Link>
        ))}
      </section>

      {app.playing && (
        <section className="rounded-2xl border border-primary/50 bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Sedang diputar</p>
              <p className="truncate font-display font-semibold">{app.playing.name}</p>
            </div>
            <Link to="/live" className="btn-primary">
              Lanjutkan
            </Link>
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Terakhir ditonton</h2>
            <Link to="/history" className="text-sm text-primary">
              Semua riwayat
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {recent.map((h) => (
              <Link
                key={h.channelId}
                to="/history"
                className="rounded-xl border border-border bg-card p-3 transition hover:border-primary/60"
              >
                <div className="mb-2 grid h-12 w-12 place-items-center overflow-hidden rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                  {h.logo ? (
                    <img
                      src={h.logo}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-contain"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  ) : (
                    h.name.slice(0, 2)
                  )}
                </div>
                <div className="truncate text-sm font-medium">{h.name}</div>
                <div className="truncate text-xs text-muted-foreground">{h.group}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Sumber aktif: <span className="font-medium text-foreground">{src?.name ?? "—"}</span>
        {app.status.kind === "ok" && <> · {app.status.msg}</>}
        {app.status.kind === "loading" && <> · Memuat playlist…</>}
        {app.status.kind === "error" && (
          <span className="text-destructive"> · {app.status.msg}</span>
        )}
      </section>
    </div>
  );
}
