import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { BackupPanel } from "@/components/Backup";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Pengaturan — AJ TV" },
      {
        name: "description",
        content: "Atur kualitas video bawaan, tampilan video, URL EPG, dan data aplikasi AJ TV.",
      },
      { property: "og:title", content: "Pengaturan — AJ TV" },
      {
        property: "og:description",
        content: "Atur kualitas video, tampilan, EPG, dan data aplikasi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Settings,
});

function Settings() {
  const app = useApp();
  const [epg, setEpg] = useState(app.settings.epgUrl);
  const [saved, setSaved] = useState(false);

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="font-display text-xl font-bold">Pengaturan</h1>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display font-semibold">Pemutar video</h2>
        <label className="block text-sm">
          Kualitas bawaan saat stream dibuka
          <select
            className="field mt-1"
            value={app.settings.quality}
            onChange={(e) =>
              app.updateSettings({ quality: e.target.value as "auto" | "highest" | "lowest" })
            }
          >
            <option value="auto">Otomatis (sesuai kecepatan internet)</option>
            <option value="highest">Tertinggi yang tersedia</option>
            <option value="lowest">Terendah (hemat kuota)</option>
          </select>
        </label>
        <label className="block text-sm">
          Tampilan video
          <select
            className="field mt-1"
            value={app.settings.fit}
            onChange={(e) => app.updateSettings({ fit: e.target.value as "contain" | "cover" })}
          >
            <option value="contain">Fit — seluruh gambar terlihat (ada bilah hitam)</option>
            <option value="cover">Fill — memenuhi layar (tepi gambar terpotong)</option>
          </select>
        </label>
      </section>

      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display font-semibold">Panduan TV (EPG)</h2>
        <p className="text-xs text-muted-foreground">
          Diisi otomatis bila playlist punya x-tvg-url. Isi manual untuk menimpa.
        </p>
        <input
          className="field"
          placeholder="https://contoh.com/epg.xml"
          value={epg}
          onChange={(e) => {
            setEpg(e.target.value);
            setSaved(false);
          }}
          aria-label="URL EPG"
        />
        <button
          className="btn-primary"
          onClick={() => {
            app.updateSettings({ epgUrl: epg.trim() });
            setSaved(true);
          }}
        >
          Simpan URL EPG
        </button>
        {saved && <p className="text-xs text-primary">Tersimpan.</p>}
      </section>

      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display font-semibold">Data</h2>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-ghost"
            onClick={() => {
              if (confirm("Hapus semua riwayat tontonan?")) app.clearHistory();
            }}
          >
            Bersihkan riwayat
          </button>
        </div>
        <BackupPanel />
      </section>
    </div>
  );
}
