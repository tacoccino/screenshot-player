import { useState, useRef, useEffect, useCallback } from "react";

// ─── Helpers ───────────────────────────────────────────────────────────────
const fmt = (s) => {
  if (!isFinite(s)) return "00:00:00.000";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
};

const TABS = ["Player", "Post-FX", "Settings", "Hotkeys"];

const DEFAULT_HOTKEYS = {
  playPause: "Space",
  prevFrame: "ArrowLeft",
  nextFrame: "ArrowRight",
  screenshot: "KeyS",
  toggleSubs: "KeyC",
  seekBack5: "KeyJ",
  seekFwd5: "KeyL",
  fullscreen: "KeyF",
  muteToggle: "KeyM",
};

const DEFAULT_FX = { sharpness: 0, saturation: 100, brightness: 100, contrast: 100, grain: 0 };

const COLOR_SPACES = ["Rec.709", "Rec.2020", "DCI-P3", "sRGB", "ACES"];

const buildFilter = (fx) => {
  const sharp = fx.sharpness > 0 ? `contrast(${1 + fx.sharpness * 0.005}) ` : "";
  return `${sharp}saturate(${fx.saturation}%) brightness(${fx.brightness}%) contrast(${fx.contrast}%)`;
};

// ─── Grain Canvas overlay ───────────────────────────────────────────────────
function GrainOverlay({ amount }) {
  const ref = useRef();
  useEffect(() => {
    if (!ref.current || amount === 0) return;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let raf;
    const draw = () => {
      const w = canvas.width, h = canvas.height;
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = (Math.random() - 0.5) * amount * 2.5;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 128 + v;
        img.data[i + 3] = Math.abs(v) * 1.5;
      }
      ctx.putImageData(img, 0, 0);
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [amount]);
  if (amount === 0) return null;
  return (
    <canvas
      ref={ref}
      width={640}
      height={360}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", mixBlendMode: "overlay", opacity: 0.6 }}
    />
  );
}

// ─── Slider ────────────────────────────────────────────────────────────────
function Slider({ label, value, min = 0, max = 100, step = 1, unit = "", onChange, accent = "#e8c547" }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 11, letterSpacing: "0.08em", color: "#aaa", fontFamily: "'DM Mono', monospace" }}>
        <span>{label}</span>
        <span style={{ color: accent }}>{value}{unit}</span>
      </div>
      <div style={{ position: "relative", height: 4, background: "#2a2a2a", borderRadius: 2 }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${((value - min) / (max - min)) * 100}%`, background: accent, borderRadius: 2, transition: "width 0.05s" }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ position: "absolute", inset: "-6px 0", width: "100%", opacity: 0, cursor: "pointer", height: 16 }}
        />
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────
export default function ScreenshotPlayer() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const subsInputRef = useRef(null);
  const containerRef = useRef(null);

  const [videoSrc, setVideoSrc] = useState(null);
  const [videoName, setVideoName] = useState("");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fps, setFps] = useState(24);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [subtitles, setSubtitles] = useState([]);
  const [subsVisible, setSubsVisible] = useState(true);
  const [currentSub, setCurrentSub] = useState("");
  const [tab, setTab] = useState("Player");
  const [fx, setFx] = useState(DEFAULT_FX);
  const [colorSpace, setColorSpace] = useState("Rec.709");
  const [hotkeys, setHotkeys] = useState(DEFAULT_HOTKEYS);
  const [editingHotkey, setEditingHotkey] = useState(null);
  const [saveFolder, setSaveFolder] = useState("~/Screenshots");
  const [fileNameTemplate, setFileNameTemplate] = useState("{video}_{timecode}_{counter}");
  const [screenshotCounter, setScreenshotCounter] = useState(1);
  const [screenshots, setScreenshots] = useState([]);
  const [toast, setToast] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [hoveringTimeline, setHoveringTimeline] = useState(false);
  const [hoverTime, setHoverTime] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Toast helper
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  // Video event handlers
  const onTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);
    // Find subtitle
    const s = subtitles.find(s => t >= s.start && t <= s.end);
    setCurrentSub(s ? s.text : "");
  }, [subtitles]);

  const onLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
    setCurrentTime(0);
  };

  // Parse SRT
  const parseSRT = (text) => {
    const entries = [];
    const blocks = text.trim().split(/\n\s*\n/);
    for (const block of blocks) {
      const lines = block.split("\n");
      if (lines.length < 3) continue;
      const timeLine = lines[1];
      const match = timeLine.match(/(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/);
      if (!match) continue;
      const toSec = (h, m, s, ms) => +h * 3600 + +m * 60 + +s + +ms / 1000;
      entries.push({
        start: toSec(match[1], match[2], match[3], match[4]),
        end: toSec(match[5], match[6], match[7], match[8]),
        text: lines.slice(2).join(" ").replace(/<[^>]+>/g, "")
      });
    }
    return entries;
  };

  // File open
  const openVideo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setVideoName(file.name.replace(/\.[^.]+$/, ""));
    setPlaying(false);
    setCurrentTime(0);
    setScreenshotCounter(1);
    showToast(`Loaded: ${file.name}`);
  };

  const openSubs = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseSRT(ev.target.result);
      setSubtitles(parsed);
      showToast(`Subtitles loaded: ${parsed.length} entries`);
    };
    reader.readAsText(file);
  };

  // Playback
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) { videoRef.current.play(); setPlaying(true); }
    else { videoRef.current.pause(); setPlaying(false); }
  }, []);

  const seekTo = useCallback((t) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(t, duration));
  }, [duration]);

  const stepFrame = useCallback((dir) => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setPlaying(false);
    seekTo(currentTime + dir * (1 / fps));
  }, [currentTime, fps, seekTo]);

  const seekRelative = useCallback((secs) => seekTo(currentTime + secs), [currentTime, seekTo]);

  // Screenshot
  const takeScreenshot = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const vid = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = vid.videoWidth || 1280;
    canvas.height = vid.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    ctx.filter = buildFilter(fx);
    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);

    // Add grain via pixel manipulation
    if (fx.grain > 0) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < imgData.data.length; i += 4) {
        const g = (Math.random() - 0.5) * fx.grain * 2;
        imgData.data[i] = Math.min(255, Math.max(0, imgData.data[i] + g));
        imgData.data[i + 1] = Math.min(255, Math.max(0, imgData.data[i + 1] + g));
        imgData.data[i + 2] = Math.min(255, Math.max(0, imgData.data[i + 2] + g));
      }
      ctx.putImageData(imgData, 0, 0);
    }

    // Subtitle burn-in
    if (subsVisible && currentSub) {
      ctx.font = `bold ${Math.floor(canvas.height * 0.04)}px serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      const lines = currentSub.split(" ");
      ctx.fillText(currentSub, canvas.width / 2 + 2, canvas.height * 0.9 + 2);
      ctx.fillStyle = "#fff";
      ctx.fillText(currentSub, canvas.width / 2, canvas.height * 0.9);
    }

    const name = fileNameTemplate
      .replace("{video}", videoName || "clip")
      .replace("{timecode}", fmt(currentTime).replace(/:/g, "-").replace(".", "-"))
      .replace("{counter}", String(screenshotCounter).padStart(4, "0"))
      .replace("{colorspace}", colorSpace);

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${name}.png`;
    link.click();

    setScreenshots(prev => [{ name, dataUrl, time: currentTime }, ...prev.slice(0, 19)]);
    setScreenshotCounter(c => c + 1);
    showToast(`📸 Saved: ${name}.png`);
  }, [videoRef, fx, subsVisible, currentSub, fileNameTemplate, videoName, currentTime, screenshotCounter, colorSpace]);

  // Volume
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume / 100;
      videoRef.current.muted = muted;
    }
  }, [volume, muted]);

  // CSS filter on video
  const videoFilter = buildFilter(fx);

  // Hotkey listener
  useEffect(() => {
    const handler = (e) => {
      if (editingHotkey) return;
      const key = e.code;
      const active = Object.entries(hotkeys).find(([, v]) => v === key);
      if (!active) return;
      e.preventDefault();
      const action = active[0];
      if (action === "playPause") togglePlay();
      else if (action === "prevFrame") stepFrame(-1);
      else if (action === "nextFrame") stepFrame(1);
      else if (action === "screenshot") takeScreenshot();
      else if (action === "toggleSubs") setSubsVisible(v => !v);
      else if (action === "seekBack5") seekRelative(-5);
      else if (action === "seekFwd5") seekRelative(5);
      else if (action === "muteToggle") setMuted(m => !m);
      else if (action === "fullscreen") setFullscreen(f => !f);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hotkeys, editingHotkey, togglePlay, stepFrame, takeScreenshot, seekRelative]);

  // Hotkey recording
  const recordHotkey = useCallback((e) => {
    if (!editingHotkey) return;
    e.preventDefault();
    setHotkeys(h => ({ ...h, [editingHotkey]: e.code }));
    setEditingHotkey(null);
  }, [editingHotkey]);

  useEffect(() => {
    if (editingHotkey) {
      window.addEventListener("keydown", recordHotkey);
      return () => window.removeEventListener("keydown", recordHotkey);
    }
  }, [editingHotkey, recordHotkey]);

  const timelineClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seekTo(ratio * duration);
  };

  const timelineHover = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setHoverTime(ratio * duration);
  };

  const fxUpdate = (key) => (val) => setFx(f => ({ ...f, [key]: val }));

  const HOTKEY_LABELS = {
    playPause: "Play / Pause",
    prevFrame: "Previous Frame",
    nextFrame: "Next Frame",
    screenshot: "Take Screenshot",
    toggleSubs: "Toggle Subtitles",
    seekBack5: "Seek Back 5s",
    seekFwd5: "Seek Forward 5s",
    muteToggle: "Mute Toggle",
    fullscreen: "Fullscreen",
  };

  const accentGold = "#e8c547";
  const accentBlue = "#4a9eff";

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0a", color: "#ddd",
      fontFamily: "'DM Mono', 'Fira Code', monospace",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "0 0 40px 0", userSelect: "none"
    }}>
      {/* Google Font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
        input[type=range] { -webkit-appearance: none; appearance: none; background: transparent; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; background: ${accentGold}; border-radius: 50%; cursor: pointer; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #111; } ::-webkit-scrollbar-thumb { background: #333; }
        * { box-sizing: border-box; }
        .tab-btn { background: none; border: none; color: #666; cursor: pointer; padding: 8px 16px; font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; transition: color 0.2s; }
        .tab-btn:hover { color: #aaa; }
        .tab-btn.active { color: ${accentGold}; border-bottom: 1px solid ${accentGold}; }
        .icon-btn { background: none; border: 1px solid #2a2a2a; color: #aaa; cursor: pointer; padding: 6px 10px; border-radius: 4px; font-size: 14px; transition: all 0.15s; display: flex; align-items: center; gap: 4px; font-family: 'DM Mono', monospace; }
        .icon-btn:hover { border-color: ${accentGold}; color: ${accentGold}; }
        .icon-btn.active { border-color: ${accentGold}; color: ${accentGold}; background: rgba(232,197,71,0.08); }
        .screenshot-thumb { transition: transform 0.2s; cursor: pointer; }
        .screenshot-thumb:hover { transform: scale(1.05); }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          background: toast.type === "error" ? "#3a1a1a" : "#1a2a1a",
          border: `1px solid ${toast.type === "error" ? "#c44" : "#4a8"}`,
          color: toast.type === "error" ? "#f88" : "#8f8",
          padding: "10px 16px", borderRadius: 6, fontSize: 12,
          animation: "fadeIn 0.2s ease",
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ width: "100%", maxWidth: 1100, padding: "18px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: accentGold, letterSpacing: "0.05em" }}>Screenshot Player</span>
          <span style={{ fontSize: 9, color: "#444", letterSpacing: "0.2em" }}>PRECISION CAPTURE</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="icon-btn" onClick={() => fileInputRef.current.click()}>📁 Open Video</button>
          <button className="icon-btn" onClick={() => subsInputRef.current.click()}>💬 Load Subtitles</button>
          <input ref={fileInputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={openVideo} />
          <input ref={subsInputRef} type="file" accept=".srt,.vtt" style={{ display: "none" }} onChange={openSubs} />
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ width: "100%", maxWidth: 1100, padding: "0 24px", marginTop: 12, borderBottom: "1px solid #1a1a1a" }}>
        {TABS.map(t => (
          <button key={t} className={`tab-btn${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {/* Main content */}
      <div style={{ width: "100%", maxWidth: 1100, padding: "20px 24px 0", display: "flex", gap: 20 }}>

        {/* ── LEFT COLUMN: Video ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Video wrapper */}
          <div ref={containerRef} style={{
            position: "relative", background: "#000", borderRadius: 8,
            overflow: "hidden", aspectRatio: "16/9",
            border: "1px solid #1e1e1e",
            boxShadow: "0 8px 40px rgba(0,0,0,0.8)"
          }}>
            {videoSrc ? (
              <>
                <video
                  ref={videoRef}
                  src={videoSrc}
                  style={{ width: "100%", height: "100%", display: "block", filter: videoFilter }}
                  onTimeUpdate={onTimeUpdate}
                  onLoadedMetadata={onLoadedMetadata}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                />
                <GrainOverlay amount={fx.grain} />
                {subsVisible && currentSub && (
                  <div style={{
                    position: "absolute", bottom: "8%", left: "10%", right: "10%",
                    textAlign: "center", fontSize: "clamp(12px, 2vw, 18px)",
                    fontWeight: "bold", color: "#fff",
                    textShadow: "0 2px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.8)",
                    pointerEvents: "none", lineHeight: 1.4
                  }}>
                    {currentSub}
                  </div>
                )}
                {/* Color space badge */}
                <div style={{ position: "absolute", top: 10, right: 10, fontSize: 9, letterSpacing: "0.15em", color: "#666", background: "rgba(0,0,0,0.5)", padding: "3px 6px", borderRadius: 3 }}>
                  {colorSpace}
                </div>
              </>
            ) : (
              <div
                style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, cursor: "pointer", color: "#333" }}
                onClick={() => fileInputRef.current.click()}
              >
                <div style={{ fontSize: 48 }}>▶</div>
                <div style={{ fontSize: 13, letterSpacing: "0.1em" }}>CLICK TO OPEN VIDEO</div>
                <div style={{ fontSize: 10, color: "#222" }}>MP4, MOV, MKV, WebM, AVI</div>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div style={{ marginTop: 12, padding: "0 2px" }}>
            <div
              style={{ position: "relative", height: 6, background: "#1a1a1a", borderRadius: 3, cursor: "pointer" }}
              onClick={timelineClick}
              onMouseMove={timelineHover}
              onMouseEnter={() => setHoveringTimeline(true)}
              onMouseLeave={() => setHoveringTimeline(false)}
            >
              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${duration ? (currentTime / duration) * 100 : 0}%`, background: accentGold, borderRadius: 3, transition: scrubbing ? "none" : "width 0.05s" }} />
              {hoveringTimeline && duration > 0 && (
                <>
                  <div style={{ position: "absolute", top: -22, left: `${(hoverTime / duration) * 100}%`, transform: "translateX(-50%)", fontSize: 9, color: "#aaa", background: "#111", padding: "2px 5px", borderRadius: 3, whiteSpace: "nowrap", pointerEvents: "none" }}>
                    {fmt(hoverTime)}
                  </div>
                  <div style={{ position: "absolute", top: 0, left: `${(hoverTime / duration) * 100}%`, width: 1, height: "100%", background: "#fff3", pointerEvents: "none" }} />
                </>
              )}
              <div style={{ position: "absolute", top: "50%", left: `${duration ? (currentTime / duration) * 100 : 0}%`, transform: "translate(-50%, -50%)", width: 12, height: 12, background: accentGold, borderRadius: "50%", boxShadow: `0 0 6px ${accentGold}` }} />
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {/* Timecode */}
            <div style={{ fontSize: 11, color: accentGold, letterSpacing: "0.08em", minWidth: 120 }}>
              {fmt(currentTime)}
            </div>
            <div style={{ fontSize: 11, color: "#333", flex: 1, textAlign: "right" }}>
              {fmt(duration)}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            <button className="icon-btn" onClick={() => stepFrame(-1)} title={`Prev Frame (${hotkeys.prevFrame})`}>◀◀</button>
            <button className="icon-btn" onClick={() => seekRelative(-5)} title={`-5s (${hotkeys.seekBack5})`}>-5s</button>
            <button className={`icon-btn${playing ? " active" : ""}`} onClick={togglePlay} style={{ padding: "6px 18px", fontSize: 16 }} title={`Play/Pause (${hotkeys.playPause})`}>
              {playing ? "⏸" : "▶"}
            </button>
            <button className="icon-btn" onClick={() => seekRelative(5)} title={`+5s (${hotkeys.seekFwd5})`}>+5s</button>
            <button className="icon-btn" onClick={() => stepFrame(1)} title={`Next Frame (${hotkeys.nextFrame})`}>▶▶</button>
            <div style={{ flex: 1 }} />
            <button className={`icon-btn${!subsVisible ? "" : " active"}`} onClick={() => setSubsVisible(v => !v)} title={`Toggle Subs (${hotkeys.toggleSubs})`} style={{ fontSize: 11 }}>
              CC {subsVisible ? "ON" : "OFF"}
            </button>
            <button className={`icon-btn${muted ? " active" : ""}`} onClick={() => setMuted(m => !m)} title={`Mute (${hotkeys.muteToggle})`}>
              {muted ? "🔇" : "🔊"}
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, color: "#444" }}>VOL</span>
              <input type="range" min={0} max={100} value={volume} onChange={e => setVolume(+e.target.value)}
                style={{ width: 60, accentColor: accentGold }} />
            </div>
            <button className="icon-btn" onClick={takeScreenshot} style={{ background: "rgba(232,197,71,0.1)", borderColor: accentGold, color: accentGold }} title={`Screenshot (${hotkeys.screenshot})`}>
              📸 SNAP
            </button>
          </div>

          {/* FPS selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
            <span style={{ fontSize: 10, color: "#444", letterSpacing: "0.1em" }}>FPS</span>
            {[23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60].map(f => (
              <button key={f} onClick={() => setFps(f)} style={{
                background: fps === f ? "rgba(232,197,71,0.1)" : "none",
                border: `1px solid ${fps === f ? accentGold : "#222"}`,
                color: fps === f ? accentGold : "#444",
                padding: "2px 6px", borderRadius: 3, fontSize: 10, cursor: "pointer", fontFamily: "inherit"
              }}>{f}</button>
            ))}
          </div>
        </div>

        {/* ── RIGHT COLUMN: Panels ── */}
        <div style={{ width: 280, flexShrink: 0 }}>

          {/* ── PLAYER TAB ── */}
          {tab === "Player" && (
            <div>
              <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.15em", marginBottom: 12 }}>RECENT SCREENSHOTS</div>
              {screenshots.length === 0 ? (
                <div style={{ fontSize: 11, color: "#2a2a2a", textAlign: "center", padding: 20 }}>No screenshots yet</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 500, overflowY: "auto" }}>
                  {screenshots.map((s, i) => (
                    <div key={i} className="screenshot-thumb" style={{ position: "relative", borderRadius: 6, overflow: "hidden", border: "1px solid #1e1e1e" }}>
                      <img src={s.dataUrl} alt={s.name} style={{ width: "100%", display: "block" }} />
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.8))", padding: "12px 8px 6px", fontSize: 9, color: "#aaa" }}>
                        {s.name} · {fmt(s.time)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── POST-FX TAB ── */}
          {tab === "Post-FX" && (
            <div>
              <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.15em", marginBottom: 16 }}>POST PROCESSING</div>
              <Slider label="SHARPNESS" value={fx.sharpness} min={0} max={100} onChange={fxUpdate("sharpness")} accent={accentGold} />
              <Slider label="SATURATION" value={fx.saturation} min={0} max={200} unit="%" onChange={fxUpdate("saturation")} accent="#e84747" />
              <Slider label="BRIGHTNESS" value={fx.brightness} min={50} max={150} unit="%" onChange={fxUpdate("brightness")} accent="#47c8e8" />
              <Slider label="CONTRAST" value={fx.contrast} min={50} max={150} unit="%" onChange={fxUpdate("contrast")} accent="#e88847" />
              <Slider label="FILM GRAIN" value={fx.grain} min={0} max={100} onChange={fxUpdate("grain")} accent="#a0a0a0" />

              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.15em", marginBottom: 10 }}>COLOR SPACE</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {COLOR_SPACES.map(cs => (
                    <button key={cs} onClick={() => setColorSpace(cs)} style={{
                      background: colorSpace === cs ? "rgba(74,158,255,0.1)" : "none",
                      border: `1px solid ${colorSpace === cs ? accentBlue : "#222"}`,
                      color: colorSpace === cs ? accentBlue : "#555",
                      padding: "4px 10px", borderRadius: 4, fontSize: 10,
                      cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.05em"
                    }}>{cs}</button>
                  ))}
                </div>
              </div>

              <button onClick={() => setFx(DEFAULT_FX)} style={{ marginTop: 20, width: "100%", background: "none", border: "1px solid #222", color: "#555", padding: "8px", borderRadius: 4, fontSize: 10, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.1em" }}>
                RESET ALL
              </button>

              {/* Live preview swatch */}
              <div style={{ marginTop: 16, borderRadius: 6, overflow: "hidden", border: "1px solid #1e1e1e", height: 60, background: `linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)`, filter: buildFilter(fx), position: "relative" }}>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>FX PREVIEW</div>
              </div>
            </div>
          )}

          {/* ── SETTINGS TAB ── */}
          {tab === "Settings" && (
            <div>
              <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.15em", marginBottom: 16 }}>SETTINGS</div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, color: "#555", marginBottom: 8, letterSpacing: "0.1em" }}>SAVE FOLDER</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    value={saveFolder}
                    onChange={e => setSaveFolder(e.target.value)}
                    style={{ flex: 1, background: "#111", border: "1px solid #2a2a2a", color: "#aaa", padding: "7px 10px", borderRadius: 4, fontSize: 11, fontFamily: "inherit" }}
                  />
                  <button className="icon-btn" style={{ fontSize: 11 }} onClick={() => showToast("📁 Folder selector requires native app")}>
                    Browse
                  </button>
                </div>
                <div style={{ fontSize: 9, color: "#333", marginTop: 5 }}>Screenshots download to your browser's default folder</div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, color: "#555", marginBottom: 8, letterSpacing: "0.1em" }}>FILENAME TEMPLATE</div>
                <input
                  value={fileNameTemplate}
                  onChange={e => setFileNameTemplate(e.target.value)}
                  style={{ width: "100%", background: "#111", border: "1px solid #2a2a2a", color: "#aaa", padding: "7px 10px", borderRadius: 4, fontSize: 11, fontFamily: "inherit" }}
                />
                <div style={{ fontSize: 9, color: "#333", marginTop: 6, lineHeight: 1.7 }}>
                  Variables: <span style={{ color: accentGold }}>{"{video}"}</span> · <span style={{ color: accentGold }}>{"{timecode}"}</span> · <span style={{ color: accentGold }}>{"{counter}"}</span> · <span style={{ color: accentGold }}>{"{colorspace}"}</span>
                </div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 8, background: "#111", padding: "6px 10px", borderRadius: 4 }}>
                  Preview: <span style={{ color: "#888" }}>
                    {fileNameTemplate
                      .replace("{video}", videoName || "clip")
                      .replace("{timecode}", fmt(currentTime).replace(/:/g, "-").replace(".", "-"))
                      .replace("{counter}", String(screenshotCounter).padStart(4, "0"))
                      .replace("{colorspace}", colorSpace)}.png
                  </span>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, color: "#555", marginBottom: 8, letterSpacing: "0.1em" }}>SCREENSHOT COUNTER</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="number" value={screenshotCounter} onChange={e => setScreenshotCounter(+e.target.value)}
                    min={1} style={{ width: 80, background: "#111", border: "1px solid #2a2a2a", color: accentGold, padding: "7px 10px", borderRadius: 4, fontSize: 11, fontFamily: "inherit" }} />
                  <button className="icon-btn" style={{ fontSize: 10 }} onClick={() => setScreenshotCounter(1)}>Reset</button>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 10, color: "#555", marginBottom: 8, letterSpacing: "0.1em" }}>SUBTITLE SETTINGS</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#444" }}>Entries loaded:</span>
                  <span style={{ fontSize: 11, color: accentGold }}>{subtitles.length}</span>
                </div>
                <button className="icon-btn" style={{ marginTop: 8, fontSize: 10, width: "100%" }} onClick={() => { setSubtitles([]); showToast("Subtitles cleared"); }}>
                  Clear Subtitles
                </button>
              </div>
            </div>
          )}

          {/* ── HOTKEYS TAB ── */}
          {tab === "Hotkeys" && (
            <div>
              <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.15em", marginBottom: 16 }}>CUSTOMIZE HOTKEYS</div>
              {editingHotkey && (
                <div style={{ background: "rgba(232,197,71,0.08)", border: `1px solid ${accentGold}`, borderRadius: 6, padding: "10px 14px", marginBottom: 14, fontSize: 11, color: accentGold, textAlign: "center", letterSpacing: "0.05em" }}>
                  Press any key to bind "{HOTKEY_LABELS[editingHotkey]}"...
                </div>
              )}
              {Object.entries(HOTKEY_LABELS).map(([key, label]) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, padding: "8px 10px", background: editingHotkey === key ? "rgba(232,197,71,0.06)" : "#111", borderRadius: 5, border: `1px solid ${editingHotkey === key ? accentGold : "#1a1a1a"}`, cursor: "pointer" }}
                  onClick={() => setEditingHotkey(editingHotkey === key ? null : key)}>
                  <span style={{ fontSize: 11, color: "#777" }}>{label}</span>
                  <span style={{ fontSize: 10, color: accentGold, background: "#1a1a0a", padding: "2px 8px", borderRadius: 3, letterSpacing: "0.05em" }}>
                    {hotkeys[key].replace("Key", "").replace("Arrow", "↑ ").replace("Space", "SPACE")}
                  </span>
                </div>
              ))}
              <button onClick={() => setHotkeys(DEFAULT_HOTKEYS)} style={{ marginTop: 12, width: "100%", background: "none", border: "1px solid #222", color: "#555", padding: "8px", borderRadius: 4, fontSize: 10, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.1em" }}>
                RESTORE DEFAULTS
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hidden canvas for screenshots */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Footer */}
      <div style={{ width: "100%", maxWidth: 1100, padding: "16px 24px 0", display: "flex", justifyContent: "space-between", fontSize: 9, color: "#2a2a2a", letterSpacing: "0.1em", borderTop: "1px solid #111", marginTop: 20 }}>
        <span>Screenshot Player · PRECISION CAPTURE</span>
        <span>FRAME {Math.floor(currentTime * fps)} · {fps}fps · {colorSpace}</span>
      </div>
    </div>
  );
}
