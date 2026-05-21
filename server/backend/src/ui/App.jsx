import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────
function getServer() { return localStorage.getItem("consolehub_server") || "http://192.168.1.100:7000"; }
function setServer(u) { localStorage.setItem("consolehub_server", u.replace(/\/$/, "")); }
function api(path, opts = {}) {
  return fetch(`${getServer()}/api${path}`, {
    headers: { "Content-Type": "application/json" }, ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e.error || "Request failed")));
}

// ─────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────
const CONSOLE_META = {
  nes:{name:"NES",color:"#e60012",icon:"NES"},snes:{name:"Super Nintendo",color:"#7B2FBE",icon:"SNS"},
  n64:{name:"Nintendo 64",color:"#009AC7",icon:"N64"},gamecube:{name:"GameCube",color:"#6A35BE",icon:"GCN"},
  wii:{name:"Wii",color:"#8E8E8E",icon:"WII"},wiiu:{name:"Wii U",color:"#009AC7",icon:"WIU"},
  switch:{name:"Nintendo Switch",color:"#E4000F",icon:"NSW"},genesis:{name:"Sega Genesis",color:"#1A6DD1",icon:"GEN"},
  ps1:{name:"PlayStation",color:"#003087",icon:"PS1"},ps2:{name:"PlayStation 2",color:"#00439C",icon:"PS2"},
  ps3:{name:"PlayStation 3",color:"#003791",icon:"PS3"},ps4:{name:"PlayStation 4",color:"#003791",icon:"PS4"},
  ps5:{name:"PlayStation 5",color:"#003791",icon:"PS5"},xbox:{name:"Xbox",color:"#107C10",icon:"XBX"},
  xbox360:{name:"Xbox 360",color:"#52B043",icon:"360"},xbone:{name:"Xbox One",color:"#107C10",icon:"XB1"},
  xboxseries:{name:"Xbox Series X|S",color:"#107C10",icon:"XSX"},
  gba:{name:"Game Boy Advance",color:"#7B35A0",icon:"GBA"},nds:{name:"Nintendo DS",color:"#CC2200",icon:"NDS"},
};

// Systems that can be emulated + display name
const EMU_SYSTEMS = {
  nes:"NES",snes:"SNES",gb:"Game Boy",gbc:"Game Boy Color",gba:"GBA",n64:"Nintendo 64",
  genesis:"Sega Genesis",ps1:"PlayStation",ps2:"PlayStation 2",gamecube:"GameCube",
  wii:"Wii",nds:"Nintendo DS",switch:"Switch",ps3:"PS3",
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#07090F;--bg2:#0D1220;--bg3:#141C2E;--card:#0F1623;
  --border:rgba(255,255,255,0.07);--border2:rgba(255,255,255,0.13);
  --cyan:#22D3EE;--purple:#A855F7;--green:#10B981;--orange:#F97316;
  --text:#E2E8F0;--muted:#475569;--ok:#10B981;--err:#EF4444;
  --font:'Chakra Petch',sans-serif;--mono:'JetBrains Mono',monospace;
}
body{background:var(--bg);color:var(--text);font-family:var(--font);}
input,select,textarea{background:var(--bg3);border:1px solid var(--border2);border-radius:7px;padding:9px 12px;font-family:var(--font);font-size:13px;color:var(--text);outline:none;width:100%;transition:border .15s;}
input:focus,select:focus,textarea:focus{border-color:rgba(34,211,238,.4);}
select option{background:var(--bg3);}
label{font-size:11px;font-family:var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.07em;display:block;margin-bottom:5px;}
.field{margin-bottom:14px;}
.hub{min-height:100vh;display:flex;flex-direction:column;}

/* topbar */
.topbar{display:flex;align-items:center;gap:12px;padding:0 20px;height:54px;border-bottom:1px solid var(--border);background:var(--bg);position:sticky;top:0;z-index:100;}
.logo{display:flex;align-items:center;gap:9px;flex-shrink:0;}
.logo-hex{width:26px;height:26px;background:var(--cyan);clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);}
.logo-name{font-size:14px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;}
.logo-ver{font-size:10px;font-family:var(--mono);color:var(--muted);background:var(--bg3);padding:2px 6px;border-radius:3px;}
.top-nav{display:flex;gap:2px;margin-left:12px;}
.nav-btn{background:none;border:none;cursor:pointer;font-family:var(--font);font-size:12px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding:6px 12px;border-radius:6px;transition:all .15s;}
.nav-btn:hover{color:var(--text);background:var(--bg3);}
.nav-btn.active{color:var(--cyan);background:rgba(34,211,238,.08);}
.top-right{display:flex;align-items:center;gap:10px;margin-left:auto;}
.search-wrap{position:relative;}
.search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:13px;pointer-events:none;}
.search-input{background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:7px 12px 7px 32px;font-family:var(--font);font-size:13px;color:var(--text);width:200px;outline:none;transition:all .2s;}
.search-input:focus{border-color:rgba(34,211,238,.4);width:240px;}
.search-input::placeholder{color:var(--muted);}
.pill{display:flex;align-items:center;gap:6px;padding:5px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:20px;font-size:11px;font-family:var(--mono);color:var(--muted);}
.dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.dot.on{background:var(--ok);box-shadow:0 0 6px var(--ok);animation:pulse 2s infinite;}
.dot.off{background:var(--err);}
.dot.live{background:var(--cyan);box-shadow:0 0 6px var(--cyan);animation:pulse 1.5s infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}

