// Emulation Manager
// Handles starting emulators (RetroArch, PCSX2, Dolphin, etc.) on:
//   - Server: runs in the retroarch/emulation Docker container
//   - Node:   calls node agent HTTP API

const { spawn } = require('child_process');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const NODE_AGENT_PORT = process.env.NODE_AGENT_PORT || 7001;
const SRT_PORT        = process.env.SRT_PORT        || 8890;
const NAS_IP          = process.env.NAS_IP          || 'localhost';
const MEDIAMTX_HOST   = 'mediamtx'; // docker service name

// Track server-side emulation processes
// key: streamPath → { emulatorProc, ffmpegProc, display }
const serverProcesses = new Map();
let displayCounter = 100; // Xvfb display numbers

// ── Server-side emulation ────────────────────────────────────────────
async function startServerEmulation({ rom, emulator, streamPath }) {
  if (serverProcesses.has(streamPath)) {
    throw new Error('Emulation session already running for this path');
  }

  const display = `:${displayCounter++}`;
  const srtUrl = `srt://${MEDIAMTX_HOST}:${SRT_PORT}?streamid=${streamPath}&latency=200000`;

  // 1. Start virtual framebuffer
  const xvfb = spawn('Xvfb', [display, '-screen', '0', '1920x1080x24'], {
    detached: true, stdio: 'ignore'
  });

  await new Promise(r => setTimeout(r, 500)); // give Xvfb a moment

  // 2. Build emulator command
  const emuArgs = buildEmulatorArgs(emulator, rom, display);
  const emuProc = spawn(emuArgs[0], emuArgs.slice(1), {
    env: { ...process.env, DISPLAY: display },
    detached: true, stdio: 'ignore'
  });

  await new Promise(r => setTimeout(r, 1500)); // let emulator init

  // 3. FFmpeg: capture Xvfb → encode → SRT
  const ffmpeg = spawn('ffmpeg', [
    '-f', 'x11grab',
    '-display', display,
    '-video_size', '1920x1080',
    '-framerate', '60',
    '-i', display,
    '-vcodec', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-crf', '24',
    '-maxrate', '15M', '-bufsize', '30M',
    '-g', '120',
    '-f', 'mpegts',
    srtUrl
  ], { detached: true, stdio: ['ignore', 'ignore', 'pipe'] });

  ffmpeg.stderr.on('data', d => {
    const msg = d.toString();
    if (msg.includes('Error') || msg.includes('error')) {
      console.error(`[emu-server] FFmpeg error for ${streamPath}:`, msg.slice(0, 200));
    }
  });

  serverProcesses.set(streamPath, { xvfbProc: xvfb, emuProc, ffmpegProc: ffmpeg, display });

  console.log(`[emu-server] Started: ${emulator.name} | ${rom.title} | display ${display}`);
  return { ok: true, mode: 'emulation_server', streamPath };
}

async function stopServerEmulation(streamPath) {
  const procs = serverProcesses.get(streamPath);
  if (!procs) return;

  const kill = (proc) => {
    try { process.kill(-proc.pid, 'SIGTERM'); } catch {}
  };

  kill(procs.ffmpegProc);
  kill(procs.emuProc);
  kill(procs.xvfbProc);

  serverProcesses.delete(streamPath);
  console.log(`[emu-server] Stopped: ${streamPath}`);
}

// ── Node-side emulation ──────────────────────────────────────────────
async function startNodeEmulation({ node, rom, emulator, streamPath }) {
  const url = `http://${node.ip}:${NODE_AGENT_PORT}/emulate/start`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      romPath:      rom.file_path,
      system:       rom.system,
      emulatorBin:  emulator.binary,
      emulatorCore: emulator.core,
      extraArgs:    emulator.extra_args,
      streamPath,
      nasIp:        NAS_IP,
      srtPort:      SRT_PORT,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: 'Node error' }));
    throw new Error(e.error || `Node returned ${res.status}`);
  }
  return res.json();
}

async function stopNodeEmulation(node, streamPath) {
  const url = `http://${node.ip}:${NODE_AGENT_PORT}/emulate/stop`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ streamPath }),
    signal: AbortSignal.timeout(5000),
  }).catch(e => console.warn('[emu-node] Stop failed:', e.message));
}

// ── Emulator CLI builder ─────────────────────────────────────────────
function buildEmulatorArgs(emulator, rom, display) {
  const extra = emulator.extra_args ? emulator.extra_args.split(' ').filter(Boolean) : [];

  switch (emulator.binary) {
    case 'retroarch':
      return [
        'retroarch',
        '--libretro', emulator.core,
        '--fullscreen',
        '--verbose',
        ...extra,
        rom.file_path,
      ];

    case 'duckstation-nogui':
      return ['duckstation-nogui', '--fullscreen', ...extra, rom.file_path];

    case 'pcsx2':
      return ['pcsx2', '--fullscreen', '--nogui', ...extra, rom.file_path];

    case 'dolphin-emu-nogui':
      return ['dolphin-emu-nogui', '--exec', rom.file_path, ...extra];

    case 'Ryujinx':
      return ['Ryujinx', ...extra, rom.file_path];

    case 'rpcs3':
      return ['rpcs3', '--no-gui', ...extra, rom.file_path];

    default:
      return [emulator.binary, ...extra, rom.file_path];
  }
}

// ── Best emulator picker ─────────────────────────────────────────────
// Given a system and target (server/node), pick the best available emulator
function pickEmulator(emulators, system, target) {
  const candidates = emulators.filter(e =>
    e.system === system && (e.target === target || e.target === 'both')
  );

  // Prefer standalone over RetroArch for better compatibility
  const standalone = candidates.find(e => e.binary !== 'retroarch');
  return standalone || candidates[0] || null;
}

module.exports = {
  startServerEmulation,
  stopServerEmulation,
  startNodeEmulation,
  stopNodeEmulation,
  pickEmulator,
};
