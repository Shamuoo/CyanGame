// Game Launcher
// Sends launch commands to consoles via their specific protocols

const NODE_AGENT_PORT = process.env.NODE_AGENT_PORT || 7001;

async function nodeRequest(nodeIp, path, body) {
  const res = await fetch(`http://${nodeIp}:${NODE_AGENT_PORT}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Node ${res.status}`);
  return res.json();
}

async function launchGame(console_, game) {
  const config = JSON.parse(console_.launch_config || '{}');

  switch (console_.launch_method) {

    // PS3 with WebMAN MOD — direct HTTP launch by title ID
    case 'webman':
      return launchWebman(config.consoleIp, game.launch_id);

    // PS4/PS5 — send command to node which handles PS Remote Play
    case 'ps-remote':
      return nodeRequest(console_.node_ip, '/launch/ps-remote', {
        consoleIp: config.consoleIp,
        titleId: game.launch_id,
      });

    // Xbox One / Series — SmartGlass protocol via node
    case 'smartglass':
      return nodeRequest(console_.node_ip, '/launch/smartglass', {
        consoleIp: config.consoleIp,
        titleId: game.launch_id,
      });

    // PS2 with OPL — launch via network shared ISO
    case 'opl':
      return launchOpl(config.consoleIp, game.launch_id);

    // Navigate to game via simulated controller inputs (Switch, etc.)
    case 'usbip-nav':
      return nodeRequest(console_.node_ip, '/launch/navigate', {
        sequence: game.launch_id, // pre-recorded button sequence
      });

    // Manual — user physically selects, we just start the stream
    case 'manual':
    default:
      console.log(`[launcher] ${console_.name}: manual launch, skipping`);
      return { ok: true, manual: true };
  }
}

// PS3 WebMAN MOD — GET request to console launches the game
async function launchWebman(consoleIp, titleId) {
  if (!consoleIp || !titleId) throw new Error('WebMAN needs consoleIp and titleId');

  // WebMAN launch URL format
  const url = `http://${consoleIp}/launch.ps3/${titleId}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

  if (!res.ok) throw new Error(`WebMAN returned ${res.status}`);
  return { ok: true, method: 'webman', titleId };
}

// PS2 OPL — trigger game load via HTTP (requires webserver on PS2 homebrew)
async function launchOpl(consoleIp, isoName) {
  if (!consoleIp || !isoName) throw new Error('OPL needs consoleIp and isoName');

  // OPL SMB mode — ISO name maps to network share
  // This is a simplified trigger; real OPL control varies by setup
  const url = `http://${consoleIp}/opl/launch?iso=${encodeURIComponent(isoName)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

  if (!res.ok) throw new Error(`OPL returned ${res.status}`);
  return { ok: true, method: 'opl', isoName };
}

module.exports = { launchGame };
