import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useApp } from "@/lib/store";
import { isSportsChannel } from "@/lib/m3u";
import { WatchPage } from "@/components/Watch";

export const Route = createFileRoute("/sports")({
  head: () => ({
    meta: [
      { title: "Olahraga — AJ TV" },
      {
        name: "description",
        content:
          "Channel olahraga dari playlist M3U Anda: sepak bola, MotoGP, badminton, dan lainnya.",
      },
      { property: "og:title", content: "Olahraga — AJ TV" },
      { property: "og:description", content: "Channel olahraga dari playlist M3U Anda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Sports,
});

function Sports() {
  const app = useApp();
  const base = useMemo(() => app.channels.filter(isSportsChannel), [app.channels]);
  return (
    <WatchPage
      title="Olahraga"
      base={base}
      emptyText="Tidak ada channel olahraga di playlist ini."
    />
  );
}
