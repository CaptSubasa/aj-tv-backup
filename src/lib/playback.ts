export type StreamFormat =
  | "hls"
  | "ts"
  | "mp4"
  | "webm"
  | "ogg"
  | "audio"
  | "dash"
  | "unknown";

export type PlaybackIssue = {
  kind:
    | "mixed-content"
    | "unsupported"
    | "network"
    | "unavailable"
    | "access"
    | "invalid";
  message: string;
};

export function detectStreamFormat(value: string): StreamFormat {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return "unknown";
  }

  const path = url.pathname.toLowerCase();

  if (/\.m3u8?$/.test(path)) return "hls";
  if (/\.(ts|mts|m2ts)$/.test(path)) return "ts";
  if (/\.(mp4|m4v|mov)$/.test(path)) return "mp4";
  if (/\.webm$/.test(path)) return "webm";
  if (/\.(ogg|ogv)$/.test(path)) return "ogg";
  if (/\.(mp3|aac|m4a|wav|oga)$/.test(path)) return "audio";
  if (/\.mpd$/.test(path)) return "dash";

  return "unknown";
}

export function checkPlaybackUrl(
  value: string,
  pageProtocol: string,
): PlaybackIssue | null {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return {
      kind: "invalid",
      message: "URL stream tidak valid.",
    };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      kind: "invalid",
      message: "URL stream harus menggunakan HTTP atau HTTPS.",
    };
  }

  if (pageProtocol === "https:" && url.protocol === "http:") {
    return {
      kind: "mixed-content",
      message:
        "Stream menggunakan HTTP, sedangkan AJ TV dibuka melalui HTTPS (mixed content). Browser dapat memblokir pemutaran. Gunakan URL HTTPS resmi dari penyedia.",
    };
  }

  return null;
}

export function unsupportedFormat(
  format: StreamFormat,
): PlaybackIssue {
  const detail =
    format === "ts"
      ? "Stream MPEG-TS (.ts) langsung tidak didukung oleh pemutar browser ini. MPEG-TS langsung berbeda dari playlist HLS."
      : format === "dash"
        ? "Stream MPEG-DASH (.mpd) tidak didukung oleh pemutar ini."
        : format === "hls"
          ? "Stream HLS tidak dapat diputar karena dukungan HLS bawaan atau hls.js belum tersedia."
          : "Format atau codec stream tidak didukung browser.";

  return {
    kind: "unsupported",
    message: `${detail} Gunakan format yang kompatibel dari penyedia.`,
  };
}

export function nativePlaybackIssue(
  code: number,
  format: StreamFormat,
): PlaybackIssue {
  if (code === 2) {
    return {
      kind: "network",
      message:
        "Koneksi stream gagal. Server mungkin tidak terjangkau atau browser menolak akses. Penyebab pastinya belum dapat dipastikan.",
    };
  }

  if (code === 3) {
    return {
      kind: "unsupported",
      message:
        "Video gagal didekode. Codec mungkin tidak didukung atau data stream rusak.",
    };
  }

  if (format === "unknown" || code === 4) {
    return {
      kind: "unsupported",
      message:
        "Pemutar tidak dapat membuka sumber ini. Format mungkin tidak didukung, URL tidak tersedia, atau akses ditolak. URL tanpa ekstensi tidak otomatis dianggap sebagai HLS.",
    };
  }

  return {
    kind: "network",
    message: "Pemutaran terhenti. Coba muat ulang stream.",
  };
}

export function hlsPlaybackIssue(
  type: string,
  details: string,
  status?: number,
): PlaybackIssue {
  if (status === 401 || status === 403) {
    return {
      kind: "access",
      message: `Penyedia menolak akses stream (HTTP ${status}). Periksa izin akses atau pembatasan wilayah.`,
    };
  }

  if (status === 404 || status === 410) {
    return {
      kind: "unavailable",
      message: `URL playlist atau bagian stream tidak tersedia (HTTP ${status}). Periksa URL dari penyedia.`,
    };
  }

  if (
    /parsing|incompatible|codec|decrypt|keySystem/i.test(details) ||
    type === "mediaError"
  ) {
    return {
      kind: "unsupported",
      message:
        "Format HLS, codec, atau enkripsi stream tidak didukung, atau data stream rusak. Gunakan stream kompatibel yang diizinkan penyedia.",
    };
  }

  return {
    kind: "network",
    message: status
      ? `Pemuatan stream gagal (HTTP ${status}). Server mungkin bermasalah atau membatasi permintaan.`
      : "Pemuatan HLS gagal. Periksa koneksi, URL stream, dan kemungkinan pembatasan CORS.",
  };
}

export function nativeMimeType(
  format: StreamFormat,
): string | null {
  switch (format) {
    case "ts":
      return "video/mp2t";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "ogg":
      return "video/ogg";
    default:
      return null;
  }
}