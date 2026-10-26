import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useApp } from "@/lib/store";
import { WatchPage } from "@/components/Watch";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "Favorit — AJ TV" },
      { name: "description", content: "Channel favorit Anda dari playlist M3U aktif." },
      { property: "og:title", content: "Favorit — AJ TV" },
      { property: "og:description", content: "Channel favorit Anda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Favorites,
});

function Favorites() {
  const app = useApp();
  const base = useMemo(
    () => app.channels.filter((c) => app.favorites.includes(c.id)),
    [app.channels, app.favorites],
  );
  return (
    <WatchPage
      title="Favorit"
      base={base}
      emptyText="Belum ada favorit. Tandai channel dengan ikon ★ di Live TV."
    />
  );
}
