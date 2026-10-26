import { createFileRoute } from "@tanstack/react-router";
import { isM3U } from "@/lib/m3u";
import { checkTargetUrl, resolveAndCheckHost } from "@/lib/net-guard";

const LIMITS = { m3u: 20 * 1024 * 1024, epg: 40 * 1024 * 1024 } as const;
const MAX_REDIRECTS = 5;

function err(status: number, message: string) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function readLimited(
  stream: ReadableStream<Uint8Array>,
  max: number,
): Promise<Uint8Array | null> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  return buf;
}

export const Route = createFileRoute("/api/playlist")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const kind = params.get("kind") === "epg" ? "epg" : "m3u";
        const target = params.get("url")?.trim() ?? "";
        if (!target || target.length > 2048) return err(400, "Masukkan URL yang valid.");
        const max = LIMITS[kind];

        let current = target;
        let res: Response | null = null;
        for (let i = 0; i <= MAX_REDIRECTS; i++) {
          const bad = checkTargetUrl(current);
          if (bad) return err(400, i ? `Pengalihan diblokir: ${bad}` : bad);
          const dnsBad = await resolveAndCheckHost(new URL(current).hostname);
          if (dnsBad) return err(400, dnsBad);
          try {
            res = await fetch(current, {
              redirect: "manual",
              headers: { "User-Agent": "AJTV/1.0 (M3U player)", Accept: "*/*" },
              signal: AbortSignal.timeout(20000),
            });
          } catch {
            return err(504, "Server tidak dapat dihubungi atau waktu habis (20 detik).");
          }
          const loc = res.headers.get("location");
          if (res.status >= 300 && res.status < 400 && loc) {
            await res.body?.cancel().catch(() => {});
            if (i === MAX_REDIRECTS) return err(400, "Terlalu banyak pengalihan (maks 5).");
            current = new URL(loc, current).toString();
            continue;
          }
          break;
        }
        if (!res) return err(502, "Gagal mengambil data.");
        if (res.status === 401 || res.status === 403)
          return err(
            403,
            "Penyedia menolak akses (butuh login/otorisasi). AJ TV tidak melewati autentikasi atau paywall.",
          );
        if (res.status === 404) return err(404, "File tidak ditemukan di server (404).");
        if (res.status === 429)
          return err(429, "Server penyedia membatasi permintaan (429). Coba lagi nanti.");
        if (!res.ok) return err(502, `Server merespons dengan status ${res.status}.`);

        const ct = (res.headers.get("content-type") || "").toLowerCase();
        if (/^(image|video)\//.test(ct) || (/^audio\//.test(ct) && !/mpegurl/.test(ct)))
          return err(422, "Link ini mengarah ke file media/gambar, bukan playlist.");
        if (Number(res.headers.get("content-length") || 0) > max)
          return err(413, `File terlalu besar (maks ${max / 1024 / 1024} MB).`);
        if (!res.body) return err(502, "Respons kosong dari server.");

        let bytes = await readLimited(res.body, max);
        if (!bytes) return err(413, `File terlalu besar (maks ${max / 1024 / 1024} MB).`);
        if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
          const ds = new Blob([bytes as BlobPart])
            .stream()
            .pipeThrough(new DecompressionStream("gzip"));
          try {
            bytes = await readLimited(ds, max);
          } catch {
            return err(422, "File terkompresi (gzip) rusak.");
          }
          if (!bytes) return err(413, "Isi file setelah dekompresi terlalu besar.");
        }
        const text = new TextDecoder().decode(bytes);
        const head = text.slice(0, 4000);
        const html = /<html|<!doctype html/i.test(head);

        if (kind === "epg") {
          if (!/<tv[\s>]/i.test(text.slice(0, 20000)))
            return err(
              422,
              html
                ? "Link EPG mengarah ke halaman web, bukan file XMLTV."
                : "Konten bukan file XMLTV (tidak ada elemen <tv>).",
            );
        } else if (!isM3U(text)) {
          if (/#EXT-X-(STREAM-INF|TARGETDURATION|MEDIA-SEQUENCE)/.test(head))
            return err(
              422,
              "Link ini adalah stream HLS tunggal, bukan daftar channel. Gunakan URL playlist M3U yang berisi #EXTINF.",
            );
          if (/^\s*[{[]/.test(head))
            return err(
              422,
              "Server mengembalikan data JSON (kemungkinan API penyedia khusus, mis. Xtream/portal) — bukan M3U langsung.",
            );
          return err(
            422,
            html
              ? "Link ini mengarah ke halaman web, bukan file M3U langsung. Bisa jadi ini layanan berlangganan/aplikasi khusus yang butuh login — gunakan URL M3U langsung dari penyedia Anda."
              : "Konten bukan playlist M3U (tidak ada #EXTM3U/#EXTINF). Mungkin format khusus penyedia yang memerlukan autentikasi.",
          );
        }
        return new Response(text, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Final-Url": encodeURI(current),
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
