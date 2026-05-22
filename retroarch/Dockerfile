FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

RUN apt-get update && apt-get install -y \
    xvfb \
    x11-utils \
    ffmpeg \
    python3 \
    python3-pip \
    retroarch \
    libretro-nestopia \
    libretro-snes9x \
    libretro-gambatte \
    libretro-mgba \
    libretro-genesis-plus-gx \
    libretro-mupen64plus \
    libretro-beetle-psx \
    libretro-melonds \
    libretro-pcsx-rearmed \
    pcsx2 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Python deps
RUN pip3 install flask --break-system-packages

# Create symlinks for cores so we can find them easily
RUN mkdir -p /cores && \
    for f in /usr/lib/x86_64-linux-gnu/libretro/*.so; do \
        ln -sf "$f" /cores/ 2>/dev/null || true; \
    done

# Create directories
RUN mkdir -p /roms /saves /bios /config

COPY emulation-api.py /opt/emulation-api.py
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 7002

CMD ["/start.sh"]
