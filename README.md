# CyanGame

> Private cloud gaming — stream any console to any browser.  
> Real hardware or emulation. NES to PS5. One portal.

---

## Install

**Server** (your NAS — run once):
```bash
curl -fsSL https://raw.githubusercontent.com/Shamuoo/CyanGame/main/install-server.sh | bash
```

**Node** (each Wyse 3040 / N100 — run once per device):
```bash
curl -fsSL https://raw.githubusercontent.com/Shamuoo/CyanGame/main/install-node.sh | bash
```

---

## How It Works

```
Console → HDMI → [Wyse Node] ── WiFi ──→ [NAS Server] ──→ [Browser]
                  captures &              Docker stack      WebRTC
                  encodes                 routes streams    stream
```

**First time?** Open `http://YOUR_NAS_IP:7000/setup` after install — the wizard walks through everything.

---

## Stack

| Service      | Role                          | Port        |
|--------------|-------------------------------|-------------|
| nginx        | Reverse proxy                 | 7000        |
| backend      | REST API + WebSocket          | 3001        |
| mediamtx     | SRT → WebRTC routing          | 8890 / 8889 |
| coturn       | STUN/TURN for WebRTC          | 3478        |
| emulation    | RetroArch / PCSX2 / Dolphin   | internal    |

---

## Supported Consoles

| Era       | Systems                                      |
|-----------|----------------------------------------------|
| Modern    | PS5, Xbox Series X\|S, Switch                |
| 8th Gen   | PS4, Xbox One, Wii U                         |
| 7th Gen   | PS3 (WebMAN), Xbox 360, Wii                  |
| 6th Gen   | PS2 (OPL), GameCube, Xbox                    |
| Retro     | NES, SNES, N64, Genesis, PS1, GBA            |
| Emulation | All of the above via RetroArch/PCSX2/Dolphin |

---

## Node Hardware

| Device              | Cost  | Best For                          |
|---------------------|-------|-----------------------------------|
| Dell Wyse 3040      | Free  | PS3, 360, PS4, Switch (1080p)     |
| Beelink EQ12 (N100) | ~$120 | PS5, Xbox Series X (4K)           |

Capture cards: **Elgato HD60 X** (1080p nodes) · **AVerMedia BU113** (4K nodes)

---

## Repo Structure

```
CyanGame/
├── install-server.sh          ← server one-line install
├── install-node.sh            ← node one-line install
├── server/
│   ├── docker-compose.yml
│   ├── .env.example
│   ├── backend/               ← Node.js API (Express + SQLite)
│   │   └── src/
│   │       ├── routes/        ← nodes, consoles, games, roms, sessions
│   │       ├── services/      ← stream, launcher, emulation managers
│   │       ├── db/            ← schema + migrations
│   │       └── ui/            ← React portal (ConsoleHub.jsx, Wizard.jsx)
│   ├── mediamtx/              ← stream routing config
│   └── nginx/                 ← reverse proxy config
├── node/
│   └── agent.py               ← Python agent (capture, emulation, heartbeat)
├── retroarch/
│   └── Dockerfile             ← emulation container
└── .github/workflows/
    └── build.yml              ← auto-build backend image to GHCR
```

---

## v0.2 — Current

- ✅ Physical console streaming (SRT → WebRTC)
- ✅ Wyse 3040 node agent (VAAPI encode)
- ✅ Server-side + node-side emulation
- ✅ ROM library with auto-scan
- ✅ Setup wizard
- ✅ Game library with play mode picker
- ✅ PS3 WebMAN auto-launch
- ✅ Xbox SmartGlass auto-launch

See [ROADMAP.md](./ROADMAP.md) for what's coming.

---

## License

MIT
