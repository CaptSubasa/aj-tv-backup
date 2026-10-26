import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Riwayat — AJ TV" },
      { name: "description", content: "Channel yang terakhir Anda tonton di AJ TV." },
      { property: "og:title", content: "Riwayat — AJ TV" },
      { property: "og:description", content: "Channel yang terakhir Anda tonton." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: History,
});

function History() {
  const app = useApp();
  const navigate = useNavigate();
  const byId = new Map(app.channels.map((c) => [c.id, c]));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold">Riwayat tontonan</h1>
        {app.history.length > 0 && (
          <button
            className="btn-ghost text-sm text-destructive"
            onClick={() => {
              if (confirm("Hapus semua riwayat tontonan?")) app.clearHistory();
            }}
          >
            Bersihkan riwayat
          </button>
        )}
      </div>
      {!app.history.length && (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Belum ada riwayat. Channel yang Anda putar akan muncul di sini.
        </p>
      )}
      <ul className="space-y-1">
        {app.history.map((h) => {
          const ch = byId.get(h.channelId);
          return (
            <li
              key={h.channelId}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-2"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-xs font-bold text-muted-foreground">
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
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{h.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {h.group} ·{" "}
                  {new Date(h.at).toLocaleString("id-ID", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </div>
              </div>
              {ch ? (
                <button
                  className="btn-primary text-xs"
                  onClick={() => {
                    app.play(ch);
                    navigate({ to: "/live" });
                  }}
                >
                  Putar lagi
                </button>
              ) : (
                <span className="px-2 text-xs text-muted-foreground">
                  Tidak ada di playlist aktif
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
