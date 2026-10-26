import { useRef, useState } from "react";
import { useApp } from "@/lib/store";

/** JSON export/import of sources, favorites, history, and settings. */
export function BackupPanel() {
  const app = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const doExport = () => {
    const blob = new Blob([app.exportJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `aj-tv-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg({ ok: true, text: "File cadangan JSON diunduh." });
  };

  const doImport = async (f: File | undefined) => {
    if (!f) return;
    const err = app.importJson(await f.text());
    setMsg(
      err
        ? { ok: false, text: err }
        : { ok: true, text: "Data berhasil dipulihkan dari file JSON." },
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={doExport}>
          Ekspor JSON
        </button>
        <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
          Impor JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void doImport(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {msg && (
        <p className={`text-xs ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</p>
      )}
      <p className="text-xs text-muted-foreground">
        Cadangan berisi sumber, favorit, riwayat, dan pengaturan. Isi file playlist lokal tidak ikut
        tersalin ke perangkat lain — impor ulang file-nya di perangkat tersebut.
      </p>
    </div>
  );
}
