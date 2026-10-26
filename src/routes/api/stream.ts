import { createFileRoute } from "@tanstack/react-router";
import { checkTargetUrl, resolveAndCheckHost } from "@/lib/net-guard";

const MAX_REDIRECTS = 5;
const MAX_MANIFEST_BYTES = 5 * 1024 * 1024;

function errorResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function proxyUrl(url: string): string {
  return `/api/stream?url=${encodeURIComponent(url)}`;
}

function rewriteHlsManifest(text: string, baseUrl: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        return line.replace(/URI=(["'])(.*?)\1/g, (_match, quote: string, uri: string) => {
          if (!uri || uri.startsWith("data:")) {
            return `URI=${quote}${uri}${quote}`;
          }

          try {
            return `URI=${quote}${proxyUrl(new URL(uri, baseUrl).toString())}${quote}`;
          } catch {
            return `URI=${quote}${uri}${quote}`;
          }
        });
      }

      try {
        return proxyUrl(new URL(trimmed, baseUrl).toString());
      } catch {
        return line;
      }
    })
    .join("\n");
}

export const Route = createFileRoute("/api/stream")({
  server: {
    handlers: {
      GET: async ({ request }) => handleStream(request, false),
      HEAD: async ({ request }) => handleStream(request, true),
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "Range, Accept, Origin",
            "Access-Control-Expose-Headers":
              "Accept-Ranges, Content-Length, Content-Range, Content-Type",
          },
        }),
    },
  },
});

async function handleStream(request: Request, headOnly: boolean): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const target = params.get("url")?.trim() ?? "";

  if (!target || target.length > 4096) {
    return errorResponse(400, "URL stream tidak valid.");
  }

  let current = target;
  let upstream: Response | null = null;

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const bad = checkTargetUrl(current);
    if (bad) {
      return errorResponse(400, i ? `Redirect diblokir: ${bad}` : bad);
    }

    let hostname: string;
    try {
      hostname = new URL(current).hostname;
    } catch {
      return errorResponse(400, "URL stream tidak valid.");
    }

    const dnsBad = await resolveAndCheckHost(hostname);
    if (dnsBad) {
      return errorResponse(400, dnsBad);
    }

    const headers = new Headers();
    const range = request.headers.get("Range");
    const accept = request.headers.get("Accept");

    if (range) headers.set("Range", range);
    if (accept) headers.set("Accept", accept);
    headers.set("User-Agent", "AJTV/1.0 (stream player)");

    try {
      upstream = await fetch(current, {
        method: headOnly ? "HEAD" : "GET",
        headers,
        redirect: "manual",
        signal: request.signal,
      });
    } catch {
      return errorResponse(502, "Sumber streaming tidak dapat dijangkau dari server.");
    }

    const location = upstream.headers.get("Location");
    if (upstream.status >= 300 && upstream.status < 400 && location) {
      await upstream.body?.cancel().catch(() => {});

      if (i === MAX_REDIRECTS) {
        return errorResponse(502, "Terlalu banyak redirect dari sumber streaming.");
      }

      try {
        current = new URL(location, current).toString();
      } catch {
        return errorResponse(502, "URL redirect dari sumber streaming tidak valid.");
      }

      continue;
    }

    break;
  }

  if (!upstream) {
    return errorResponse(502, "Sumber streaming tidak memberikan respons.");
  }

  if (upstream.status === 401 || upstream.status === 403) {
    await upstream.body?.cancel().catch(() => {});
    return errorResponse(upstream.status, "Penyedia menolak akses ke stream.");
  }

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("Content-Type") || "";
  const contentLength = upstream.headers.get("Content-Length");
  const contentRange = upstream.headers.get("Content-Range");
  const acceptRanges = upstream.headers.get("Accept-Ranges");
  const cacheControl = upstream.headers.get("Cache-Control");

  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set(
    "Access-Control-Expose-Headers",
    "Accept-Ranges, Content-Length, Content-Range, Content-Type",
  );
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  responseHeaders.set("Cache-Control", cacheControl || "no-store");

  if (contentType) responseHeaders.set("Content-Type", contentType);
  if (contentLength) responseHeaders.set("Content-Length", contentLength);
  if (contentRange) responseHeaders.set("Content-Range", contentRange);
  if (acceptRanges) responseHeaders.set("Accept-Ranges", acceptRanges);

  let isHls = false;
  try {
    const pathname = new URL(current).pathname;
    isHls =
      /\.m3u8$/i.test(pathname) ||
      /application\/(?:vnd\.apple\.mpegurl|x-mpegurl)|audio\/mpegurl/i.test(contentType);
  } catch {
    await upstream.body?.cancel().catch(() => {});
    return errorResponse(502, "URL sumber streaming tidak valid.");
  }

  if (headOnly) {
    await upstream.body?.cancel().catch(() => {});
    return new Response(null, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  if (isHls && upstream.ok && upstream.body) {
    const reader = upstream.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        total += value.byteLength;
        if (total > MAX_MANIFEST_BYTES) {
          await reader.cancel().catch(() => {});
          return errorResponse(413, "Playlist HLS terlalu besar untuk diproses.");
        }

        chunks.push(value);
      }
    } catch {
      await reader.cancel().catch(() => {});
      return errorResponse(502, "Gagal membaca playlist HLS dari penyedia.");
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const manifest = new TextDecoder().decode(bytes);
    const rewritten = rewriteHlsManifest(manifest, current);

    responseHeaders.set("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
    responseHeaders.delete("Content-Length");
    responseHeaders.set("Cache-Control", "no-store");

    return new Response(rewritten, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
