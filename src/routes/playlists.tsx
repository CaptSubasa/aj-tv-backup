import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useApp } from "@/lib/store";
import type { Source } from "@/lib/state";
import { BackupPanel } from "@/components/Backup";

export const Route = createFileRoute("/playlists")({
  head: () => ({
    meta: [
      { title: "Playlist Manager — AJ TV" },
      {
        name: "description",
        content:
          "Tambah, ubah, hapus, dan ganti sumber playlist M3U; impor file lokal; cadangkan data sebagai JSON.",
      },
      { property: "og:title", content: "Playlist Manager — AJ TV" },
      { property: "og:description", content: "Kelola sumber playlist M3U Anda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Playlists,
});

function Playlists() {
  const app = useApp();
  const [editing, setEditing] = useState<Source | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [replacement, setReplacement] = useState("");
  const [delErr, setDelErr] = useState<string | null>(null);
  const [fileMsg, setFileMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (!editing) return;
    const err = app.saveSource(editing);
    setFormErr(err);
    if (!err) setEditing(null);
  };

  const confirmDelete = () => {
    if (!delId) return;
    const err = app.deleteSource(delId, replacement || undefined);
    setDelErr(err);
    if (!err) {
      setDelId(null);
      setReplacement("");
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const err = await app.importFile(f);
    setFileMsg(err ?? `File "${f.name}" tersimpan di perangkat dan dimuat.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold">Playlist Manager</h1>
        <button
          className="btn-primary"
          onClick={() => {
            setEditing({ id: crypto.randomUUID(), name: "", url: "", kind: "remote" });
            setFormErr(null);
          }}
        >
          + Tambah URL
        </button>
      </div>

      <ul className="space-y-2">
        {app.sources.map((s) => (
          <li
            key={s.id}
            className={`rounded-xl border p-3 ${s.id === app.selectedId ? "border-primary bg-primary/10" : "border-border bg-card"}`}
          >
            <div className="flex items-center gap-2">
              <button className="min-w-0 flex-1 text-left" onClick={() => app.select(s.id)}>
                <div className="truncate text-sm font-medium">
                  {s.kind === "local" ? "📁 " : ""}
                  {s.name}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {s.kind === "local" ? "File lokal (tersimpan di perangkat ini)" : s.url}
                </div>
              </button>
              {s.id === app.selectedId && (
                <span className="rounded-md bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
                  Aktif
                </span>
              )}
              <button
                className="btn-ghost px-2 text-xs"
                onClick={() => {
                  setEditing(s);
                  setFormErr(null);
                }}
              >
                Ubah
              </button>
              <button
                className="btn-ghost px-2 text-xs text-destructive"
                onClick={() => {
                  if (s.id === app.selectedId) {
                    setDelId(s.id);
                    setReplacement("");
                    setDelErr(null);
                  } else if (confirm(`Hapus "${s.name}"?`)) app.deleteSource(s.id);
                }}
              >
                Hapus
              </button>
            </div>
            {delId === s.id && (
              <div className="mt-3 space-y-2 rounded-xl bg-muted p-3">
                <p className="text-sm">
                  Sumber ini sedang aktif. Pilih sumber pengganti sebelum menghapus:
                </p>
                <select
                  className="field"
                  value={replacement}
                  onChange={(e) => setReplacement(e.target.value)}
                  aria-label="Sumber pengganti"
                >
                  <option value="">— Pilih pengganti —</option>
                  {app.sources
                    .filter((x) => x.id !== s.id)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                </select>
                {delErr && <p className="text-xs text-destructive">{delErr}</p>}
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={confirmDelete}>
                    Hapus & ganti
                  </button>
                  <button className="btn-ghost" onClick={() => setDelId(null)}>
                    Batal
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {editing && (
        <form
          className="space-y-2 rounded-2xl border border-border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <h2 className="font-display font-semibold">
            {app.sources.some((x) => x.id === editing.id) ? "Ubah sumber" : "Tambah sumber"}
          </h2>
          <input
            className="field"
            placeholder="Nama sumber"
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            aria-label="Nama sumber"
          />
          {editing.kind === "remote" ? (
            <input
              className="field"
              placeholder="https://contoh.com/playlist.m3u atau short URL"
              value={editing.url}
              onChange={(e) => setEditing({ ...editing, url: e.target.value })}
              aria-label="URL playlist"
            />
          ) : (
            <p className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">
              Sumber lokal memakai file yang tersimpan di perangkat; URL tidak bisa diubah.
            </p>
          )}
          {formErr && <p className="text-xs text-destructive">{formErr}</p>}
          <div className="flex gap-2">
            <button className="btn-primary" type="submit">
              Simpan & muat
            </button>
            <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>
              Batal
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Short URL didukung bila tujuannya file M3U publik. Layanan berbayar/berlogin (Xtream,
            portal MAC, DRM) tidak didukung.
          </p>
        </form>
      )}

      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display font-semibold">Impor file playlist (.m3u/.m3u8)</h2>
        <p className="text-xs text-muted-foreground">
          File disimpan di perangkat ini (IndexedDB) dan bisa diputar kapan saja tanpa mengunggah
          ulang.
        </p>
        <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
          Pilih file…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".m3u,.m3u8,audio/x-mpegurl,text/plain"
          hidden
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {fileMsg && <p className="text-xs text-muted-foreground">{fileMsg}</p>}
      </section>

      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display font-semibold">Cadangkan & pulihkan</h2>
        <BackupPanel />
      </section>
    </div>
  );
}
