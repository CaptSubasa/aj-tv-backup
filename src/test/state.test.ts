import { describe, expect, it } from "vitest";
import {
  DEFAULT_SOURCES,
  buildExport,
  migrateSources,
  parseImport,
  pushHistory,
  toggleFavorite,
  validateSourceDelete,
  type HistoryEntry,
  type Source,
} from "@/lib/state";

const src = (id: string, kind: "remote" | "local" = "remote"): Source => ({
  id,
  name: id,
  url: `https://x/${id}.m3u`,
  kind,
});
const hist = (id: string, at: number): HistoryEntry => ({
  channelId: id,
  name: id,
  url: `https://s/${id}`,
  group: "g",
  at,
});

describe("source migration", () => {
  it("migrates legacy v1 sources (no kind) to remote sources", () => {
    const legacy = [{ id: "a", name: "A", url: "https://a/x.m3u" }];
    expect(migrateSources(legacy)).toEqual([
      { id: "a", name: "A", url: "https://a/x.m3u", kind: "remote", epgUrl: undefined },
    ]);
  });
  it("rejects garbage and empty lists", () => {
    expect(migrateSources("nope")).toBeNull();
    expect(migrateSources([])).toBeNull();
    expect(migrateSources([{ id: 1 }])).toBeNull();
  });
  it("keeps local kind and epgUrl", () => {
    const r = migrateSources([
      { id: "l", name: "L", url: "local://l", kind: "local", epgUrl: "https://e/x.xml" },
    ]);
    expect(r?.[0]).toMatchObject({ kind: "local", epgUrl: "https://e/x.xml" });
  });
});

describe("history", () => {
  it("dedupes by channel, newest first, capped at 100", () => {
    let list: HistoryEntry[] = [];
    for (let i = 0; i < 120; i++) list = pushHistory(list, hist(`c${i}`, i));
    expect(list).toHaveLength(100);
    expect(list[0]!.channelId).toBe("c119");
    list = pushHistory(list, hist("c50", 999));
    expect(list[0]!.channelId).toBe("c50");
    expect(list.filter((h) => h.channelId === "c50")).toHaveLength(1);
  });
});

describe("favorites", () => {
  it("toggles without duplicates", () => {
    expect(toggleFavorite([], "a")).toEqual(["a"]);
    expect(toggleFavorite(["a"], "a")).toEqual([]);
    expect(toggleFavorite(["a"], "b")).toEqual(["a", "b"]);
  });
});

describe("delete guard", () => {
  const sources = [src("a"), src("b")];
  it("allows deleting a non-active source", () => {
    expect(validateSourceDelete(sources, "a", "b")).toBeNull();
  });
  it("blocks deleting the active source without a replacement", () => {
    expect(validateSourceDelete(sources, "a", "a")).toMatch(/pengganti/i);
    expect(validateSourceDelete(sources, "a", "a", "zzz")).toMatch(/pengganti/i);
  });
  it("allows deleting the active source with a valid replacement", () => {
    expect(validateSourceDelete(sources, "a", "a", "b")).toBeNull();
  });
  it("blocks deleting the only source", () => {
    expect(validateSourceDelete([src("a")], "a", "a", "b")).toMatch(/satu-satunya/i);
  });
});

describe("json backup", () => {
  it("round-trips export -> import", () => {
    const json = buildExport({
      sources: DEFAULT_SOURCES,
      favorites: ["x"],
      history: [hist("c1", 1)],
      settings: { quality: "lowest", fit: "cover", epgUrl: "https://e/x.xml" },
    });
    const { data, error } = parseImport(json);
    expect(error).toBeUndefined();
    expect(data?.favorites).toEqual(["x"]);
    expect(data?.settings.quality).toBe("lowest");
    expect(data?.sources).toHaveLength(2);
  });
  it("rejects non-AJ TV files and invalid JSON", () => {
    expect(parseImport("not json").error).toBeTruthy();
    expect(parseImport('{"app":"other"}').error).toBeTruthy();
    expect(parseImport('{"app":"aj-tv","sources":[]}').error).toBeTruthy();
  });
});
