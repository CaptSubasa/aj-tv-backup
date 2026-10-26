export type Channel = {
  id: string;
  name: string;
  url: string;
  logo?: string | undefined;
  group: string;
  country?: string | undefined;
  tvgId?: string | undefined;
  tvgName?: string | undefined;
};

export type ParseResult = {
  channels: Channel[];
  skipped: number;
  epgUrl?: string | undefined;
};

export const UNCATEGORIZED = "Tanpa kategori";

/** Some playlists (e.g. iptv-org) literally tag channels "Undefined"/"Other"; treat those as uncategorized. */
function normalizeGroup(g: string | undefined): string {
  const v = (g ?? "").trim();
  return !v || /^(undefined|other|uncategorized)$/i.test(v) ? UNCATEGORIZED : v;
}

/** Small, deterministic FNV-1a hash -> base36 for stable channel ids. */
export function hashId(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Parses key="value", key='value' and key=value attributes. */
export function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([A-Za-z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"']+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const key = m[1]!.toLowerCase();
    const val = (m[2] ?? m[3] ?? m[4] ?? "").trim();
    if (!(key in out)) out[key] = val;
  }
  return out;
}

/** Splits "#EXTINF:-1 attrs,Title, with commas" at the first comma outside quotes. */
export function splitExtinf(line: string): { attrs: string; title: string } {
  const body = line.replace(/^#EXTINF:/i, "");
  let q: string | null = null;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (q) {
      if (ch === q) q = null;
    } else if (ch === '"' || ch === "'") {
      q = ch;
    } else if (ch === ",") {
      return { attrs: body.slice(0, i), title: body.slice(i + 1).trim() };
    }
  }
  return { attrs: body, title: "" };
}

export function isM3U(text: string): boolean {
  const t = text.replace(/^\uFEFF/, "").trimStart();
  return t.startsWith("#EXTM3U") || /#EXTINF:/i.test(t.slice(0, 50000));
}

function resolveStreamUrl(raw: string, base?: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    return /^https?:\/\//i.test(raw) ? raw : null;
  }
  if (!base) return null;
  try {
    const u = new URL(raw, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function cleanText(s: string | undefined): string | undefined {
  // eslint-disable-next-line no-control-regex -- intentionally strips control chars from playlist text
  const v = s?.replace(/[\u0000-\u001f]/g, "").trim();
  return v ? v : undefined;
}

export function parsePlaylist(text: string, baseUrl?: string): ParseResult {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n|\r/);
  const channels: Channel[] = [];
  const seen = new Map<string, number>();
  let skipped = 0;
  let epgUrl: string | undefined;
  let cur: Omit<Channel, "id" | "url"> | null = null;
  let grp: string | undefined;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#EXTM3U/i.test(line)) {
      const a = parseAttrs(line);
      const e = a["x-tvg-url"] || a["url-tvg"] || a["tvg-url"];
      if (e) epgUrl = e.split(",")[0]?.trim() || undefined;
      continue;
    }
    if (/^#EXTINF:/i.test(line)) {
      const { attrs, title } = splitExtinf(line);
      const a = parseAttrs(attrs);
      const country = cleanText(a["tvg-country"])?.split(/[;,|]/)[0]?.trim().toUpperCase();
      cur = {
        name: cleanText(title) || cleanText(a["tvg-name"]) || "Tanpa nama",
        logo: cleanText(a["tvg-logo"]) || cleanText(a["logo"]),
        group: cleanText(a["group-title"])?.split(";")[0]?.trim() || "",
        country: country || undefined,
        tvgId: cleanText(a["tvg-id"]),
        tvgName: cleanText(a["tvg-name"]),
      };
      grp = undefined;
      continue;
    }
    if (/^#EXTGRP:/i.test(line)) {
      grp = cleanText(line.slice(8));
      continue;
    }
    if (line.startsWith("#")) continue;
    if (!cur) continue; // URL without EXTINF metadata — ignore
    const url = resolveStreamUrl(line, baseUrl);
    if (!url) {
      skipped++;
      cur = null;
      continue;
    }
    const baseId = hashId(`${url}|${cur.tvgId || cur.name}`);
    const n = (seen.get(baseId) ?? 0) + 1;
    seen.set(baseId, n);
    const logo = cur.logo ? (resolveStreamUrl(cur.logo, baseUrl) ?? undefined) : undefined;
    channels.push({
      ...cur,
      logo,
      group: normalizeGroup(cur.group || grp),
      id: n === 1 ? baseId : `${baseId}-${n}`,
      url,
    });
    cur = null;
  }
  return { channels, skipped, epgUrl };
}

/** Backwards-compatible helper. */
export function parseM3U(text: string, baseUrl?: string): Channel[] {
  return parsePlaylist(text, baseUrl).channels;
}

const SPORTS_RE =
  /\b(sports?|olahraga|sepak ?bola|football|soccer|futbol|liga|league|bein|espn|eurosport|arena|golf|tennis|nba|nfl|f1|motogp|moto ?gp|racing|cricket|fight|ufc|wwe|boxing|tinju|badminton|bulu ?tangkis|volley|basket)\b/i;

export function isSportsChannel(c: Pick<Channel, "name" | "group">): boolean {
  return SPORTS_RE.test(c.group) || SPORTS_RE.test(c.name);
}

export { checkTargetUrl, isBlockedIp } from "./net-guard";
