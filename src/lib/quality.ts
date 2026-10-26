export type LevelLike = {
  height?: number | undefined;
  width?: number | undefined;
  bitrate?: number | undefined;
};
export type LevelOption = { index: number; label: string; height: number; bitrate: number };
export type QualityPref = "auto" | "highest" | "lowest";

export function levelLabel(l: LevelLike): string {
  if (l.height) return `${l.height}p`;
  if (l.bitrate) return `${Math.round(l.bitrate / 1000)} kbps`;
  return "Tidak diketahui";
}

/** Builds real level options from hls.levels: dedupes equal labels (keeps highest bitrate), sorted high → low. */
export function buildLevelOptions(levels: LevelLike[]): LevelOption[] {
  const byLabel = new Map<string, LevelOption>();
  levels.forEach((l, index) => {
    const opt = { index, label: levelLabel(l), height: l.height ?? 0, bitrate: l.bitrate ?? 0 };
    const prev = byLabel.get(opt.label);
    if (!prev || opt.bitrate > prev.bitrate) byLabel.set(opt.label, opt);
  });
  return [...byLabel.values()].sort((a, b) => b.height - a.height || b.bitrate - a.bitrate);
}

/** Level index to apply for a preference. -1 means hls.js automatic (ABR). */
export function preferredLevel(options: LevelOption[], pref: QualityPref): number {
  if (options.length < 2 || pref === "auto") return -1;
  return pref === "highest" ? options[0]!.index : options[options.length - 1]!.index;
}