/* main */
.main{flex:1;padding:22px 24px;max-width:1440px;margin:0 auto;width:100%;}

/* tabs within views */
.view-tabs{display:flex;gap:2px;margin-bottom:22px;background:var(--bg3);border-radius:10px;padding:4px;width:fit-content;}
.view-tab{background:none;border:none;cursor:pointer;font-family:var(--font);font-size:12px;font-weight:600;letter-spacing:.05em;color:var(--muted);padding:7px 16px;border-radius:7px;transition:all .15s;}
.view-tab.active{background:var(--bg2);color:var(--text);box-shadow:0 1px 4px rgba(0,0,0,.4);}

/* filter bar */
.fbar{display:flex;align-items:center;gap:7px;margin-bottom:20px;flex-wrap:wrap;}
.flabel{font-size:10px;font-family:var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-right:4px;}
.chip{display:flex;align-items:center;gap:6px;padding:5px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:20px;cursor:pointer;font-size:12px;font-weight:500;color:var(--muted);transition:all .15s;white-space:nowrap;font-family:var(--font);}
.chip:hover{border-color:var(--border2);color:var(--text);}
.chip-n{font-size:10px;font-family:var(--mono);background:rgba(0,0,0,.3);padding:1px 5px;border-radius:3px;}

/* game grid */
.gh{display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap;}
.gh-title{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);}
.gh-count{font-size:11px;font-family:var(--mono);color:var(--muted);opacity:.5;}
.ggrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:11px;}

/* game card */
.gcard{background:var(--card);border:1px solid var(--border);border-radius:10px;overflow:hidden;cursor:pointer;transition:all .18s;position:relative;}
.gcard:hover{transform:translateY(-3px);border-color:var(--border2);box-shadow:0 14px 36px rgba(0,0,0,.55);}
.gcov{height:115px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;}
.gcov img{width:100%;height:100%;object-fit:cover;}
.gcov-txt{font-size:12px;font-weight:700;color:rgba(255,255,255,.85);text-align:center;padding:10px;position:relative;z-index:1;}
.gcov-play{position:absolute;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .18s;}
.gcard:hover .gcov-play{opacity:1;}
.play-circle{width:38px;height:38px;background:var(--cyan);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#000;font-size:15px;padding-left:3px;}
.gbadge{position:absolute;top:7px;right:7px;font-size:9px;font-weight:700;font-family:var(--mono);padding:2px 6px;border-radius:3px;}
.gbadge.live{background:var(--err);color:#fff;}
.gbadge.emu{background:rgba(168,85,247,.9);color:#fff;}
.gbody{padding:9px 11px;}
.gtitle{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px;}
.gmeta{display:flex;align-items:center;justify-content:space-between;gap:4px;flex-wrap:wrap;}
.gcon{font-size:10px;font-family:var(--mono);}
.gemu-tag{font-size:9px;font-family:var(--mono);background:rgba(168,85,247,.2);color:var(--purple);padding:1px 5px;border-radius:3px;}

/* ROM grid */
.rgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:11px;}
.rcard{background:var(--card);border:1px solid var(--border);border-radius:10px;overflow:hidden;cursor:pointer;transition:all .18s;position:relative;}
.rcard:hover{transform:translateY(-3px);border-color:var(--border2);box-shadow:0 14px 36px rgba(0,0,0,.55);}
.rcov{height:110px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;}
.rcov-icon{font-size:32px;opacity:.5;}
.rcov-sys{position:absolute;top:7px;left:7px;font-size:9px;font-weight:700;font-family:var(--mono);background:rgba(0,0,0,.6);color:var(--purple);padding:2px 7px;border-radius:3px;text-transform:uppercase;}
.rbody{padding:9px 11px;}
.rtitle{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px;}
.rmeta{font-size:10px;font-family:var(--mono);color:var(--muted);}

/* modals */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:200;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);animation:fi .2s;}
@keyframes fi{from{opacity:0}to{opacity:1}}
.modal{background:var(--bg2);border:1px solid var(--border2);border-radius:16px;width:500px;max-width:95vw;max-height:90vh;overflow-y:auto;animation:su .22s cubic-bezier(.34,1.56,.64,1);}
.modal.wide{width:600px;}
@keyframes su{from{transform:translateY(28px);opacity:0}to{transform:translateY(0);opacity:1}}
.mhead{padding:20px 22px 16px;border-bottom:1px solid var(--border);}
.mtitle{font-size:16px;font-weight:700;}
.msub{font-size:12px;font-family:var(--mono);color:var(--muted);margin-top:3px;}
.mbody{padding:20px 22px;}
.mfoot{padding:14px 22px;border-top:1px solid var(--border);display:flex;gap:9px;justify-content:flex-end;}

/* Play Mode Picker - the key new UI */
.game-hero{height:180px;display:flex;align-items:flex-end;padding:18px;position:relative;overflow:hidden;}
.game-hero-title{font-size:22px;font-weight:700;text-shadow:0 2px 10px rgba(0,0,0,.8);position:relative;z-index:1;line-height:1.2;}
.game-hero-tags{display:flex;gap:6px;position:absolute;top:14px;right:14px;z-index:1;}
.htag{font-size:10px;font-family:var(--mono);padding:3px 8px;border-radius:4px;}

