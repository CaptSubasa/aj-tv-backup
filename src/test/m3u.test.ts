import { describe, expect, it } from "vitest";
import { parsePlaylist, isSportsChannel } from "@/lib/m3u";
import { checkTargetUrl, isBlockedIp } from "@/lib/net-guard";
import { buildLevelOptions, preferredLevel } from "@/lib/quality";
import { parseXmltv, nowNext, parseXmltvTime } from "@/lib/epg";

describe("parser", () => {
  it("keeps commas in names, BOM, missing logo/category, relative URLs, stable ids", () => {
    const txt =
      '\uFEFF#EXTM3U x-tvg-url="https://e/x.xml"\n\n# comment\n#EXTINF:-1 tvg-id="a.id" group-title="News, ID",Berita, Pagi\nhttp://s/a.m3u8\n#EXTINF:-1,Tanpa Logo\nlive/b.m3u8\n#EXTINF:-1,Bad\nrtmp://x/y\n';
    const r = parsePlaylist(txt, "https://host/list/p.m3u");
    expect(r.channels.map((c) => c.name)).toEqual(["Berita, Pagi", "Tanpa Logo"]);
    expect(r.channels[0]!.group).toBe("News, ID");
    expect(r.channels[1]!.group).toBe("Tanpa kategori");
    expect(r.channels[1]!.url).toBe("https://host/list/live/b.m3u8");
    expect(r.skipped).toBe(1);
    expect(r.epgUrl).toBe("https://e/x.xml");
    expect(parsePlaylist(txt, "https://host/list/p.m3u").channels[0]!.id).toBe(r.channels[0]!.id);
  });
  it("normalizes placeholder groups like 'Undefined' to 'Tanpa kategori'", () => {
    const txt =
      '#EXTM3U\n#EXTINF:-1 group-title="Undefined",A\nhttp://s/a.m3u8\n#EXTINF:-1 group-title="other",B\nhttp://s/b.m3u8\n#EXTINF:-1 group-title="News",C\nhttp://s/c.m3u8\n';
    const r = parsePlaylist(txt);
    expect(r.channels.map((c) => c.group)).toEqual(["Tanpa kategori", "Tanpa kategori", "News"]);
  });
  it("detects sports by metadata only", () => {
    expect(isSportsChannel({ name: "beIN Sports 1", group: "" })).toBe(true);
    expect(isSportsChannel({ name: "TVRI", group: "News" })).toBe(false);
  });
});
describe("url safety", () => {
  it("blocks private/local targets", () => {
    for (const u of [
      "http://localhost/x",
      "http://192.168.1.1/x",
      "http://10.0.0.1/",
      "http://169.254.169.254/",
      "http://[::1]/",
      "http://[::ffff:127.0.0.1]/",
      "http://[fd00:ec2::254]/",
      "ftp://example.com/",
      "http://2130706433/",
      "http://metadata.google.internal/",
      "http://u:p@example.com/",
    ])
      expect(checkTargetUrl(u), u).not.toBeNull();
    expect(checkTargetUrl("https://iptv-org.github.io/iptv/index.m3u")).toBeNull();
    expect(isBlockedIp("8.8.8.8")).toBe(false);
    expect(isBlockedIp("2606:4700::1111")).toBe(false);
  });
});
describe("quality", () => {
  it("uses only real levels; auto is -1", () => {
    const o = buildLevelOptions([
      { height: 480, bitrate: 1 },
      { height: 1080, bitrate: 5 },
      { height: 720, bitrate: 3 },
    ]);
    expect(o.map((x) => x.label)).toEqual(["1080p", "720p", "480p"]);
    expect(preferredLevel(o, "auto")).toBe(-1);
    expect(preferredLevel(o, "highest")).toBe(1);
    expect(preferredLevel(buildLevelOptions([{ height: 720 }]), "highest")).toBe(-1);
  });
});
describe("epg", () => {
  it("parses timezone and current/next", () => {
    expect(parseXmltvTime("20261025190000 +0700")).toBe(Date.UTC(2026, 9, 25, 12));
    const now = Date.UTC(2026, 9, 25, 12, 30);
    const x =
      '<tv><channel id="tvri.id"><display-name>TVRI</display-name></channel><programme start="20261025190000 +0700" stop="20261025200000 +0700" channel="tvri.id"><title>Berita &amp; Info</title></programme><programme start="20261025200000 +0700" stop="20261025210000 +0700" channel="tvri.id"><title>Film</title></programme></tv>';
    const r = nowNext(parseXmltv(x, now), { name: "TVRI HD" }, now);
    expect(r.current?.title).toBe("Berita & Info");
    expect(r.next?.title).toBe("Film");
  });
});
