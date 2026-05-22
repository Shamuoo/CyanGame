<div align="center">

# CyanGame

**Private cloud gaming. Your hardware. Your network.**  
Emulate NES to PS2, stream to any browser.

[![License: MIT](https://img.shields.io/badge/license-MIT-22D3EE?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.2-22D3EE?style=flat-square)](ROADMAP.md)
[![AI Assisted](https://img.shields.io/badge/built%20with-AI%20assistance-A855F7?style=flat-square)](#-ai-disclosure)

> ⚠️ Early development — v0.2. Emulation working, physical console streaming in progress.

</div>

---

## Quick start

```bash
curl -fsSL https://raw.githubusercontent.com/Shamuoo/CyanGame/main/install-server.sh | bash
```

Open `http://YOUR_NAS_IP:7000` → go to **Setup** → scan your ROM folder → play.

---

## How it works

```
ROM file on NAS
      ↓
Emulation container (RetroArch / PCSX2 / Dolphin)
      ↓  Xvfb virtual display → FFmpeg → SRT
MediaMTX stream router
      ↓  WebRTC WHEP
Your browser
```

No plugins. No client software. Just a browser.

---

## Supported systems

| System | Emulator |
|--------|----------|
| NES | RetroArch (Nestopia) |
| SNES | RetroArch (Snes9x) |
| Game Boy / GBC | RetroArch (Gambatte) |
| GBA | RetroArch (mGBA) |
| Sega Genesis | RetroArch (Genesis Plus GX) |
| Nintendo 64 | RetroArch (Mupen64Plus) |
| PlayStation 1 | RetroArch (PCSX ReARMed) |
| PlayStation 2 | PCSX2 |
| GameCube / Wii | Dolphin |
| Nintendo DS | RetroArch (melonDS) |

---

## ROM folder structure

```
/mnt/user/roms/
├── nes/     game.nes
├── snes/    game.sfc
├── n64/     game.z64
├── ps1/     game.bin + game.cue
├── ps2/     game.iso
├── gamecube/game.iso
└── gba/     game.gba
```

---

## Stack

| Container | Role |
|-----------|------|
| nginx | Reverse proxy, serves portal |
| backend | Node.js API + SQLite |
| mediamtx | SRT → WebRTC routing |
| coturn | STUN/TURN for WebRTC |
| emulation | RetroArch + PCSX2 + Dolphin + Xvfb + FFmpeg |

---

## Physical console streaming (coming v0.3)

For streaming real hardware, install the node agent on a Wyse 3040:

```bash
curl -fsSL https://raw.githubusercontent.com/Shamuoo/CyanGame/main/install-node.sh | bash
```

---

## 🤖 AI Disclosure

Built with significant AI assistance (Claude by Anthropic). The architecture, all backend code, the emulation pipeline, and this README were written in collaboration with an AI. The human is building a real setup with real hardware — AI was the implementation partner.

Not extensively tested on real hardware yet. Review code before running. Expect bugs.

---

MIT License