.play-modes{display:flex;flex-direction:column;gap:8px;margin-bottom:18px;}
.play-mode{border:1px solid var(--border2);border-radius:12px;padding:14px 16px;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:12px;}
.play-mode:hover{border-color:rgba(255,255,255,.2);}
.play-mode.selected{border-color:var(--cyan);background:rgba(34,211,238,.07);}
.play-mode.selected.emu-mode{border-color:var(--purple);background:rgba(168,85,247,.07);}
.play-mode.disabled{opacity:.4;cursor:not-allowed;}
.play-mode.disabled:hover{border-color:var(--border2);}
.pm-icon{font-size:20px;flex-shrink:0;}
.pm-body{flex:1;}
.pm-title{font-size:13px;font-weight:600;margin-bottom:3px;}
.pm-sub{font-size:11px;font-family:var(--mono);color:var(--muted);}
.pm-badge{font-size:9px;font-family:var(--mono);padding:2px 7px;border-radius:3px;font-weight:700;flex-shrink:0;}
.pm-badge.hw{background:rgba(34,211,238,.15);color:var(--cyan);}
.pm-badge.emu{background:rgba(168,85,247,.15);color:var(--purple);}
.pm-badge.off{background:rgba(239,68,68,.15);color:var(--err);}

.node-picker{margin-top:10px;}
.node-picker label{margin-bottom:6px;}

/* nodes */
.ngrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px;}
.ncard{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:17px;}
.ncard.on{border-top:2px solid var(--ok);}
.ncard.off{border-top:2px solid var(--err);opacity:.6;}
.nhead{display:flex;align-items:flex-start;gap:10px;margin-bottom:14px;}
.nname{font-size:14px;font-weight:600;}
.nip{font-size:11px;font-family:var(--mono);color:var(--muted);margin-top:2px;}
.nos{font-size:10px;font-family:var(--mono);color:var(--muted);background:var(--bg3);padding:2px 7px;border-radius:3px;text-transform:uppercase;margin-left:auto;flex-shrink:0;}
.nclist{display:flex;flex-direction:column;gap:5px;}
.ncrow{display:flex;align-items:center;gap:9px;padding:6px 9px;background:var(--bg3);border-radius:7px;font-size:12px;}
.ncicon{width:28px;height:20px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;font-family:var(--mono);flex-shrink:0;}
.ncname{flex:1;color:var(--text);}
.ncst{font-size:10px;font-family:var(--mono);}
.ncst.active{color:var(--cyan);}
.ncst.idle{color:var(--muted);}
.nfoot{margin-top:12px;padding-top:11px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}

