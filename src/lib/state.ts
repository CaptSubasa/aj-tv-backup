import type { QualityPref } from "./quality";

export type Source = {
  id: string;
  name: string;
  url: string;
  kind: "remote" | "local";
  epgUrl?: string | undefined;
};

export type HistoryEntry = {
  channelId: string;
  name: string;
  url: string;
  logo?: string | undefined;
  group: string;
  at: number;
};

export type Settings = {
  quality: QualityPref;
  fit: "contain" | "cover";
  epgUrl: string;
};

export const DEFAULT_SETTINGS: Settings = { quality: "auto", fit: "contain", epgUrl: "" };

export const DEFAULT_SOURCES: Source[] = [
  {
    id: "id",
    name: "Indonesia (iptv-org)",
    url: "https://iptv-org.github.io/iptv/countries/id.m3u",
    kind: "remote",
  },
  {
    id: "news",
    name: "Berita Dunia (iptv-org)",
    url: "https://iptv-org.github.io/iptv/categories/news.m3u",
    kind: "remote",
  },
];

/** Namespaced localStorage keys. v1 sources/selected are legacy and migrated. */
export const LS = {
  sources: "aj-tv.sources.v2",
  selected: "aj-tv.selected.v2",
  favorites: "aj-tv.favorites.v1",
  history: "aj-tv.history.v1",
  settings: "aj-tv.settings.v1",
  legacySources: "aj-tv.sources.v1",
  legacySelected: "aj-tv.selected.v1",
} as const;

export function isValidSource(s: unknown): s is Source {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o["id"] === "string" &&
    typeof o["name"] === "string" &&
    typeof o["url"] === "string" &&
    (o["kind"] === "remote" || o["kind"] === "local" || o["kind"] === undefined)
  );
}

/** Coerces a parsed JSON value into a clean source list; null when unusable. */
export function migrateSources(raw: unknown): Source[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Source[] = [];
  for (const item of raw) {
    if (!isValidSource(item)) continue;
    out.push({
      id: item.id,
      name: item.name,
      url: item.url,
      kind: item.kind === "local" ? "local" : "remote",
      epgUrl: typeof item.epgUrl === "string" ? item.epgUrl : undefined,
    });
  }
  return out.length ? out : null;
}

export const HISTORY_CAP = 100;

/** Newest first; re-watching a channel moves it to the top instead of duplicating. */
export function pushHistory(
  list: HistoryEntry[],
  entry: HistoryEntry,
  cap = HISTORY_CAP,
): HistoryEntry[] {
  return [entry, ...list.filter((h) => h.channelId !== entry.channelId)].slice(0, cap);
}

export function toggleFavorite(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/**
 * Guards source deletion. Deleting the active source requires an explicit
 * replacement; deleting the only source is never allowed.
 * Returns an Indonesian error message, or null when the delete may proceed.
 */
export function validateSourceDelete(
  sources: Source[],
  activeId: string,
  targetId: string,
  replacementId?: string,
): string | null {
  if (!sources.some((s) => s.id === targetId)) return "Sumber tidak ditemukan.";
  if (targetId !== activeId) return null;
  const others = sources.filter((s) => s.id !== targetId);
  if (!others.length)
    return "Tidak bisa menghapus satu-satunya sumber. Tambahkan sumber lain terlebih dahulu.";
  if (!replacementId || !others.some((s) => s.id === replacementId))
    return "Sumber ini sedang aktif. Pilih sumber pengganti terlebih dahulu.";
  return null;
}

export type ExportData = {
  app: "aj-tv";
  version: 1;
  exportedAt: string;
  sources: Source[];
  favorites: string[];
  history: HistoryEntry[];
  settings: Settings;
};

export function buildExport(
  d: Omit<ExportData, "app" | "version" | "exportedAt">,
  now = new Date(),
): string {
  const payload: ExportData = { app: "aj-tv", version: 1, exportedAt: now.toISOString(), ...d };
  return JSON.stringify(payload, null, 2);
}

/** Parses and validates an export file. Returns data or an Indonesian error. */
export function parseImport(text: string): { data?: ExportData; error?: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: "File bukan JSON yang valid." };
  }
  const o = raw as Partial<ExportData> | null;
  if (!o || typeof o !== "object" || o.app !== "aj-tv")
    return { error: "File ini bukan hasil ekspor AJ TV." };
  const sources = migrateSources(o.sources);
  if (!sources) return { error: "File ekspor tidak berisi sumber playlist yang valid." };
  const settingsRaw = (o.settings ?? {}) as Partial<Settings>;
  const settings: Settings = {
    quality:
      settingsRaw.quality === "highest" || settingsRaw.quality === "lowest"
        ? settingsRaw.quality
        : "auto",
    fit: settingsRaw.fit === "cover" ? "cover" : "contain",
    epgUrl: typeof settingsRaw.epgUrl === "string" ? settingsRaw.epgUrl : "",
  };
  const favorites = Array.isArray(o.favorites)
    ? o.favorites.filter((x): x is string => typeof x === "string")
    : [];
  const history = Array.isArray(o.history)
    ? o.history
        .filter(
          (h): h is HistoryEntry =>
            !!h &&
            typeof h === "object" &&
            typeof (h as HistoryEntry).channelId === "string" &&
            typeof (h as HistoryEntry).url === "string",
        )
        .slice(0, HISTORY_CAP)
    : [];
  return {
    data: {
      app: "aj-tv",
      version: 1,
      exportedAt: typeof o.exportedAt === "string" ? o.exportedAt : "",
      sources,
      favorites,
      history,
      settings,
    },
  };
}
