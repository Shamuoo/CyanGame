// Stream Manager
// Communicates with node-agent HTTP API to control FFmpeg capture

const NODE_AGENT_PORT = process.env.NODE_AGENT_PORT || 7001;

async function nodeRequest(nodeIp, method, path, body) {
  const url = `http://${nodeIp}:${NODE_AGENT_PORT}${path}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Node returned ${res.status}: ${text}`);
  }

  return res.json();
}

// Tell node to start capturing and push SRT stream to NAS
async function startStream(console_, streamPath) {
  const nasIp = process.env.NAS_IP || 'nas';  // set in docker-compose env

  return nodeRequest(console_.node_ip, 'POST', '/stream/start', {
    captureDevice: console_.capture_device,
    streamPath,
    nasIp,
    srtPort: 8890,
    resolution: console_.resolution,
    consoleType: console_.type,
  });
}

// Tell node to stop the SRT stream
async function stopStream(console_, streamPath) {
  return nodeRequest(console_.node_ip, 'POST', '/stream/stop', {
    streamPath,
  });
}

module.exports = { startStream, stopStream };
