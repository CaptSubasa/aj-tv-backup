import { createFileRoute } from "@tanstack/react-router";
import { useApp } from "@/lib/store";
import { WatchPage } from "@/components/Watch";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Live TV — AJ TV" },
      {
        name: "description",
        content:
          "Semua channel dari playlist M3U aktif: cari, filter kategori dan negara, lalu putar langsung.",
      },
      { property: "og:title", content: "Live TV — AJ TV" },
      { property: "og:description", content: "Semua channel dari playlist M3U aktif." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Live,
});

function Live() {
  const app = useApp();
  return (
    <WatchPage
      title="Live TV"
      base={app.channels}
      emptyText="Tidak ada channel yang cocok dengan filter."
    />
  );
}
