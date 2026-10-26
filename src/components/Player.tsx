import { useEffect, useRef, useState } from "react";
import type { Channel } from "@/lib/m3u";
import { Button } from "@/components/ui/button";
import {
  checkPlaybackUrl,
  detectStreamFormat,
  hlsPlaybackIssue,
  nativeMimeType,
  nativePlaybackIssue,
  unsupportedFormat,
} from "@/lib/playback";
import {
  buildLevelOptions,
  preferredLevel,
  type LevelOption,
  type QualityPref,
} from "@/lib/quality";

type Track = { id: number; label: string };

export function Player({
  channel,
  onPrev,
  onNext,
  onStop,
  quality,
  fit,
  onFitChange,
  isFav,
  onToggleFav,
}: {
  channel: Channel;
  onPrev: () => void;
  onNext: () => void;
  onStop: () => void;
  quality: QualityPref;
  fit: "contain" | "cover";
  onFitChange: (f: "contain" | "cover") => void;
  isFav: boolean;
  onToggleFav: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<import("hls.js").default | null>(null);
  const [levels, setLevels] = useState<LevelOption[]>([]);
  const [level, setLevel] = useState(-1);
  const [active, setActive] = useState("");
  const [audio, setAudio] = useState<Track[]>([]);
  const [audioId, setAudioId] = useState(-1);
  const [subs, setSubs] = useState<Track[]>([]);
  const [subId, setSubId] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"pending" | "hls" | "native">("pending");
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [paused, setPaused] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [pipOk, setPipOk] = useState(false);

  useEffect(() => {
    setPipOk(
      typeof document !== "undefined" &&
        "pictureInPictureEnabled" in document &&
        !!document.pictureInPictureEnabled,
    );
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    setLevels([]);
    setLevel(-1);
    setActive("");
    setAudio([]);
    setSubs([]);
    setAudioId(-1);
    setSubId(-1);
    setError(null);
    setLoading(true);
    setMode("pending");
    const url = channel.url;
    const stopMedia = () => {
      video.pause();
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
    };
    stopMedia();
    setPaused(true);
    const blocked = checkPlaybackUrl(url, window.location.protocol);
    if (blocked) {
      setError(blocked.message);
      setLoading(false);
      return;
    }
    const format = detectStreamFormat(url);
    const fail = (message: string) => {
      if (cancelled) return;
      setLoading(false);
      setError(message);
      stopMedia();
    };
    const useNative = () => {
      const mime = nativeMimeType(format);
      if (format === "dash" || (mime && !video.canPlayType(mime))) {
        fail(unsupportedFormat(format).message);
        return;
      }
      setMode("native");
      video.src = url;
      video.play().catch(() => {});
    };
    (async () => {
      if (format !== "hls") {
        useNative();
        return;
      }
      const Hls = (await import("hls.js")).default;
      if (cancelled) return;
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hlsRef.current = hls;
        setMode("hls");
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          const opts = buildLevelOptions(hls.levels);
          setLevels(opts);
          const pref = preferredLevel(opts, quality);
          hls.currentLevel = pref;
          setLevel(pref);
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_e, d) => {
          const l = hls.levels[d.level];
          if (l)
            setActive(l.height ? `${l.height}p` : `${Math.round((l.bitrate || 0) / 1000)} kbps`);
        });
        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
          setAudio(
            hls.audioTracks.map((t, i) => ({ id: i, label: t.name || t.lang || `Audio ${i + 1}` })),
          );
          setAudioId(hls.audioTrack);
        });
        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
          setSubs(
            hls.subtitleTracks.map((t, i) => ({
              id: i,
              label: t.name || t.lang || `Subtitle ${i + 1}`,
            })),
          );
          setSubId(hls.subtitleTrack);
        });
        hls.on(Hls.Events.ERROR, (_e, d) => {
          if (!d.fatal || cancelled) return;
          fail(hlsPlaybackIssue(d.type, d.details, d.response?.code).message);
        });
        hls.loadSource(url);
        hls.attachMedia(video);
      } else if (
        video.canPlayType("application/vnd.apple.mpegurl") ||
        video.canPlayType("application/x-mpegURL")
      ) {
        useNative();
      } else {
        fail(unsupportedFormat("hls").message);
      }
    })().catch(() => {
      if (cancelled) return;
      if (format === "hls" && video.canPlayType("application/vnd.apple.mpegurl")) useNative();
      else fail("Pemutar HLS gagal dimuat. Periksa koneksi dan coba Ulangi.");
    });
    return () => {
      cancelled = true;
      stopMedia();
    };
    // quality is applied on (re)load only; manual selection overrides it afterwards.
  }, [channel.url, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickLevel = (i: number) => {
    const hls = hlsRef.current;
    if (!hls || (i !== -1 && !levels.some((option) => option.index === i))) return;
    setLevel(i);
    hls.currentLevel = i;
  };
  const pickAudio = (i: number) => {
    setAudioId(i);
    if (hlsRef.current) hlsRef.current.audioTrack = i;
  };
  const pickSub = (i: number) => {
    setSubId(i);
    if (hlsRef.current) {
      hlsRef.current.subtitleTrack = i;
      hlsRef.current.subtitleDisplay = i >= 0;
    }
  };
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };
  const toggleMute = () => {
    const v = videoRef.current;
    if (v) v.muted = !v.muted;
  };
  const changeVolume = (x: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = x;
    v.muted = x === 0;
  };
  const fullscreen = () => {
    const el = wrapRef.current;
    const v = videoRef.current as
      (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (el?.requestFullscreen)
      el.requestFullscreen().catch(() => v?.webkitEnterFullscreen?.());
    else v?.webkitEnterFullscreen?.();
  };
  const pip = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch {
      setError("Picture-in-Picture tidak tersedia untuk stream ini.");
    }
  };

  const qualityNote =
    mode === "native"
      ? "Pemutaran menggunakan pemutar bawaan browser; pilihan resolusi manual tidak tersedia."
      : mode === "hls" && levels.length === 1
        ? `Stream ini hanya menyediakan satu resolusi (${levels[0]?.label}).`
        : mode === "hls" && levels.length === 0 && !loading && !error
          ? "Stream ini tidak menyediakan info resolusi."
          : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-glow">
      <div ref={wrapRef} className="relative aspect-video bg-player">
        <video
          ref={videoRef}
          className="h-full w-full"
          style={{ objectFit: fit }}
          controls
          playsInline
          onPlaying={() => {
            setLoading(false);
            setError(null);
          }}
          onWaiting={() => setLoading(true)}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          onVolumeChange={(e) => {
            setMuted(e.currentTarget.muted);
            setVolume(e.currentTarget.volume);
          }}
          onError={() => {
            if (!hlsRef.current && mode === "native") {
              setLoading(false);
              const code = videoRef.current?.error?.code;
              if (code === 1) return;
              setError(nativePlaybackIssue(code ?? 4, detectStreamFormat(channel.url)).message);
            }
          }}
        />
        {loading && !error && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
          </div>
        )}
        {error && (
          <div className="absolute inset-x-3 bottom-14 flex items-center gap-2 rounded-lg bg-destructive/90 p-3 text-sm text-destructive-foreground">
            <span className="flex-1">{error}</span>
            <Button
              variant="ghost"
              className="rounded-md border border-destructive-foreground/40 px-2 py-1 text-xs font-semibold"
              onClick={() => setAttempt((a) => a + 1)}
            >
              Ulangi
            </Button>
          </div>
        )}
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-center gap-2">
          {channel.logo && (
            <img
              src={channel.logo}
              alt=""
              className="h-9 w-9 rounded bg-muted object-contain"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate font-display font-semibold">{channel.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {channel.group}
              {channel.country ? ` · ${channel.country}` : ""}
            </div>
          </div>
          <Button
            variant="ghost"
            className={`ctl ${isFav ? "text-primary" : ""}`}
            onClick={onToggleFav}
            aria-label={isFav ? "Hapus dari favorit" : "Tambah ke favorit"}
            aria-pressed={isFav}
          >
            {isFav ? "★" : "☆"}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button variant="ghost" className="ctl" onClick={onPrev} aria-label="Sebelumnya">
            ⏮
          </Button>
          <Button
            variant="ghost"
            className="ctl"
            onClick={togglePlay}
            aria-label={paused ? "Putar" : "Jeda"}
          >
            {paused ? "▶" : "❚❚"}
          </Button>
          <Button variant="ghost" className="ctl" onClick={onStop} aria-label="Stop">
            ■
          </Button>
          <Button variant="ghost" className="ctl" onClick={onNext} aria-label="Berikutnya">
            ⏭
          </Button>
          <Button
            variant="ghost"
            className="ctl"
            onClick={() => setAttempt((a) => a + 1)}
            aria-label="Muat ulang stream"
          >
            ↻
          </Button>
          <Button
            variant="ghost"
            className="ctl"
            onClick={toggleMute}
            aria-label={muted ? "Bunyikan" : "Bisukan"}
          >
            {muted || volume === 0 ? "🔇" : "🔊"}
          </Button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => changeVolume(Number(e.target.value))}
            aria-label="Volume"
            className="w-20 accent-primary"
          />
          <Button
            variant="ghost"
            className="ctl w-auto px-2 text-xs"
            onClick={() => onFitChange(fit === "contain" ? "cover" : "contain")}
            aria-label="Ubah tampilan video"
          >
            {fit === "contain" ? "Fit" : "Fill"}
          </Button>
          {pipOk && (
            <Button variant="ghost" className="ctl" onClick={pip} aria-label="Picture-in-Picture">
              ⧉
            </Button>
          )}
          <Button variant="ghost" className="ctl" onClick={fullscreen} aria-label="Layar penuh">
            ⛶
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="field h-9 w-auto py-0 text-xs disabled:opacity-50"
            value={level}
            disabled={mode !== "hls" || levels.length < 2}
            onChange={(e) => pickLevel(Number(e.target.value))}
            aria-label="Resolusi video"
            title={qualityNote ?? "Pilih resolusi"}
          >
            <option value={-1}>{`Otomatis${level === -1 && active ? ` (${active})` : ""}`}</option>
            {levels.length > 1 &&
              levels.map((l) => (
                <option key={l.index} value={l.index}>
                  {l.label}
                </option>
              ))}
          </select>
          {audio.length > 1 && (
            <select
              className="field h-9 w-auto py-0 text-xs"
              value={audioId}
              onChange={(e) => pickAudio(Number(e.target.value))}
              aria-label="Trek audio"
            >
              {audio.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
          {subs.length > 0 && (
            <select
              className="field h-9 w-auto py-0 text-xs"
              value={subId}
              onChange={(e) => pickSub(Number(e.target.value))}
              aria-label="Subtitle"
            >
              <option value={-1}>Subtitle mati</option>
              {subs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
        </div>
        {qualityNote && <p className="text-xs text-muted-foreground">{qualityNote}</p>}
      </div>
    </div>
  );
}
