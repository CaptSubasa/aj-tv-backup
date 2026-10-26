import type { Channel } from "./m3u";

export type Programme = { start: number; stop: number; title: string; desc?: string | undefined };
export type EpgData = {
  /** XMLTV channel id -> programmes sorted by start */
  programmes: Map<string, Programme[]>;
  /** normalized display-name -> XMLTV channel id */
  names: Map<string, string>;
  channelCount: number;
  programmeCount: number;
};

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
export function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const n =
          e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
      }
      return ENT[e.toLowerCase()] ?? m;
    })
    .trim();
}

/** Parses XMLTV time "YYYYMMDDHHMMSS +HHMM" to epoch ms (UTC if no offset). */
export function parseXmltvTime(s: string): number | null {
  const m = s.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{2}:?\d{2}|Z)?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se = "00", tz] = m;
  let t = Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!, +se);
  if (tz && tz !== "Z") {
    const sign = tz[0] === "-" ? -1 : 1;
    const digits = tz.replace(/[^\d]/g, "");
    t -= sign * (+digits.slice(0, 2) * 60 + +digits.slice(2, 4)) * 60000;
  }
  return Number.isFinite(t) ? t : null;
}

export const normName = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(hd|fhd|uhd|sd|4k|\d{3,4}p)\b/g, "")
    .replace(/\[[^\]]*\]|\([^)]*\)/g, "")
    .replace(/[^a-z0-9]/g, "");

/** Defensive regex-based XMLTV parser; keeps only programmes within [now-windowBack, now+windowFwd]. */
export function parseXmltv(
  text: string,
  now = Date.now(),
  back = 6 * 3600e3,
  fwd = 36 * 3600e3,
): EpgData {
  const programmes = new Map<string, Programme[]>();
  const names = new Map<string, string>();
  let channelCount = 0;
  let programmeCount = 0;
  const attr = (tag: string, k: string) =>
    tag
      .match(new RegExp(`\\s${k}\\s*=\\s*"([^"]*)"|\\s${k}\\s*=\\s*'([^']*)'`))
      ?.slice(1)
      .find((x) => x !== undefined);

  for (const m of text.matchAll(/<channel\b([^>]*)>([\s\S]*?)<\/channel>/g)) {
    const id = attr(m[1]!, "id");
    if (!id) continue;
    channelCount++;
    const cid = decodeXml(id);
    for (const dn of m[2]!.matchAll(/<display-name\b[^>]*>([\s\S]*?)<\/display-name>/g)) {
      const n = normName(decodeXml(dn[1]!));
      if (n && !names.has(n)) names.set(n, cid);
    }
  }
  for (const m of text.matchAll(/<programme\b([^>]*)>([\s\S]*?)<\/programme>/g)) {
    const a = m[1]!;
    const ch = attr(a, "channel");
    const start = parseXmltvTime(attr(a, "start") ?? "");
    const stop = parseXmltvTime(attr(a, "stop") ?? "");
    if (!ch || start === null) continue;
    const end = stop ?? start + 3600e3;
    if (end < now - back || start > now + fwd) continue;
    const title =
      decodeXml(m[2]!.match(/<title\b[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? "") || "Tanpa judul";
    const descRaw = m[2]!.match(/<desc\b[^>]*>([\s\S]*?)<\/desc>/)?.[1];
    const id = decodeXml(ch);
    const list = programmes.get(id) ?? [];
    list.push({
      start,
      stop: end,
      title,
      desc: descRaw ? decodeXml(descRaw).slice(0, 500) : undefined,
    });
    programmes.set(id, list);
    programmeCount++;
  }
  for (const l of programmes.values()) l.sort((x, y) => x.start - y.start);
  return { programmes, names, channelCount, programmeCount };
}

export function epgIdFor(
  epg: EpgData,
  c: Pick<Channel, "tvgId" | "tvgName" | "name">,
): string | undefined {
  if (c.tvgId && epg.programmes.has(c.tvgId)) return c.tvgId;
  for (const n of [c.tvgName, c.name]) {
    if (!n) continue;
    const id = epg.names.get(normName(n));
    if (id) return id;
  }
  return undefined;
}

export function nowNext(
  epg: EpgData,
  c: Pick<Channel, "tvgId" | "tvgName" | "name">,
  now = Date.now(),
) {
  const id = epgIdFor(epg, c);
  const list = id ? (epg.programmes.get(id) ?? []) : [];
  const i = list.findIndex((p) => p.start <= now && p.stop > now);
  const current = i >= 0 ? list[i] : undefined;
  const next = i >= 0 ? list[i + 1] : list.find((p) => p.start > now);
  return { current, next, matched: !!id };
}
