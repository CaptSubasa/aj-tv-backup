import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { parsePlaylist, type Channel } from "./m3u";
import { idbAvailable, idbDelete, idbGet, idbPut } from "./idb";
import {
  DEFAULT_SETTINGS,
  DEFAULT_SOURCES,
  LS,
  buildExport,
  migrateSources,
  parseImport,
  pushHistory,
  toggleFavorite,
  validateSourceDelete,
  type HistoryEntry,
  type Settings,
  type Source,
} from "./state";

export type Status = { kind: "idle" | "loading" | "error" | "ok"; msg?: string };

type AppStore = {
  ready: boolean;
  sources: Source[];
  selectedId: string;
  channels: Channel[];
  skipped: number;
  status: Status;
  favorites: string[];
  history: HistoryEntry[];
  settings: Settings;
  playingId: string | null;
  playing: Channel | null;
  select: (id: string) => void;
  reload: () => void;
  play: (c: Channel) => void;
  stop: () => void;
  step: (d: number) => void;
  setVisibleIds: (ids: string[]) => void;
  toggleFav: (id: string) => void;
  clearHistory: () => void;
  saveSource: (s: Source) => string | null;
  deleteSource: (id: string, replacementId?: string) => string | null;
  importFile: (f: File) => Promise<string | null>;
  updateSettings: (p: Partial<Settings>) => void;
  exportJson: () => string;
  importJson: (text: string) => string | null;
};

const Ctx = createContext<AppStore | null>(null);