/* stream viewer */
.sview{position:fixed;inset:0;background:#000;z-index:300;display:flex;flex-direction:column;}
.scanvas{flex:1;display:flex;align-items:center;justify-content:center;position:relative;background:#020408;}
.sph{display:flex;flex-direction:column;align-items:center;gap:14px;color:var(--muted);}
.soverlay{position:absolute;inset:0;opacity:0;transition:opacity .25s;background:linear-gradient(to bottom,rgba(0,0,0,.75) 0%,transparent 18%,transparent 78%,rgba(0,0,0,.85) 100%);}
.scanvas:hover .soverlay{opacity:1;}
.stop{position:absolute;top:0;left:0;right:0;padding:14px 18px;display:flex;align-items:center;gap:10px;}
.sgame{font-size:15px;font-weight:700;}
.slive{display:flex;align-items:center;gap:6px;padding:3px 9px;border-radius:4px;font-size:10px;font-weight:700;font-family:var(--mono);}
.slive.hw{background:var(--err);}
.slive.emu{background:var(--purple);}
.sbot{position:absolute;bottom:0;left:0;right:0;padding:14px 18px;}
.shotkeys{display:flex;gap:14px;flex-wrap:wrap;}
.hk{display:flex;align-items:center;gap:5px;font-size:10px;font-family:var(--mono);color:rgba(255,255,255,.45);}
.key{background:rgba(255,255,255,.13);padding:2px 6px;border-radius:3px;color:rgba(255,255,255,.8);}
.sctrl{padding:11px 18px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px;background:var(--bg);}
.sinfo{font-size:11px;font-family:var(--mono);color:var(--muted);margin-left:auto;}

/* buttons */
.btn{border:none;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:600;letter-spacing:.04em;border-radius:9px;padding:10px 18px;transition:all .15s;display:inline-flex;align-items:center;gap:7px;}
.btn-primary{background:var(--cyan);color:#000;}
.btn-primary:hover{background:#38BDF8;transform:translateY(-1px);}
.btn-primary:disabled{background:var(--muted);cursor:not-allowed;transform:none;color:rgba(0,0,0,.6);}
.btn-purple{background:var(--purple);color:#fff;}
.btn-purple:hover{background:#C084FC;transform:translateY(-1px);}
.btn-ghost{background:var(--bg3);border:1px solid var(--border2);color:var(--muted);}
.btn-ghost:hover{color:var(--text);}
.btn-danger{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:var(--err);}
.btn-danger:hover{background:rgba(239,68,68,.2);}
.btn-sm{padding:6px 12px;font-size:12px;border-radius:7px;}

/* misc */
.sec-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
.sec-title{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);}
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:80px 20px;color:var(--muted);}
.empty-icon{font-size:32px;opacity:.4;}
.empty-text{font-size:12px;font-family:var(--mono);}
.loading{display:flex;align-items:center;justify-content:center;padding:60px;color:var(--muted);font-family:var(--mono);font-size:12px;gap:10px;}
.spinner{width:16px;height:16px;border:2px solid var(--border2);border-top-color:var(--cyan);border-radius:50%;animation:spin .7s linear infinite;}
@keyframes spin{to{transform:rotate(360deg)}}
.err-banner{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);border-radius:9px;padding:12px 16px;font-size:12px;font-family:var(--mono);color:var(--err);margin-bottom:16px;}
.toasts{position:fixed;bottom:24px;right:24px;z-index:500;display:flex;flex-direction:column;gap:8px;}
.toast{padding:12px 16px;border-radius:9px;font-size:12px;font-family:var(--mono);animation:ti .25s;max-width:320px;display:flex;align-items:center;gap:8px;}
@keyframes ti{from{transform:translateX(30px);opacity:0}to{transform:translateX(0);opacity:1}}
.toast.ok{background:#052e16;border:1px solid rgba(16,185,129,.3);color:var(--ok);}
.toast.err{background:#2d0a0a;border:1px solid rgba(239,68,68,.3);color:var(--err);}
.toast.info{background:var(--bg3);border:1px solid var(--border2);color:var(--text);}
.divider{height:1px;background:var(--border);margin:14px 0;}
`;

// ─────────────────────────────────────────────
//  HOOKS
// ─────────────────────────────────────────────
let toastId = 0;
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = "info") => {
    const id = ++toastId;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  return { toasts, toast: add };
}

function useData() {
  const [nodes, setNodes] = useState([]);
  const [consoles, setConsoles] = useState([]);
  const [games, setGames] = useState([]);
  const [roms, setRoms] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connErr, setConnErr] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [n, c, g, r, s] = await Promise.all([
        api("/nodes"), api("/consoles"), api("/games"), api("/roms"), api("/sessions"),
      ]);
      setNodes(n); setConsoles(c); setGames(g); setRoms(r); setSessions(s);
      setConnErr(null);
    } catch (e) { setConnErr(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const base = getServer().replace(/^http/, "ws");
    let ws, retry;
    const connect = () => {
      try {
        ws = new WebSocket(`${base}/ws?type=portal`);
        ws.onmessage = e => {
          try { const m = JSON.parse(e.data); if (["NODE_STATUS","NODE_OFFLINE","STREAM_STARTED"].includes(m.type)) refresh(); } catch {}
        };
        ws.onclose = () => { retry = setTimeout(connect, 5000); };
        ws.onerror = () => ws.close();
      } catch {}
    };
    connect();
    return () => { clearTimeout(retry); ws?.close(); };
  }, [refresh]);

  return { nodes, consoles, games, roms, sessions, loading, connErr, refresh, setGames, setRoms };
}

// ─────────────────────────────────────────────
//  GAME CARD  (physical or ROM)
// ─────────────────────────────────────────────
function GameCard({ game, console_, node, rom, session, onSelect }) {
  const meta = CONSOLE_META[console_?.type || rom?.system] || {};
  const hasRom = !!game.rom_id;
  const unavail = !hasRom && node?.status === "offline";
  return (
    <div className={`gcard`} style={{ opacity: unavail ? .4 : 1, cursor: unavail ? "not-allowed" : "pointer" }}
      onClick={() => !unavail && onSelect(game)}>
      <div className="gcov" style={{ background: `linear-gradient(135deg,${meta.color||"#1e293b"},${(meta.color||"#1e293b")}55)` }}>
        {game.cover_url || rom?.cover_url
          ? <img src={game.cover_url || rom?.cover_url} alt={game.title}/>
          : <div className="gcov-txt">{game.title.split(":")[0]}</div>}
        {!unavail && <div className="gcov-play"><div className="play-circle">▶</div></div>}
        {session && <div className="gbadge live">LIVE</div>}
        {hasRom && !session && <div className="gbadge emu">EMU</div>}
      </div>
      <div className="gbody">
        <div className="gtitle">{game.title}</div>
        <div className="gmeta">
          {console_ && <span className="gcon" style={{ color:meta.color }}>{meta.icon||"?"}</span>}
          {hasRom && <span className="gemu-tag">⚙ emulatable</span>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  ROM CARD
// ─────────────────────────────────────────────
function RomCard({ rom, onSelect }) {
  const sysName = EMU_SYSTEMS[rom.system] || rom.system;
  const sizeStr = rom.file_size
    ? rom.file_size > 1e9 ? `${(rom.file_size/1e9).toFixed(1)} GB` : `${(rom.file_size/1e6).toFixed(0)} MB`
    : "";
  return (
    <div className="rcard" onClick={() => onSelect(rom)}>
      <div className="rcov" style={{ background:`linear-gradient(135deg,rgba(168,85,247,.2),rgba(168,85,247,.05))` }}>
        {rom.cover_url ? <img src={rom.cover_url} alt={rom.title} style={{width:"100%",height:"100%",objectFit:"cover"}}/> : <div className="rcov-icon">💾</div>}
        <div className="rcov-sys">{sysName}</div>
        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",opacity:0,transition:"opacity .18s"}} className="rcov-play-inner">
          <div className="play-circle" style={{background:"var(--purple)"}}>▶</div>
        </div>
      </div>
      <div className="rbody">
        <div className="rtitle">{rom.title}</div>
        <div className="rmeta">{sizeStr}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  PLAY MODE PICKER MODAL  (the key new component)
// ─────────────────────────────────────────────
function PlayModeModal({ game, rom, consoles, nodes, sessions, onLaunch, onClose }) {
  const [mode, setMode] = useState(null);
  const [nodeId, setNodeId] = useState("");
  const [consoleId, setConsoleId] = useState("");
  const [launching, setLaunching] = useState(false);
  const [err, setErr] = useState(null);

  // Find consoles that can play this game (same type as game's console)
  const gameConsole = consoles.find(c => c.id === game.console_id);
  const compatibleConsoles = gameConsole
    ? consoles.filter(c => c.type === gameConsole.type)
    : [];

  const onlineNodes = nodes.filter(n => n.status === "online");
  const hasRom = !!rom;
  const hasConsole = compatibleConsoles.length > 0;

  const meta = CONSOLE_META[gameConsole?.type || rom?.system] || {};
  const heroColor = meta.color || "#1e293b";

  // Auto-select first available console
  useEffect(() => {
    if (compatibleConsoles.length > 0) setConsoleId(compatibleConsoles[0].id);
    if (onlineNodes.length > 0) setNodeId(onlineNodes[0].id);
  }, []);

  const selectedConsole = consoles.find(c => c.id === consoleId);
  const selectedNode = nodes.find(n => n.id === nodeId);
  const consoleNode = selectedConsole ? nodes.find(n => n.id === selectedConsole.node_id) : null;
  const consoleInUse = selectedConsole ? sessions.some(s => s.console_id === selectedConsole.id) : false;

  const canLaunchPhysical = hasConsole && consoleNode?.status === "online" && !consoleInUse;
  const canLaunchServer   = hasRom;
  const canLaunchNode     = hasRom && onlineNodes.length > 0;
  const canLaunch = (mode === "physical" && canLaunchPhysical)
    || (mode === "emulation_server" && canLaunchServer)
    || (mode === "emulation_node" && canLaunchNode && nodeId);

  const handleLaunch = async () => {
    if (!mode || !canLaunch) return;
    setLaunching(true); setErr(null);
    try {
      await onLaunch({ gameId: game.id, mode, consoleId: mode === "physical" ? consoleId : undefined, nodeId: mode === "emulation_node" ? nodeId : undefined });
      onClose();
    } catch(e) { setErr(String(e)); setLaunching(false); }
  };

  const isEmu = mode && mode !== "physical";

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {/* Hero */}
        <div className="game-hero" style={{ background:`linear-gradient(145deg,${heroColor},${heroColor}44)` }}>
          {(game.cover_url || rom?.cover_url) && <img src={game.cover_url||rom?.cover_url} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.25}}/>}
          <div style={{position:"absolute",inset:0,background:`linear-gradient(to top,rgba(0,0,0,.8) 0%,transparent 60%)`}}/>
          <div className="game-hero-tags">
            {hasConsole && <span className="htag" style={{background:(heroColor||"#333")+"33",color:heroColor||"var(--text)"}}>{meta.icon}</span>}
            {hasRom && <span className="htag" style={{background:"rgba(168,85,247,.25)",color:"var(--purple)"}}>⚙ EMU</span>}
          </div>
          <div className="game-hero-title">{game.title}</div>
        </div>

        <div className="mbody">
          {err && <div className="err-banner">⚠ {err}</div>}

          <div style={{fontSize:11,fontFamily:"var(--mono)",color:"var(--muted)",marginBottom:12,textTransform:"uppercase",letterSpacing:".08em"}}>Choose how to play</div>

          <div className="play-modes">
            {/* Physical console */}
            {hasConsole ? (
              <div className={`play-mode${mode==="physical"?" selected":""}${!canLaunchPhysical?" disabled":""}`}
                onClick={() => canLaunchPhysical && setMode("physical")}>
                <span className="pm-icon">🎮</span>
                <div className="pm-body">
                  <div className="pm-title">Play on Console</div>
                  <div className="pm-sub">{compatibleConsoles.map(c=>`${c.name}`).join(" · ")} · native hardware</div>
                </div>
                <span className={`pm-badge ${canLaunchPhysical?"hw":"off"}`}>
                  {canLaunchPhysical ? "HARDWARE" : consoleInUse ? "IN USE" : "OFFLINE"}
                </span>
              </div>
            ) : (
              <div className="play-mode disabled">
                <span className="pm-icon">🎮</span>
                <div className="pm-body"><div className="pm-title">Play on Console</div><div className="pm-sub">No console assigned to this game</div></div>
                <span className="pm-badge off">N/A</span>
              </div>
            )}

            {/* Emulate on server */}
            {hasRom ? (
              <div className={`play-mode emu-mode${mode==="emulation_server"?" selected":""}`}
                onClick={() => setMode("emulation_server")}>
                <span className="pm-icon">🖥️</span>
                <div className="pm-body">
                  <div className="pm-title">Emulate on Server</div>
                  <div className="pm-sub">Runs on your NAS · {rom.system.toUpperCase()} · {rom.title}</div>
                </div>
                <span className="pm-badge emu">SERVER</span>
              </div>
            ) : (
              <div className="play-mode disabled">
                <span className="pm-icon">🖥️</span>
                <div className="pm-body"><div className="pm-title">Emulate on Server</div><div className="pm-sub">No ROM linked — add one in the ROM Library</div></div>
                <span className="pm-badge off">NO ROM</span>
              </div>
            )}

            {/* Emulate on node */}
            {hasRom ? (
              <div className={`play-mode emu-mode${mode==="emulation_node"?" selected":""}${!canLaunchNode?" disabled":""}`}
                onClick={() => canLaunchNode && setMode("emulation_node")}>
                <span className="pm-icon">📦</span>
                <div className="pm-body">
                  <div className="pm-title">Emulate on Node</div>
                  <div className="pm-sub">Runs on a Wyse / N100 near the TV · lower network hops</div>
                </div>
                <span className={`pm-badge ${canLaunchNode?"emu":"off"}`}>
                  {canLaunchNode ? "NODE" : "NO NODES"}
                </span>
              </div>
            ) : null}
          </div>

          {/* Console picker (physical mode) */}
          {mode === "physical" && compatibleConsoles.length > 1 && (
            <div className="field">
              <label>Which Console</label>
              <select value={consoleId} onChange={e => setConsoleId(e.target.value)}>
                {compatibleConsoles.map(c => {
                  const n = nodes.find(nd => nd.id === c.node_id);
                  return <option key={c.id} value={c.id}>{c.name} — {n?.name || "unknown node"} ({n?.status || "?"})</option>;
                })}
              </select>
            </div>
          )}

          {/* Node picker (emulation_node mode) */}
          {mode === "emulation_node" && (
            <div className="field node-picker">
              <label>Which Node to Emulate On</label>
              <select value={nodeId} onChange={e => setNodeId(e.target.value)}>
                {onlineNodes.map(n => <option key={n.id} value={n.id}>{n.name} ({n.ip})</option>)}
              </select>
            </div>
          )}

          {mode === "emulation_server" && (
            <div style={{fontSize:11,fontFamily:"var(--mono)",color:"var(--muted)",padding:"10px 14px",background:"var(--bg3)",borderRadius:8,marginBottom:4}}>
              ⚠ First-launch may take 10–20s for emulator to init
            </div>
          )}

          <div style={{display:"flex",gap:9,marginTop:16}}>
            <button className="btn btn-ghost" style={{flex:1}} onClick={onClose}>Cancel</button>
            <button
              className={`btn ${isEmu?"btn-purple":"btn-primary"}`}
              style={{flex:2}}
              disabled={!mode || !canLaunch || launching}
              onClick={handleLaunch}>
              {launching ? "Launching…" : !mode ? "Select a play mode" : isEmu ? "⚙ Start Emulation" : "▶ Launch Stream"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  STREAM VIEWER
// ─────────────────────────────────────────────
function StreamViewer({ game, session, onStop, onClose }) {
  const [elapsed, setElapsed] = useState(0);
  const videoRef = useRef(null);
  const isEmu = session?.mode !== "physical";

  useEffect(() => { const t = setInterval(() => setElapsed(s => s+1), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    if (!session?.streamUrl || !videoRef.current) return;
    const whepUrl = `${getServer()}${session.streamUrl}`;
    const pc = new RTCPeerConnection({ iceServers:[{urls:"stun:stun.l.google.com:19302"}] });
    pc.addTransceiver("video",{direction:"recvonly"});
    pc.addTransceiver("audio",{direction:"recvonly"});
    pc.ontrack = e => { if (videoRef.current) videoRef.current.srcObject = e.streams[0]; };
    (async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      try {
        const r = await fetch(whepUrl, { method:"POST", headers:{"Content-Type":"application/sdp"}, body:offer.sdp });
        if (r.ok) await pc.setRemoteDescription({ type:"answer", sdp: await r.text() });
      } catch(e) { console.warn("WHEP:", e); }
    })();
    return () => pc.close();
  }, [session]);

  const fmt = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const modeLabel = session?.mode === "emulation_server" ? "Server Emu" : session?.mode === "emulation_node" ? "Node Emu" : "Hardware";

  return (
    <div className="sview">
      <div className="scanvas">
        <video ref={videoRef} autoPlay playsInline style={{width:"100%",height:"100%",objectFit:"contain",display:"block"}}/>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
          <div className="sph" style={{opacity:.4}}><div style={{fontSize:36}}>{isEmu?"⚙":"📡"}</div><div style={{fontSize:12,fontFamily:"var(--mono)"}}>{session?.streamPath||"connecting…"}</div></div>
        </div>
        <div className="soverlay">
          <div className="stop">
            <span className="dot live"/>
            <span className="sgame">{game.title}</span>
            <span className={`slive ${isEmu?"emu":"hw"}`}>
              <span className="dot live" style={{width:6,height:6}}/>{modeLabel}
            </span>
          </div>
          <div className="sbot">
            <div className="shotkeys">
              <span className="hk"><span className="key">Shift+Tab</span>Overlay</span>
              <span className="hk"><span className="key">Ctrl+H</span>Home</span>
              {isEmu && <span className="hk"><span className="key">Ctrl+S</span>Save State</span>}
              <span className="hk"><span className="key">F11</span>Fullscreen</span>
            </div>
          </div>
        </div>
      </div>
      <div className="sctrl">
        {!isEmu && <button className="btn btn-ghost btn-sm">⌂ Home</button>}
        {isEmu && <button className="btn btn-ghost btn-sm">💾 Save State</button>}
        {isEmu && <button className="btn btn-ghost btn-sm">📂 Load State</button>}
        <button className="btn btn-ghost btn-sm">📷 Screenshot</button>
        <span className="sinfo">{game.title} · {modeLabel} · {fmt(elapsed)}</span>
        <button className="btn btn-danger btn-sm" onClick={async () => { await onStop(); onClose(); }}>■ End</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  MAIN APP
// ─────────────────────────────────────────────
export default function ConsoleHub() {
  const { nodes, consoles, games, roms, sessions, loading, connErr, refresh, setGames, setRoms } = useData();
  const { toasts, toast } = useToasts();

  const [view, setView] = useState("library");         // library | roms | nodes | settings
  const [libTab, setLibTab] = useState("all");          // all | by-console | by-system
  const [filterConsole, setFilterConsole] = useState("all");
  const [filterSystem, setFilterSystem] = useState("all");
  const [search, setSearch] = useState("");
  const [playModal, setPlayModal] = useState(null);     // game being launched
  const [streamData, setStreamData] = useState(null);   // { game, session }
  const [scanning, setScanning] = useState(false);

  const onlineNodes = nodes.filter(n => n.status === "online").length;
  const getConsole  = id => consoles.find(c => c.id === id);
  const getNode     = id => nodes.find(n => n.id === id);
  const getRom      = id => roms.find(r => r.id === id);
  const getSession  = cid => sessions.find(s => s.console_id === cid);

  // ── Filtered games ──────────────────────────────────────
  const filteredGames = games.filter(g => {
    if (search && !g.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (libTab === "by-console" && filterConsole !== "all" && g.console_id !== filterConsole) return false;
    return true;
  });

  // ── Filtered ROMs ───────────────────────────────────────
  const filteredRoms = roms.filter(r => {
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterSystem !== "all" && r.system !== filterSystem) return false;
    return true;
  });

  // ── ROM systems present ─────────────────────────────────
  const romSystems = [...new Set(roms.map(r => r.system))].sort();

  // ── Launch handler ──────────────────────────────────────
  const handleLaunch = async ({ gameId, mode, consoleId, nodeId }) => {
    const sess = await api("/sessions", {
      method: "POST",
      body: { gameId, mode, consoleId, nodeId },
    });
    const game = games.find(g => g.id === gameId);
    setPlayModal(null);
    setStreamData({ game, session: sess });
    refresh();
    toast(`Stream started — ${game?.title}`, "ok");
  };

  const handleStop = async () => {
    if (streamData?.session?.sessionId) {
      await api(`/sessions/${streamData.session.sessionId}`, { method: "DELETE" }).catch(() => {});
    }
    refresh();
    toast("Stream ended", "info");
  };

  // ── ROM scan ────────────────────────────────────────────
  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await api("/roms/scan", { method: "POST" });
      toast(`Scan complete — ${result.added} new ROMs found`, "ok");
      refresh();
    } catch(e) { toast(String(e), "err"); }
    finally { setScanning(false); }
  };

  // ── ROM play ────────────────────────────────────────────
  const handleRomPlay = async (rom) => {
    // Find or create a game entry for this ROM, then open play modal
    let game = games.find(g => g.rom_id === rom.id);
    if (!game) {
      // Auto-create a game entry linked to this ROM
      game = await api("/games", { method: "POST", body: { consoleId: null, title: rom.title, coverUrl: rom.cover_url } });
      await api("/roms/" + rom.id + "/link", { method: "POST", body: { gameId: game.id } });
      refresh();
    }
    setPlayModal({ game: { ...game, rom_id: rom.id }, rom });
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="hub">
        {/* Topbar */}
        <div className="topbar">
          <div className="logo">
            <div className="logo-hex"/>
            <span className="logo-name">ConsoleHub</span>
            <span className="logo-ver">v0.2</span>
          </div>
          <div className="top-nav">
            {[["library","Library"],["roms","ROMs"],["nodes","Nodes"]].map(([v,l]) => (
              <button key={v} className={`nav-btn${view===v?" active":""}`} onClick={() => setView(v)}>{l}</button>
            ))}
          </div>
          <div className="top-right">
            {(view === "library" || view === "roms") && (
              <div className="search-wrap">
                <span className="search-icon">⌕</span>
                <input className="search-input" placeholder={view==="roms"?"Search ROMs…":"Search games…"}
                  value={search} onChange={e => setSearch(e.target.value)}/>
              </div>
            )}
            {view === "roms" && (
              <button className="btn btn-ghost btn-sm" onClick={handleScan} disabled={scanning}>
                {scanning ? "Scanning…" : "⟳ Scan NAS"}
              </button>
            )}
            <div className="pill"><span className={`dot ${onlineNodes>0?"on":"off"}`}/>{onlineNodes}/{nodes.length} nodes</div>
            {sessions.length > 0 && <div className="pill"><span className="dot live"/>{sessions.length} live</div>}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="loading"><div className="spinner"/>connecting…</div>
        ) : connErr ? (
          <div className="main"><div className="err-banner">⚠ {connErr}</div></div>
        ) : (
          <>
            {/* ── Library ── */}
            {view === "library" && (
              <div className="main">
                <div className="view-tabs">
                  {[["all","All Games"],["by-console","By Console"]].map(([t,l]) => (
                    <button key={t} className={`view-tab${libTab===t?" active":""}`} onClick={() => setLibTab(t)}>{l}</button>
                  ))}
                </div>

                {libTab === "by-console" && (
                  <div className="fbar">
                    <span className="flabel">Console</span>
                    <div className="chip" style={filterConsole==="all"?{background:"rgba(34,211,238,.1)",borderColor:"rgba(34,211,238,.3)",color:"var(--cyan)"}:{}}
                      onClick={() => setFilterConsole("all")}>
                      All <span className="chip-n">{games.length}</span>
                    </div>
                    {consoles.map(c => {
                      const cnt = games.filter(g => g.console_id === c.id).length;
                      if (!cnt) return null;
                      const meta = CONSOLE_META[c.type]||{};
                      const node = getNode(c.node_id);
                      const active = filterConsole === c.id;
                      return (
                        <div key={c.id} className="chip"
                          style={active?{background:(meta.color||"#333")+"22",borderColor:(meta.color||"#333")+"55",color:meta.color}:{}}
                          onClick={() => setFilterConsole(c.id)}>
                          <span style={{width:6,height:6,borderRadius:"50%",background:node?.status==="online"?"var(--ok)":"var(--err)",display:"inline-block"}}/>
                          {meta.icon||c.type}<span className="chip-n">{cnt}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="gh">
                  <span className="gh-title">Games</span>
                  <span className="gh-count">{filteredGames.length} titles</span>
                  <div style={{marginLeft:"auto",display:"flex",gap:8}}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setView("roms")}>⚙ ROM Library</button>
                  </div>
                </div>

                {filteredGames.length > 0 ? (
                  <div className="ggrid">
                    {filteredGames.map(g => {
                      const c = getConsole(g.console_id);
                      const n = c ? getNode(c.node_id) : null;
                      const r = g.rom_id ? getRom(g.rom_id) : null;
                      const sess = c ? getSession(c.id) : null;
                      return (
                        <GameCard key={g.id} game={g} console_={c} node={n} rom={r} session={sess}
                          onSelect={game => setPlayModal({ game, rom: r || getRom(game.rom_id) })}/>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty">
                    <div className="empty-icon">🎮</div>
                    <div className="empty-text">{search ? "no games match" : "no games yet"}</div>
                  </div>
                )}
              </div>
            )}

            {/* ── ROM Library ── */}
            {view === "roms" && (
              <div className="main">
                <div className="fbar">
                  <span className="flabel">System</span>
                  <div className="chip" style={filterSystem==="all"?{background:"rgba(168,85,247,.1)",borderColor:"rgba(168,85,247,.3)",color:"var(--purple)"}:{}}
                    onClick={() => setFilterSystem("all")}>
                    All <span className="chip-n">{roms.length}</span>
                  </div>
                  {romSystems.map(sys => {
                    const cnt = roms.filter(r => r.system === sys).length;
                    const active = filterSystem === sys;
                    return (
                      <div key={sys} className="chip"
                        style={active?{background:"rgba(168,85,247,.15)",borderColor:"rgba(168,85,247,.4)",color:"var(--purple)"}:{}}
                        onClick={() => setFilterSystem(sys)}>
                        {EMU_SYSTEMS[sys]||sys}<span className="chip-n">{cnt}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="gh">
                  <span className="gh-title">ROM Library</span>
                  <span className="gh-count">{filteredRoms.length} ROMs</span>
                </div>

                {roms.length === 0 ? (
                  <div className="empty">
                    <div className="empty-icon">💾</div>
                    <div className="empty-text">no ROMs — mount your NAS share at /roms then click Scan NAS</div>
                  </div>
                ) : filteredRoms.length > 0 ? (
                  <div className="rgrid">
                    {filteredRoms.map(r => <RomCard key={r.id} rom={r} onSelect={handleRomPlay}/>)}
                  </div>
                ) : (
                  <div className="empty"><div className="empty-icon">💾</div><div className="empty-text">no ROMs match</div></div>
                )}
              </div>
            )}

            {/* ── Nodes ── */}
            {view === "nodes" && (
              <div className="main">
                <div className="sec-head"><span className="sec-title">Nodes</span><span style={{fontSize:11,fontFamily:"var(--mono)",color:"var(--muted)",opacity:.5}}>{onlineNodes} online</span></div>
                {nodes.length > 0 ? (
                  <div className="ngrid">
                    {nodes.map(n => {
                      const nc = consoles.filter(c => c.node_id === n.id);
                      return (
                        <div key={n.id} className={`ncard ${n.status==="online"?"on":"off"}`}>
                          <div className="nhead">
                            <div><div style={{display:"flex",alignItems:"center",gap:8}}><span className={`dot ${n.status==="online"?"on":"off"}`}/><span className="nname">{n.name}</span></div><div className="nip">{n.ip}</div></div>
                            <span className="nos">{n.os||"linux"}</span>
                          </div>
                          <div className="nclist">
                            {nc.map(c => {const meta=CONSOLE_META[c.type]||{};return(
                              <div key={c.id} className="ncrow">
                                <div className="ncicon" style={{background:(meta.color||"#333")+"33",color:meta.color}}>{meta.icon||"?"}</div>
                                <span className="ncname">{c.name}</span>
                                <span className={`ncst ${c.status}`}>{c.status==="active"?"● LIVE":"○ idle"}</span>
                              </div>
                            );})}
                            {nc.length===0&&<div style={{fontSize:12,color:"var(--muted)",fontFamily:"var(--mono)",padding:"6px 10px"}}>no consoles</div>}
                          </div>
                          <div className="nfoot">
                            <span style={{fontSize:11,color:"var(--muted)",fontFamily:"var(--mono)"}}>{n.status}</span>
                            <span style={{fontSize:11,color:"var(--purple)",fontFamily:"var(--mono)"}}>
                              {sessions.filter(s=>s.emulation_target===n.id).length} emulations
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty"><div className="empty-icon">📡</div><div className="empty-text">no nodes</div></div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Play Mode Modal */}
      {playModal && (
        <PlayModeModal
          game={playModal.game}
          rom={playModal.rom}
          consoles={consoles}
          nodes={nodes}
          sessions={sessions}
          onLaunch={handleLaunch}
          onClose={() => setPlayModal(null)}/>
      )}

      {/* Stream Viewer */}
      {streamData && (
        <StreamViewer
          game={streamData.game}
          session={streamData.session}
          onStop={handleStop}
          onClose={() => setStreamData(null)}/>
      )}

      {/* Toasts */}
      <div className="toasts">
        {toasts.map(t => <div key={t.id} className={`toast ${t.type}`}>{t.type==="ok"?"✓":t.type==="err"?"✗":"·"} {t.msg}</div>)}
      </div>
    </>
  );
}
