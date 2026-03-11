# 🎞️ Screenshot Player — Precision Video Capture

> A cross-platform video player focused on high-quality, frame-accurate screenshot capture with post-processing and full hotkey customization.

![Screenshot Player](https://img.shields.io/badge/React-18+-61DAFB?style=flat-square&logo=react)
![Vite](https://img.shields.io/badge/Vite-5+-646CFF?style=flat-square&logo=vite)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square)

---

## ✨ Features

- **Frame-by-frame scrubbing** — step forward and backward one frame at a time with configurable FPS (23.976 → 60)
- **Timeline scrubber** — click anywhere on the timeline with hover timecode preview
- **High-quality screenshots** — captures at native video resolution with all post-FX baked in
- **Subtitle support** — load `.srt` files, toggle CC on/off, subtitles burn into screenshots
- **Post-processing FX** — sharpness, saturation, brightness, contrast, and animated film grain
- **Color space tagging** — label and track shots in Rec.709, Rec.2020, DCI-P3, sRGB, or ACES
- **Custom filename templates** — use `{video}`, `{timecode}`, `{counter}`, `{colorspace}` variables
- **Fully customizable hotkeys** — rebind any action with a single keypress
- **Screenshot gallery** — recent captures shown as thumbnails with timecode

---

## 🚀 Quick Start

### Requirements

- [Node.js](https://nodejs.org) v18 or higher

### Setup

```bash
git clone https://github.com/yourusername/Screenshot Player.git
cd Screenshot Player
```

**macOS / Linux:**
```bash
chmod +x launch.sh
./launch.sh
```

**Windows:**
```
Double-click launch.bat
```
*(or run it from a terminal: `launch.bat`)*

The scripts will automatically install dependencies on first run and open the app at `http://localhost:5173`.

---

## 🗂️ Project Structure

```
Screenshot Player/
├── src/
│   └── App.jsx          # Main Screenshot Player component
├── public/
├── launch.sh            # macOS/Linux launch script
├── launch.bat           # Windows launch script
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

---

## 🎮 Default Hotkeys

| Action | Key |
|---|---|
| Play / Pause | `Space` |
| Previous Frame | `←` |
| Next Frame | `→` |
| Take Screenshot | `S` |
| Toggle Subtitles | `C` |
| Seek Back 5s | `J` |
| Seek Forward 5s | `L` |
| Mute Toggle | `M` |
| Fullscreen | `F` |

All hotkeys are rebindable in the **Hotkeys** tab.

---

## 📸 Filename Templates

Screenshots are named using a customizable template. Available variables:

| Variable | Description | Example |
|---|---|---|
| `{video}` | Source filename (no extension) | `my_clip` |
| `{timecode}` | Current timecode | `00-01-23-456` |
| `{counter}` | Auto-incrementing number | `0001` |
| `{colorspace}` | Active color space | `Rec.709` |

**Default template:** `{video}_{timecode}_{counter}`

**Example output:** `my_clip_00-01-23-456_0001.png`

---

## 🎨 Post-Processing FX

All effects apply live to the video preview and are baked into saved screenshots.

| Effect | Range | Description |
|---|---|---|
| Sharpness | 0–100 | Edge enhancement via contrast boosting |
| Saturation | 0–200% | Color intensity |
| Brightness | 50–150% | Overall luminance |
| Contrast | 50–150% | Light/dark separation |
| Film Grain | 0–100 | Animated grain overlay |

---

## 🖥️ Supported Formats

Screenshot Player supports any video format your browser can decode natively:

- MP4 (H.264, H.265)
- WebM (VP8, VP9, AV1)
- MOV
- OGV

Subtitle files: `.srt` (SubRip)

> **Note:** H.265/HEVC playback depends on your browser and OS codec support.

---

## 🏗️ Building for Production

```bash
npm run build
```

Output goes to `dist/`. You can serve it with any static file server:

```bash
npx serve dist
```

### Desktop App (Native Folder Saving)

For real filesystem access (saving screenshots directly to a chosen folder), wrap the app with [Tauri](https://tauri.app):

```bash
npm create tauri-app@latest
```

This unlocks native file dialogs and direct disk writes instead of browser downloads.

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## 📄 License

MIT © [Your Name](https://github.com/yourusername)
