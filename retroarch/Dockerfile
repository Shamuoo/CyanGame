FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# ── Base packages ──────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y \
    xvfb \
    x11-utils \
    ffmpeg \
    pulseaudio \
    wget \
    curl \
    ca-certificates \
    libgl1 \
    libgles2 \
    mesa-utils \
    python3 \
    python3-pip \
    # RetroArch
    retroarch \
    libretro-* \
    # PCSX2 (PS2)
    pcsx2 \
    # Dolphin (GameCube/Wii)
    dolphin-emu \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# ── DuckStation (PS1) — better than RetroArch Beetle for most games ───
RUN wget -qO /tmp/duckstation.AppImage \
    "https://github.com/stenzek/duckstation/releases/latest/download/DuckStation-x64.AppImage" \
    && chmod +x /tmp/duckstation.AppImage \
    && /tmp/duckstation.AppImage --appimage-extract \
    && mv squashfs-root /opt/duckstation \
    && ln -s /opt/duckstation/duckstation-nogui /usr/local/bin/duckstation-nogui \
    && rm /tmp/duckstation.AppImage || true

# ── Emulation manager API ──────────────────────────────────────────────
COPY emulation-api.py /opt/emulation-api.py
RUN pip3 install flask --break-system-packages

# ── RetroArch cores ───────────────────────────────────────────────────
# Cores installed via apt as libretro-*
# Additional cores can be downloaded from buildbot
RUN mkdir -p /cores && \
    for core in /usr/lib/x86_64-linux-gnu/libretro/*.so; do \
        ln -sf "$core" /cores/; \
    done

# ── Startup script ────────────────────────────────────────────────────
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 7002

CMD ["/start.sh"]