export function useApp(): AppStore {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp harus dipakai di dalam AppProvider");
  return v;
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [sources, setSources] = useState<Source[]>(DEFAULT_SOURCES);
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_SOURCES[0]!.id);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const loadSeq = useRef(0);

  // Hydrate from localStorage once (client only), migrating legacy keys.
  useEffect(() => {
    const migrated =
      migrateSources(readJson(LS.sources)) ??
      migrateSources(readJson(LS.legacySources)) ??
      DEFAULT_SOURCES;
    const sel =
      (localStorage.getItem(LS.selected) || localStorage.getItem(LS.legacySelected) || "").trim() ||
      migrated[0]!.id;
    setSources(migrated);
    setSelectedId(migrated.some((s) => s.id === sel) ? sel : migrated[0]!.id);
    const fav = readJson(LS.favorites);
    setFavorites(Array.isArray(fav) ? fav.filter((x): x is string => typeof x === "string") : []);
    const hist = readJson(LS.history);
    setHistory(
      Array.isArray(hist)
        ? (hist as HistoryEntry[]).filter((h) => h && typeof h.channelId === "string")
        : [],
    );
    const st = readJson(LS.settings) as Partial<Settings> | null;
    if (st && typeof st === "object")
      setSettings({
        quality: st.quality === "highest" || st.quality === "lowest" ? st.quality : "auto",
        fit: st.fit === "cover" ? "cover" : "contain",
        epgUrl: typeof st.epgUrl === "string" ? st.epgUrl : "",
      });
    if (!localStorage.getItem(LS.sources))
      localStorage.setItem(LS.sources, JSON.stringify(migrated));
    setReady(true);
  }, []);

  // Persistence (namespaced aj-tv.*).
  useEffect(() => {
    if (ready) localStorage.setItem(LS.sources, JSON.stringify(sources));
  }, [sources, ready]);
  useEffect(() => {
    if (ready && selectedId) localStorage.setItem(LS.selected, selectedId);
  }, [selectedId, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem(LS.favorites, JSON.stringify(favorites));
  }, [favorites, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem(LS.history, JSON.stringify(history));
  }, [history, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem(LS.settings, JSON.stringify(settings));
  }, [settings, ready]);

  const load = useCallback(async (src: Source | undefined) => {
    if (!src) return;
    const seq = ++loadSeq.current;
    setStatus({ kind: "loading" });
    try {
      let text: string;
      let baseUrl: string | undefined;
      if (src.kind === "local") {
        const rec = idbAvailable() ? await idbGet(src.id) : undefined;
        if (!rec)
          throw new Error(
            "File lokal tidak ditemukan di perangkat ini. Impor ulang file playlist-nya.",
          );
        text = rec.text;
      } else {
        const r = await fetch(`/api/playlist?url=${encodeURIComponent(src.url)}`);
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `Gagal memuat (status ${r.status}).`);
        }
        baseUrl = decodeURI(r.headers.get("X-Final-Url") || src.url);
        text = await r.text();
      }
      if (seq !== loadSeq.current) return;
      const parsed = parsePlaylist(text, baseUrl);
      setChannels(parsed.channels);
      setSkipped(parsed.skipped);
      setPlayingId(null);
      if (parsed.epgUrl && src.epgUrl !== parsed.epgUrl)
        setSources((l) => l.map((x) => (x.id === src.id ? { ...x, epgUrl: parsed.epgUrl } : x)));
      setStatus(
        parsed.channels.length
          ? {
              kind: "ok",
              msg: `${parsed.channels.length} channel dimuat${parsed.skipped ? ` · ${parsed.skipped} dilewati (URL tidak valid)` : ""}`,
            }
          : { kind: "error", msg: "Playlist valid tetapi tidak berisi channel." },
      );
    } catch (e) {
      if (seq !== loadSeq.current) return;
      setChannels([]);
      setSkipped(0);
      setStatus({ kind: "error", msg: e instanceof Error ? e.message : "Gagal memuat playlist." });
    }
  }, []);

  useEffect(() => {
    if (ready) void load(sources.find((s) => s.id === selectedId));
  }, [selectedId, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const playing = useMemo(
    () => channels.find((c) => c.id === playingId) ?? null,
    [channels, playingId],
  );

  const play = useCallback((c: Channel) => {
    setPlayingId(c.id);
    setHistory((h) =>
      pushHistory(h, {
        channelId: c.id,
        name: c.name,
        url: c.url,
        logo: c.logo,
        group: c.group,
        at: Date.now(),
      }),
    );
  }, []);

  const stop = useCallback(() => setPlayingId(null), []);

  const step = useCallback(
    (d: number) => {
      if (!visibleIds.length) return;
      const i = visibleIds.indexOf(playingId ?? "");
      const next = i < 0 ? 0 : (i + d + visibleIds.length) % visibleIds.length;
      const c = channels.find((x) => x.id === visibleIds[next]);
      if (c) play(c);
    },
    [visibleIds, playingId, channels, play],
  );

  const toggleFav = useCallback((id: string) => setFavorites((l) => toggleFavorite(l, id)), []);
  const clearHistory = useCallback(() => setHistory([]), []);

  const saveSource = useCallback(
    (s: Source): string | null => {
      const name = s.name.trim();
      const url = s.url.trim();
      if (!name) return "Isi nama sumber.";
      if (s.kind === "remote" && !/^https?:\/\//i.test(url))
        return "URL harus diawali http:// atau https://.";
      const clean: Source = { ...s, name, url };
      setSources((l) =>
        l.some((x) => x.id === s.id) ? l.map((x) => (x.id === s.id ? clean : x)) : [...l, clean],
      );
      if (s.id === selectedId) void load(clean);
      else setSelectedId(s.id);
      return null;
    },
    [selectedId, load],
  );

  const deleteSource = useCallback(
    (id: string, replacementId?: string): string | null => {
      const err = validateSourceDelete(sources, selectedId, id, replacementId);
      if (err) return err;
      const target = sources.find((s) => s.id === id);
      setSources((l) => l.filter((x) => x.id !== id));
      if (target?.kind === "local" && idbAvailable()) void idbDelete(id).catch(() => {});
      if (id === selectedId && replacementId) setSelectedId(replacementId);
      return null;
    },
    [sources, selectedId],
  );

  const importFile = useCallback(async (f: File): Promise<string | null> => {
    if (f.size > 20 * 1024 * 1024) return "File terlalu besar (maks 20 MB).";
    const text = await f.text();
    if (!/#EXTINF/i.test(text)) return "File ini bukan playlist M3U.";
    if (!idbAvailable()) return "Browser ini tidak mendukung penyimpanan lokal (IndexedDB).";
    const id = `local-${crypto.randomUUID()}`;
    await idbPut({ id, name: f.name, text, size: f.size, addedAt: Date.now() });
    const src: Source = {
      id,
      name: f.name.replace(/\.m3u8?$/i, ""),
      url: `local://${id}`,
      kind: "local",
    };
    setSources((l) => [...l, src]);
    setSelectedId(id);
    return null;
  }, []);

  const updateSettings = useCallback(
    (p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p })),
    [],
  );

  const exportJson = useCallback(
    () => buildExport({ sources, favorites, history, settings }),
    [sources, favorites, history, settings],
  );

  const importJson = useCallback((text: string): string | null => {
    const { data, error } = parseImport(text);
    if (error || !data) return error ?? "File tidak valid.";
    setSources(data.sources);
    setFavorites(data.favorites);
    setHistory(data.history);
    setSettings(data.settings);
    setSelectedId((cur) => (data.sources.some((s) => s.id === cur) ? cur : data.sources[0]!.id));
    return null;
  }, []);

  const value: AppStore = {
    ready,
    sources,
    selectedId,
    channels,
    skipped,
    status,
    favorites,
    history,
    settings,
    playingId,
    playing,
    select: setSelectedId,
    reload: () => void load(sources.find((s) => s.id === selectedId)),
    play,
    stop,
    step,
    setVisibleIds,
    toggleFav,
    clearHistory,
    saveSource,
    deleteSource,
    importFile,
    updateSettings,
    exportJson,
    importJson,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
