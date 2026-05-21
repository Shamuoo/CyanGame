<div align="center">

# CyanGame

**Private cloud gaming for your home server.**  
Stream any console — real hardware or emulated — to any browser on your network.

[![License: MIT](https://img.shields.io/badge/license-MIT-22D3EE?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.2-22D3EE?style=flat-square)](ROADMAP.md)
[![Docker](https://img.shields.io/badge/docker-compose-2496ED?style=flat-square&logo=docker&logoColor=white)](server/docker-compose.yml)
[![Unraid](https://img.shields.io/badge/runs%20on-Unraid-F15A2B?style=flat-square)](https://unraid.net)
[![AI Assisted](https://img.shields.io/badge/built%20with-AI%20assistance-A855F7?style=flat-square)](#-ai-disclosure)

> ⚠️ **Early development** — v0.2, actively built. Expect rough edges.

</div>

---

## What is this

CyanGame is a self-hosted game streaming platform that runs entirely on your own hardware. Think Xbox Cloud Gaming, but your consoles, your server, your network — no subscriptions, no latency to a data centre.

A small capture device (a $20 Wyse 3040 thin client) sits next to each console with a USB capture card. CyanGame handles encoding, routing, and delivering a WebRTC stream to any browser on your network. The same system also runs emulators on your NAS or capture nodes, so your ROM library sits alongside real hardware in one unified interface.

---

## Quick start

**On your NAS** (Unraid, TrueNAS, Ubuntu — anything with Docker):

```bash
curl -fsSL https://raw.githubusercontent.com/Shamuoo/CyanGame/main/install-server.sh | bash
```

**On each capture node** (Wyse 3040, N100 mini PC):

```bash
curl -fsSL https://raw.githubusercontent.com/Shamuoo/CyanGame/main/install-node.sh | bash
```

Open `http://YOUR_NAS_IP:7000` — the setup wizard handles everything else. No config files, no terminal needed after install.

---

## How it works

```
Console → HDMI → [ Capture Node ] ──── WiFi ────→ [ NAS Server ] ──→ [ Browser ]
                   Wyse 3040                        Docker stack        WebRTC
                   USB capture card                 nginx + mediamtx    stream
                   VAAPI encode → SRT               Node.js API
                                                    SQLite
```

---

## Features

- **Any console** — NES through PS5, all in one library
- **Physical streaming** — real hardware via USB capture card → WebRTC
- **Emulation** — RetroArch, PCSX2, Dolphin, DuckStation; server or node
- **Auto-launch** — PS3 via WebMAN, Xbox via SmartGlass
- **ROM library** — drop files in a folder, scanned and indexed automatically
- **Setup wizard** — full browser-based config, no file editing needed
- **One-line install** — server and nodes each install with a single `curl`

---

## Hardware

### Server
Any machine running Docker. Tested on Unraid.

### Capture nodes

| Device | Cost | Good for |
|--------|------|----------|
| Dell Wyse 3040 | ~$20 used | PS3, Xbox 360, PS4, Switch (1080p) |
| Beelink EQ12 (N100) | ~$120 | PS5, Xbox Series X (4K) |

**Capture cards:** Elgato HD60 X (~$150) for 1080p · AVerMedia BU113 (~$200) for 4K

> Most modern consoles output HDCP. Disable it in each console's settings (Settings → HDMI → HDCP Off) before the capture card can see the signal.

---

## Supported consoles

| Era | Hardware | Emulation |
|-----|----------|-----------|
| Modern | PS5, Xbox Series X\|S, Switch | Ryujinx (Switch) |
| 8th gen | PS4, Xbox One, Wii U | — |
| 7th gen | PS3 (WebMAN auto-launch), Xbox 360, Wii | RPCS3 |
| 6th gen | PS2 (OPL), GameCube, Xbox | PCSX2, Dolphin |
| Retro | NES, SNES, N64, Genesis, PS1, GBA | RetroArch |

---

## Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 7000 | TCP | Web portal + setup wizard |
| 8889 | TCP | WebRTC stream delivery |
| 8890 | UDP | SRT inbound (nodes push here) |
| 3478 | UDP/TCP | STUN/TURN (only needed outside LAN) |

---

## Roadmap

See [ROADMAP.md](ROADMAP.md) — v0.3 adds audio, IGDB art, and mobile UI. v0.4 adds full controller passthrough.

---

## Contributing

PRs welcome. Most useful: launch adapters for more consoles, capture card compatibility reports, node agent testing on non-Wyse hardware.

---

## 🤖 AI Disclosure

This project was built with significant AI assistance (Claude by Anthropic). The architecture, backend, React portal, node agent, install scripts, and this README were all written in collaboration with an AI.

**What that means practically:**
- The code is intentional, not blindly generated — it was designed across many iterations with specific hardware constraints (Wyse 3040 VAAPI limits, Unraid paths, WebRTC WHEP protocol)
- It has not been extensively tested on real hardware yet — expect bugs
- Some features (PS4/PS5 launch, controller passthrough) are stubbed and incomplete
- Review code before running it — standard advice for any project

The human behind this is building a real setup with real Wyse 3040s and a real Unraid server. AI was the implementation partner.

---

## License

MIT
