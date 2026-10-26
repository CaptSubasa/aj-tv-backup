/**
 * URL / IP safety checks for the server-side playlist fetcher.
 * Pure functions (no I/O) except resolveAndCheckHost, which uses DNS-over-HTTPS.
 */

function v4ToNum(ip: string): number | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  if (p.some((x) => x > 255)) return null;
  return ((p[0]! << 24) >>> 0) + (p[1]! << 16) + (p[2]! << 8) + p[3]!;
}

const V4_BLOCKS: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function isBlockedV4(ip: string): boolean {
  const n = v4ToNum(ip);
  if (n === null) return true;
  return V4_BLOCKS.some(([base, bits]) => {
    const b = v4ToNum(base)!;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) >>> 0 === (b & mask) >>> 0;
  });
}

/** Expands an IPv6 string to 8 numeric groups, or null if invalid. */
export function expandV6(ip: string): number[] | null {
  let s = ip
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .split("%")[0]!;
  const v4tail = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4tail) {
    const n = v4ToNum(v4tail[1]!);
    if (n === null) return null;
    s = s.slice(0, -v4tail[1]!.length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const parts = s.split("::");
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(":") : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  const fill = parts.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const all = [...head, ...Array(fill).fill("0"), ...tail];
  if (all.length !== 8 || all.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return all.map((g) => parseInt(g, 16));
}

function isBlockedV6(ip: string): boolean {
  const g = expandV6(ip);
  if (!g) return true;
  const embedded = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  if (g.every((x) => x === 0)) return true; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1
  if ((g[0]! & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA (incl. fd00:ec2::254)
  if ((g[0]! & 0xffc0) === 0xfe80) return true; // link-local
  if ((g[0]! & 0xffc0) === 0xfec0) return true; // site-local (deprecated)
  if ((g[0]! & 0xff00) === 0xff00) return true; // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
  if (g[0] === 0x0100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return true; // discard
  // IPv4-mapped / compatible ::ffff:a.b.c.d, ::a.b.c.d
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0))
    return isBlockedV4(embedded(g[6]!, g[7]!));
  if (g[0] === 0x64 && g[1] === 0xff9b) return isBlockedV4(embedded(g[6]!, g[7]!)); // NAT64
  if (g[0] === 0x2002) return isBlockedV4(embedded(g[1]!, g[2]!)); // 6to4
  if (g[0] === 0x2001 && g[1] === 0) return true; // Teredo — can tunnel to arbitrary v4
  return false;
}

export function isIpLiteral(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "");
  return v4ToNum(h) !== null || h.includes(":");
}

/** True when the IP literal is private / loopback / link-local / multicast / reserved. */
export function isBlockedIp(ip: string): boolean {
  const h = ip.replace(/^\[|\]$/g, "");
  return h.includes(":") ? isBlockedV6(h) : isBlockedV4(h);
}

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".localdomain",
  ".internal",
  ".intranet",
  ".lan",
  ".home",
  ".home.arpa",
  ".corp",
  ".private",
  ".test",
  ".invalid",
  ".onion",
];
const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "instance-data",
  "kubernetes.default",
  "metadata.azure.com",
]);

/** Synchronous URL check. Returns an Indonesian error message, or null when acceptable. */
export function checkTargetUrl(input: string): string | null {
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return "Format URL tidak valid.";
  }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    return "Hanya URL http:// atau https:// yang diizinkan.";
  if (u.username || u.password) return "URL dengan nama pengguna/kata sandi tidak diizinkan.";
  if (
    u.port &&
    !["80", "443", "8080", "8000", "8443", "8880", "25461", "2095", "2082", "8081"].includes(u.port)
  )
    return `Port ${u.port} tidak diizinkan untuk keamanan.`;
  const h = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!h) return "Host URL kosong.";
  if (isIpLiteral(h)) {
    return isBlockedIp(h) ? "Alamat IP privat/lokal/khusus tidak diizinkan." : null;
  }
  if (BLOCKED_HOSTS.has(h) || BLOCKED_HOST_SUFFIXES.some((s) => h.endsWith(s)))
    return "Alamat lokal/internal tidak diizinkan.";
  if (!h.includes(".")) return "Nama host harus berupa domain publik lengkap.";
  return null;
}

type DohAnswer = { type: number; data: string };

/**
 * Resolves A/AAAA via DNS-over-HTTPS and rejects hosts that point to blocked IPs.
 * Fails closed when resolution cannot be verified.
 */
export async function resolveAndCheckHost(host: string): Promise<string | null> {
  const h = host.replace(/^\[|\]$/g, "");
  if (isIpLiteral(h)) return isBlockedIp(h) ? "Alamat IP privat/lokal tidak diizinkan." : null;
  const query = async (type: "A" | "AAAA") => {
    const r = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(h)}&type=${type}`,
      { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(5000) },
    );
    if (!r.ok) throw new Error("doh");
    const j = (await r.json()) as { Status: number; Answer?: DohAnswer[] };
    return (j.Answer ?? []).filter((a) => a.type === 1 || a.type === 28).map((a) => a.data);
  };
  let ips: string[];
  try {
    const [a, aaaa] = await Promise.all([query("A"), query("AAAA")]);
    ips = [...a, ...aaaa];
  } catch {
    return "Tidak dapat memverifikasi alamat server playlist (DNS). Coba lagi nanti.";
  }
  if (!ips.length) return "Domain playlist tidak ditemukan (DNS).";
  if (ips.some((ip) => isBlockedIp(ip)))
    return "Domain ini mengarah ke alamat jaringan privat/lokal dan diblokir.";
  return null;
}
