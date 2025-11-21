# Web Audio Tone Generator (VN/EN Bilingual)

A fully client-side browser-based tone generator that allows you to create and export WAV audio test tones.  
Supports sine, square, triangle, and sawtooth waves — with full bilingual UI: **Vietnamese & English**.

No backend. No tracking. Runs offline.

---

## 🎯 Features

- Generate pure test tones
- Frequency range: **10 Hz → 22,000 Hz**
- Waveforms: **Sine, Square, Triangle, Sawtooth**
- Adjustable duration
- Volume control (amplitude)
- Sample rate selection (8 kHz → 384 kHz)
- Bit depth (16 / 24 / 32 bit)
- Mono / Stereo
- Normalize before export
- 10 quick preset buttons
- Export WAV instantly
- Auto language switching (EN / VI)
- Works in Chrome, Firefox, Safari, Android WebView

---

## 🌐 Live demo (you can host here)
Just upload your `index.html` to GitHub Pages:
https://steven-dc.github.io/audiosamplegenerator/

## 🧠 Explanation of Each Control

### 1. Waveform (Dạng sóng)
- **Sine** — Smooth, pure, used for subwoofer testing  
- **Square** — Harsh, odd harmonics, used for speaker response  
- **Triangle** — Softer square, still harmonic-rich  
- **Sawtooth** — Full harmonic spectrum, used in synth audio

### 2. Frequency (Tần số)
- Range: **10 Hz → 22,000 Hz**
- Human hearing limit: ~20 Hz – 20 kHz

### 3. Duration (Thời lượng)
- How long the tone will play / be exported

### 4. Volume (Âm lượng)
- 0.0 to 1.0 (full amplitude)

### 5. Sample Rate (Tần số mẫu)
Example meanings:
- **8000 Hz** — Telephone quality
- **44100 Hz** — CD
- **48000 Hz** — Video standard
- **192000 Hz** — Hi-Res Audio
- **384000 Hz** — Extreme precision testing

### 6. Bit Depth
- **16 bit** — CD
- **24 bit** — Studio quality
- **32 bit float** — Pro audio, prevents clipping

### 7. Channels (Kênh)
- Mono (1)
- Stereo (2)

### 8. Normalize Before Export
- Automatically maximizes signal
- No clipping
- Prevents quiet files

---

## 🚀 Presets Included
- 20 Hz Bass
- 30 Hz Sub test
- 40 Hz Deep bass
- 50 Hz LFE test
- 60 Hz Tight bass
- 80 Hz Punch bass
- 100 Hz Bass presence
- 440 Hz A-note tuning
- 1 kHz reference tone
- 10 kHz treble test

---

## 📦 Export Format
WAV (uncompressed PCM)
- Configurable sample rate
- Selectable bit depth
- Mono/Stereo

