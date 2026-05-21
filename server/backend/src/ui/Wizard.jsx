import { useState, useEffect, useCallback, useRef } from "react";

function getServer() { return localStorage.getItem("ch_server") || ""; }
function setServer(u) { localStorage.setItem("ch_server", u.replace(/\/$/, "")); }
function api(server, path, opts = {}) {
  return fetch(`${server}/api${path}`, {
    headers: { "Content-Type": "application/json" }, ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e.error || `HTTP ${r.status}`)));
}

const CONSOLE_TYPES = [
  { id:"ps5",       name:"PlayStation 5",    gen:"Modern",  color:"#0070D1", icon:"PS5", hdcp:true,  capture:"4K"   },
  { id:"xboxseries",name:"Xbox Series X|S",  gen:"Modern",  color:"#107C10", icon:"XSX", hdcp:true,  capture:"4K"   },
  { id:"switch",    name:"Nintendo Switch",   gen:"Modern",  color:"#E4000F", icon:"NSW", hdcp:false, capture:"1080p"},
  { id:"ps4",       name:"PlayStation 4",    gen:"8th Gen", color:"#003791", icon:"PS4", hdcp:true,  capture:"1080p"},
  { id:"xbone",     name:"Xbox One",         gen:"8th Gen", color:"#107C10", icon:"XB1", hdcp:true,  capture:"1080p"},
  { id:"wiiu",      name:"Wii U",            gen:"8th Gen", color:"#009AC7", icon:"WIU", hdcp:false, capture:"1080p"},
  { id:"ps3",       name:"PlayStation 3",    gen:"7th Gen", color:"#00439C", icon:"PS3", hdcp:true,  capture:"1080p"},
  { id:"xbox360",   name:"Xbox 360",         gen:"7th Gen", color:"#52B043", icon:"360", hdcp:false, capture:"1080p"},
  { id:"wii",       name:"Wii",              gen:"7th Gen", color:"#C0C0C0", icon:"WII", hdcp:false, capture:"480p" },
  { id:"ps2",       name:"PlayStation 2",    gen:"6th Gen", color:"#00439C", icon:"PS2", hdcp:false, capture:"480p" },
  { id:"gamecube",  name:"GameCube",         gen:"6th Gen", color:"#6A35BE", icon:"GCN", hdcp:false, capture:"480p" },
  { id:"xbox",      name:"Xbox (OG)",        gen:"6th Gen", color:"#52B043", icon:"XBX", hdcp:false, capture:"480p" },
  { id:"n64",       name:"Nintendo 64",      gen:"Retro",   color:"#009AC7", icon:"N64", hdcp:false, capture:"240p" },
  { id:"ps1",       name:"PlayStation",      gen:"Retro",   color:"#003087", icon:"PS1", hdcp:false, capture:"240p" },
  { id:"snes",      name:"Super Nintendo",   gen:"Retro",   color:"#7B2FBE", icon:"SNS", hdcp:false, capture:"240p" },
  { id:"genesis",   name:"Sega Genesis",     gen:"Retro",   color:"#1A6DD1", icon:"GEN", hdcp:false, capture:"240p" },
  { id:"nes",       name:"NES",              gen:"Retro",   color:"#E82C0C", icon:"NES", hdcp:false, capture:"240p" },
  { id:"gba",       name:"Game Boy Advance", gen:"Retro",   color:"#7B35A0", icon:"GBA", hdcp:false, capture:"240p" },
];

const STEPS = [
  { id:"welcome",   label:"Welcome"      },
  { id:"configure", label:"Configure"    },
  { id:"connect",   label:"Connect"      },
  { id:"nodes",     label:"Nodes"        },
  { id:"consoles",  label:"Consoles"     },
  { id:"romfolder", label:"ROM Folder"   },
  { id:"games",     label:"Games"        },
  { id:"done",      label:"Done"         },
];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#05080F;--bg2:#090E1A;--bg3:#0F1728;--bg4:#141E32;--card:#0C1422;--card2:#111B2E;
  --border:rgba(255,255,255,0.06);--border2:rgba(255,255,255,0.12);--border3:rgba(255,255,255,0.2);
  --cyan:#22D3EE;--purple:#A855F7;--green:#10B981;--orange:#F97316;--red:#EF4444;
  --text:#E2E8F0;--text2:#94A3B8;--muted:#475569;
  --font:'Chakra Petch',sans-serif;--mono:'JetBrains Mono',monospace;
}
body{background:var(--bg);color:var(--text);font-family:var(--font);min-height:100vh;}
.wizard{display:flex;min-height:100vh;position:relative;}
.wizard::before{content:'';position:fixed;inset:0;z-index:0;
  background-image:linear-gradient(rgba(34,211,238,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,.025) 1px,transparent 1px);
  background-size:40px 40px;pointer-events:none;}
.sidebar{width:240px;flex-shrink:0;background:var(--bg2);border-right:1px solid var(--border);
  display:flex;flex-direction:column;padding:24px 0;position:sticky;top:0;height:100vh;z-index:10;}
.s-logo{padding:0 20px 24px;border-bottom:1px solid var(--border);margin-bottom:20px;
  display:flex;align-items:center;gap:10px;}
.s-hex{width:28px;height:28px;background:var(--cyan);flex-shrink:0;
  clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);}
.s-name{font-size:14px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;}
.step-list{flex:1;padding:0 12px;display:flex;flex-direction:column;gap:2px;}
.si{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:8px;
  cursor:default;transition:all .18s;}
.si.click{cursor:pointer;}
.si.click:hover{background:var(--bg3);}
.si.cur{background:var(--bg3);box-shadow:inset 2px 0 0 var(--cyan);}
.si.done .sn{background:var(--green);color:#000;border-color:var(--green);}
.si.cur .sn{border-color:var(--cyan);color:var(--cyan);box-shadow:0 0 10px rgba(34,211,238,.25);}
.si.lock{opacity:.35;}
.sn{width:24px;height:24px;border-radius:50%;border:1.5px solid var(--border3);
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
  font-size:10px;font-weight:700;font-family:var(--mono);color:var(--muted);transition:all .18s;}
.sl{font-size:12px;font-weight:600;color:var(--muted);}
.si.cur .sl{color:var(--text);}
.si.done .sl{color:var(--text);}
.s-foot{padding:16px 20px 0;border-top:1px solid var(--border);margin-top:auto;
  font-size:10px;font-family:var(--mono);color:var(--muted);}
.panel{flex:1;display:flex;flex-direction:column;min-height:100vh;position:relative;z-index:1;}
.phead{padding:28px 44px 0;margin-bottom:32px;}
.prog{display:flex;gap:3px;margin-bottom:24px;}
.ps{height:3px;flex:1;border-radius:2px;background:var(--bg4);transition:background .3s;}
.ps.done{background:var(--green);}
.ps.cur{background:var(--cyan);}
.ptitle{font-size:26px;font-weight:700;letter-spacing:.02em;margin-bottom:6px;}
.psub{font-size:13px;color:var(--text2);font-weight:300;line-height:1.6;}
.pbody{flex:1;padding:0 44px;overflow-y:auto;}
.pfoot{padding:24px 44px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px;margin-top:auto;}
input,select,textarea{background:var(--bg3);border:1px solid var(--border2);border-radius:8px;
  padding:10px 14px;font-family:var(--font);font-size:13px;color:var(--text);
  outline:none;width:100%;transition:all .15s;}
input:focus,select:focus,textarea:focus{border-color:rgba(34,211,238,.45);box-shadow:0 0 0 3px rgba(34,211,238,.07);}
select option{background:var(--bg3);}
label{font-size:11px;font-family:var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.07em;display:block;margin-bottom:5px;}
.field{margin-bottom:16px;}
.hint{font-size:11px;font-family:var(--mono);color:var(--muted);margin-top:5px;line-height:1.5;}
.btn{border:none;cursor:pointer;font-family:var(--font);font-size:12px;font-weight:600;
  letter-spacing:.06em;border-radius:9px;padding:10px 20px;transition:all .15s;
  display:inline-flex;align-items:center;gap:7px;text-transform:uppercase;}
.btn-primary{background:var(--cyan);color:#000;}
.btn-primary:hover{background:#38BDF8;transform:translateY(-1px);}
.btn-primary:disabled{background:var(--bg4);color:var(--muted);cursor:not-allowed;transform:none;}
.btn-ghost{background:var(--bg3);border:1px solid var(--border2);color:var(--text2);}
.btn-ghost:hover{border-color:var(--border3);color:var(--text);}
.btn-danger{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);color:var(--red);}
.btn-sm{padding:6px 13px;font-size:11px;border-radius:7px;}
.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin-bottom:12px;}
.card.hi{border-color:var(--border2);}
.row{display:flex;align-items:center;gap:10px;}
.dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.dot.on{background:var(--green);box-shadow:0 0 6px var(--green);animation:p 2s infinite;}
.dot.off{background:var(--red);}
.dot.warn{background:var(--orange);}
@keyframes p{0%,100%{opacity:1}50%{opacity:.3}}
.badge{font-size:10px;font-family:var(--mono);font-weight:600;padding:3px 8px;border-radius:4px;letter-spacing:.04em;}
.b-ok{background:rgba(16,185,129,.12);color:var(--green);border:1px solid rgba(16,185,129,.2);}
.b-warn{background:rgba(245,158,11,.1);color:var(--orange);border:1px solid rgba(245,158,11,.2);}
.b-err{background:rgba(239,68,68,.1);color:var(--red);border:1px solid rgba(239,68,68,.2);}
.b-info{background:rgba(34,211,238,.1);color:var(--cyan);border:1px solid rgba(34,211,238,.2);}
.terminal{background:#020408;border:1px solid var(--border2);border-radius:10px;
  padding:14px;font-family:var(--mono);font-size:12px;line-height:1.8;
  max-height:200px;overflow-y:auto;margin-bottom:14px;}
.terminal::-webkit-scrollbar{width:3px;}
.terminal::-webkit-scrollbar-thumb{background:var(--bg4);}
.tline{display:flex;gap:10px;}
.tt{color:var(--muted);flex-shrink:0;}
.tok{color:var(--green);}
.terr{color:var(--red);}
.tinfo{color:var(--cyan);}
.twarn{color:var(--orange);}
.tmut{color:var(--muted);}
.cur2{display:inline-block;width:7px;height:12px;background:var(--cyan);animation:blink .8s step-end infinite;}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
.sp{width:14px;height:14px;border:2px solid var(--border2);border-top-color:var(--cyan);
  border-radius:50%;animation:spin .65s linear infinite;flex-shrink:0;}
@keyframes spin{to{transform:rotate(360deg)}}
.err-box{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:9px;
  padding:12px 14px;font-size:12px;font-family:var(--mono);color:var(--red);margin-bottom:14px;}
.info-box{background:rgba(34,211,238,.06);border:1px solid rgba(34,211,238,.15);border-radius:9px;
  padding:12px 14px;font-size:12px;font-family:var(--mono);color:var(--cyan);margin-bottom:14px;line-height:1.7;}
.warn-box{background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.15);border-radius:9px;
  padding:12px 14px;font-size:12px;font-family:var(--mono);color:var(--orange);margin-bottom:14px;line-height:1.7;}
.sdiv{display:flex;align-items:center;gap:12px;margin:18px 0 12px;}
.sdiv-line{flex:1;height:1px;background:var(--border);}
.sdiv-label{font-size:10px;font-family:var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.1em;}
.cgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:7px;margin-bottom:14px;}
.cbtn{background:var(--bg3);border:1.5px solid var(--border);border-radius:9px;padding:11px 8px;
  cursor:pointer;transition:all .15s;text-align:center;display:flex;flex-direction:column;align-items:center;gap:5px;}
.cbtn:hover{border-color:var(--border2);transform:translateY(-2px);}
.cbtn.on{border-width:2px;}
.cicon{width:34px;height:22px;border-radius:4px;display:flex;align-items:center;
  justify-content:center;font-size:8px;font-weight:700;font-family:var(--mono);}
.cname{font-size:9px;font-weight:600;color:var(--text);text-align:center;line-height:1.3;}
.cgen{font-size:9px;font-family:var(--mono);color:var(--muted);}
.gen-label{font-size:10px;font-family:var(--mono);color:var(--muted);text-transform:uppercase;
  letter-spacing:.1em;margin:12px 0 6px;padding-bottom:5px;border-bottom:1px solid var(--border);}
.nc{background:var(--card);border:1px solid var(--border);border-radius:11px;padding:14px 16px;
  margin-bottom:9px;display:flex;align-items:center;gap:12px;}
.nc.on{border-left:3px solid var(--green);}
.nc.off{border-left:3px solid var(--red);opacity:.6;}
.nc-name{font-size:13px;font-weight:600;margin-bottom:2px;}
.nc-meta{font-size:11px;font-family:var(--mono);color:var(--muted);}
.scroll{max-height:320px;overflow-y:auto;padding-right:3px;}
.scroll::-webkit-scrollbar{width:3px;}
.scroll::-webkit-scrollbar-thumb{background:var(--bg4);}
.welcome-hero{text-align:center;padding:16px 0 28px;}
.w-hex{width:64px;height:64px;background:var(--cyan);margin:0 auto 18px;
  clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);
  display:flex;align-items:center;justify-content:center;font-size:24px;}
.checklist{display:flex;flex-direction:column;gap:7px;margin:20px 0;}
.cli{display:flex;align-items:flex-start;gap:11px;padding:12px 14px;
  background:var(--card);border:1px solid var(--border);border-radius:9px;}
.cli-icon{font-size:16px;flex-shrink:0;margin-top:1px;}
.cli-title{font-size:13px;font-weight:600;margin-bottom:2px;}
.cli-desc{font-size:11px;font-family:var(--mono);color:var(--muted);line-height:1.5;}
.cfg-section{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px 22px;margin-bottom:14px;}
.cfg-title{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:16px;}
.ip-row{display:flex;align-items:center;gap:8px;}
.ip-detected{font-size:11px;font-family:var(--mono);color:var(--green);display:flex;align-items:center;gap:6px;}
.secret-row{display:flex;align-items:center;gap:8px;}
.secret-val{flex:1;font-family:var(--mono);font-size:12px;background:var(--bg3);
  border:1px solid var(--border2);border-radius:7px;padding:9px 12px;color:var(--text2);
  word-break:break-all;line-height:1.5;}
.tag{font-size:10px;font-family:var(--mono);padding:2px 7px;border-radius:3px;
  background:var(--bg3);color:var(--text2);}
.tag-row{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px;}
.sum-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-bottom:22px;}
.sum{background:var(--card);border:1px solid var(--border);border-radius:11px;padding:16px 18px;}
.sum-n{font-size:32px;font-weight:700;font-family:var(--mono);line-height:1;}
.sum-l{font-size:10px;font-family:var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-top:4px;}
.install-cmd{background:#020408;border:1px solid var(--border2);border-radius:9px;
  padding:12px 14px;font-family:var(--mono);font-size:12px;color:var(--cyan);
  display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 0;}
.copy-btn{background:var(--bg3);border:1px solid var(--border2);color:var(--muted);
  border-radius:5px;padding:4px 9px;font-family:var(--mono);font-size:10px;cursor:pointer;flex-shrink:0;transition:all .15s;}
.copy-btn:hover{border-color:var(--cyan);color:var(--cyan);}
`;

function useLog() {
  const [lines, setLines] = useState([]);
  const ref = useRef(null);
  const add = useCallback((msg, type = "info") => {
    const time = new Date().toLocaleTimeString("en",{hour12:false,hour:"2-digit",minute:"2-digit",second:"2-digit"});
    setLines(l => [...l, { msg, type, time, id: Date.now()+Math.random() }]);
    setTimeout(() => ref.current?.scrollTo(0, ref.current.scrollHeight), 30);
  }, []);
  const clear = () => setLines([]);
  return { lines, add, clear, ref };
}

function Terminal({ lines, logRef }) {
  return (
    <div className="terminal" ref={logRef}>
      {lines.map(l => (
        <div key={l.id} className="tline">
          <span className="tt">{l.time}</span>
          <span className={`t${l.type}`}>{l.msg}</span>
        </div>
      ))}
      {lines.length > 0 && <div className="tline"><span className="tt"/><span><span className="cur2"/></span></div>}
    </div>
  );
}

function CopyCmd({ cmd }) {
  const [c, setC] = useState(false);
  return (
    <div className="install-cmd">
      <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>$ {cmd}</span>
      <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(cmd); setC(true); setTimeout(()=>setC(false),2000); }}>
        {c ? "✓ Copied" : "Copy"}
      </button>
    </div>
  );
}

// ── Step 1: Welcome ──────────────────────────────────────
function StepWelcome({ onNext }) {
  return (
    <>
      <div className="welcome-hero">
        <div className="w-hex">🎮</div>
        <div style={{fontSize:28,fontWeight:700,marginBottom:8}}>Welcome to CyanGame</div>
        <div style={{fontSize:14,color:"var(--text2)",fontWeight:300,maxWidth:460,margin:"0 auto",lineHeight:1.6}}>
          Self-hosted game streaming for your home. Real hardware or emulation, NES to PS5.
        </div>
      </div>
      <div className="sdiv"><div className="sdiv-line"/><span className="sdiv-label">This wizard sets up</span><div className="sdiv-line"/></div>
      <div className="checklist">
        {[
          ["⚙","Server config","NAS IP, ROM path, auto-generated secrets — all in the browser"],
          ["📡","Capture nodes","Wyse 3040s that sit next to your consoles"],
          ["🎮","Consoles","Every console from NES to PS5"],
          ["💾","ROM library","Auto-scan your NAS ROM folder"],
          ["📋","Game library","Titles for each console"],
        ].map(([icon,title,desc]) => (
          <div key={title} className="cli">
            <div className="cli-icon">{icon}</div>
            <div><div className="cli-title">{title}</div><div className="cli-desc">{desc}</div></div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
        <button className="btn btn-primary" onClick={onNext}>Get Started →</button>
      </div>
    </>
  );
}

// ── Step 2: Configure (NEW — no .env editing needed) ─────
function StepConfigure({ data, setData, onNext, onBack }) {
  const SERVER_URL = window.location.origin; // already running here
  const [nasIp, setNasIp]       = useState(data.nasIp || "");
  const [romPath, setRomPath]   = useState(data.romPath || "/mnt/user/roms");
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [secrets, setSecrets]   = useState(data.secrets || null);
  const [err, setErr]           = useState(null);
  const [saved, setSaved]       = useState(false);

  // Auto-detect server IP on load
  useEffect(() => {
    setDetecting(true);
    fetch(`${SERVER_URL}/api/setup/detect-ip`)
      .then(r => r.json())
      .then(j => { if (j.primary && !nasIp) setNasIp(j.primary); })
      .catch(() => {})
      .finally(() => setDetecting(false));

    // Also load any existing env values
    fetch(`${SERVER_URL}/api/setup/env`)
      .then(r => r.json())
      .then(j => {
        if (j.nasIp)   setNasIp(j.nasIp);
        if (j.romPath) setRomPath(j.romPath);
        if (j.hasSecrets) setSecrets({ exists: true });
      })
      .catch(() => {});
  }, []);

  const genSecrets = () => {
    const rand = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n))).map(b => b.toString(16).padStart(2,'0')).join('');
    const s = { jwt: rand(32), turn: rand(16) };
    setSecrets(s);
    return s;
  };

  const save = async () => {
    if (!nasIp) return setErr("NAS IP is required");
    setSaving(true); setErr(null);
    try {
      const s = secrets?.jwt ? secrets : genSecrets();
      const result = await fetch(`${SERVER_URL}/api/setup/configure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nasIp, romPath, regenerateSecrets: false }),
      }).then(r => r.json());

      if (result.error) throw new Error(result.error);
      setServer(SERVER_URL);
      setData(d => ({ ...d, nasIp, romPath, secrets: s, serverUrl: SERVER_URL }));
      setSaved(true);
    } catch(e) { setErr(String(e)); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="info-box">
        All configuration is saved directly by the server — no terminal, no file editing needed.
      </div>
      {err && <div className="err-box">✗ {err}</div>}

      <div className="cfg-section">
        <div className="cfg-title">Server</div>

        <div className="field">
          <label>NAS / Unraid IP Address</label>
          <div className="ip-row">
            <input value={nasIp} onChange={e => setNasIp(e.target.value)}
              placeholder="192.168.1.100" style={{flex:1}}/>
            {detecting && <div className="sp"/>}
            {nasIp && !detecting && <span className="ip-detected"><span className="dot on"/>Auto-detected</span>}
          </div>
          <div className="hint">The IP of the machine running this Docker stack. Used by Wyse nodes to push streams.</div>
        </div>

        <div className="field" style={{marginBottom:0}}>
          <label>ROM Folder Path</label>
          <input value={romPath} onChange={e => setRomPath(e.target.value)}
            placeholder="/mnt/user/roms"/>
          <div className="hint">
            Where your ROM files live on Unraid. Common paths:<br/>
            <code style={{color:"var(--cyan)"}}>/mnt/user/roms</code> · <code style={{color:"var(--cyan)"}}>/mnt/user/Media/ROMs</code> · <code style={{color:"var(--cyan)"}}>/mnt/user/Games</code>
          </div>
        </div>
      </div>

      <div className="cfg-section">
        <div className="cfg-title">Security Keys</div>
        <div style={{fontSize:12,fontFamily:"var(--mono)",color:"var(--muted)",marginBottom:14,lineHeight:1.6}}>
          These are auto-generated and saved to the server. You never need to see or copy them.
        </div>

        {secrets?.jwt ? (
          <>
            <div className="field">
              <label>JWT Secret</label>
              <div className="secret-val">{secrets.jwt.slice(0,16)}••••••••••••••••••••••••••••••••••••••••••••••••</div>
            </div>
            <div className="field" style={{marginBottom:0}}>
              <label>TURN Password</label>
              <div className="secret-val">{secrets.turn.slice(0,8)}••••••••••••••••••••••••••••</div>
            </div>
          </>
        ) : secrets?.exists ? (
          <div className="row">
            <span className="dot on"/>
            <span style={{fontSize:12,fontFamily:"var(--mono)",color:"var(--green)"}}>Secrets already configured</span>
            <button className="btn btn-ghost btn-sm" style={{marginLeft:"auto"}} onClick={genSecrets}>Regenerate</button>
          </div>
        ) : (
          <div className="row">
            <span style={{fontSize:12,fontFamily:"var(--mono)",color:"var(--muted)"}}>Will be auto-generated when you save</span>
          </div>
        )}
      </div>

      <div style={{display:"flex",gap:9,alignItems:"center"}}>
        <button className="btn btn-primary" onClick={save} disabled={saving||!nasIp}>
          {saving ? <><div className="sp"/>Saving…</> : saved ? "✓ Saved — Continue" : "Save Configuration"}
        </button>
        {saved && <span style={{fontSize:12,fontFamily:"var(--mono)",color:"var(--green)"}}>Configuration written to server</span>}
      </div>

      <div style={{display:"flex",gap:9,marginTop:20}}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <div style={{flex:1}}/>
        <button className="btn btn-primary" onClick={onNext} disabled={!saved && !secrets?.exists}>Continue →</button>
      </div>
    </>
  );
}

// ── Step 3: Connect (verify server is up) ────────────────
function StepConnect({ data, setData, onNext, onBack }) {
  const SERVER_URL = data.serverUrl || window.location.origin;
  const [status, setStatus] = useState(null);
  const log = useLog();

  const test = async () => {
    setStatus("testing"); log.clear();
    log.add("Connecting to " + SERVER_URL, "info");
    try {
      await fetch(`${SERVER_URL}/api/health`).then(r => { if(!r.ok) throw new Error("HTTP "+r.status); });
      log.add("✓ Server is online", "ok");
      const nodes = await fetch(`${SERVER_URL}/api/nodes`).then(r=>r.json());
      log.add(`✓ ${nodes.length} node(s) registered`, "ok");
      setStatus("ok");
      setData(d => ({ ...d, serverNodes: nodes }));
    } catch(e) {
      log.add("✗ " + e.message, "err");
      setStatus("err");
    }
  };

  useEffect(() => { test(); }, []);

  return (
    <>
      <Terminal lines={log.lines} logRef={log.ref}/>

      <div className="card">
        <div className="row" style={{marginBottom:10}}>
          {status==="testing" && <><div className="sp"/><span style={{fontSize:13,color:"var(--text2)"}}>Connecting to server…</span></>}
          {status==="ok"      && <><span className="dot on"/><span style={{fontSize:13,color:"var(--green)"}}>Server online at {SERVER_URL}</span></>}
          {status==="err"     && <><span className="dot off"/><span style={{fontSize:13,color:"var(--red)"}}>Cannot reach server</span></>}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={test}>⟳ Retry</button>
      </div>

      {status==="err" && (
        <div className="warn-box">
          Make sure the Docker stack is running:<br/>
          <code style={{color:"var(--cyan)"}}>cd /mnt/user/appdata/cyangame/server && docker compose up -d</code>
        </div>
      )}

      <div style={{display:"flex",gap:9,marginTop:20}}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <div style={{flex:1}}/>
        <button className="btn btn-primary" onClick={onNext} disabled={status!=="ok"}>Continue →</button>
      </div>
    </>
  );
}

// ── Step 4: Nodes ────────────────────────────────────────
function StepNodes({ data, setData, onNext, onBack }) {
  const SERVER = data.serverUrl || window.location.origin;
  const [nodes, setNodes] = useState(data.serverNodes || []);
  const [loading, setLoading] = useState(false);
  const log = useLog();

  const refresh = async () => {
    setLoading(true); log.clear();
    log.add("Scanning for registered nodes…", "info");
    try {
      const n = await fetch(`${SERVER}/api/nodes`).then(r=>r.json());
      setNodes(n); setData(d=>({...d, serverNodes:n}));
      log.add(`Found ${n.length} node(s)`, n.length>0?"ok":"warn");
      n.forEach(nd => log.add(`  ${nd.status==="online"?"✓":"✗"} ${nd.name} — ${nd.ip}`, nd.status==="online"?"ok":"err"));
    } catch(e) { log.add("✗ "+e.message,"err"); }
    finally { setLoading(false); }
  };

  const online = nodes.filter(n=>n.status==="online").length;

  return (
    <>
      <div className="row" style={{marginBottom:14}}>
        <span style={{fontSize:12,fontFamily:"var(--mono)",color:"var(--muted)"}}>{nodes.length} registered · {online} online</span>
        <button className="btn btn-ghost btn-sm" style={{marginLeft:"auto"}} onClick={refresh} disabled={loading}>
          {loading?<><div className="sp"/>Scanning…</>:"⟳ Refresh"}
        </button>
      </div>

      {nodes.length>0 && (
        <div className="scroll" style={{marginBottom:14}}>
          {nodes.map(n=>(
            <div key={n.id} className={`nc ${n.status}`}>
              <span className={`dot ${n.status==="online"?"on":"off"}`}/>
              <div style={{flex:1}}>
                <div className="nc-name">{n.name}</div>
                <div className="nc-meta">{n.ip} · {n.os||"linux"} · {n.id}</div>
              </div>
              <span className={`badge ${n.status==="online"?"b-ok":"b-err"}`}>{n.status}</span>
            </div>
          ))}
        </div>
      )}

      {log.lines.length>0 && <Terminal lines={log.lines} logRef={log.ref}/>}

      <div className="sdiv"><div className="sdiv-line"/><span className="sdiv-label">Don't see your node?</span><div className="sdiv-line"/></div>
      <div style={{fontSize:12,fontFamily:"var(--mono)",color:"var(--text2)",marginBottom:8,lineHeight:1.6}}>Run on each Wyse 3040 (as root):</div>
      <CopyCmd cmd="curl -fsSL https://raw.githubusercontent.com/Shamuoo/CyanGame/main/install-node.sh | bash"/>
      <div style={{fontSize:11,fontFamily:"var(--mono)",color:"var(--muted)",marginTop:6}}>Node appears automatically within 30 seconds of install.</div>

      <div style={{display:"flex",gap:9,marginTop:20}}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <div style={{flex:1}}/>
        <button className="btn btn-primary" onClick={onNext}>{online>0?"Continue →":"Skip for now →"}</button>
      </div>
    </>
  );
}

// ── Step 5: Consoles ─────────────────────────────────────
function StepConsoles({ data, setData, onNext, onBack }) {
  const SERVER = data.serverUrl || window.location.origin;
  const nodes = (data.serverNodes||[]).filter(n=>n.status==="online");
  const [consoles, setConsoles] = useState(data.addedConsoles||[]);
  const [selNode, setSelNode] = useState(nodes[0]?.id||"");
  const [selType, setSelType] = useState(null);
  const [name, setName] = useState("");
  const [dev, setDev] = useState("video0");
  const [res, setRes] = useState("1080p");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const gens = [...new Set(CONSOLE_TYPES.map(c=>c.gen))];

  const pick = ct => { setSelType(ct); setName(ct.name); setRes(ct.capture==="4K"?"4k":ct.capture==="480p"||ct.capture==="240p"?"720p":"1080p"); };

  const add = async () => {
    if (!selType||!selNode||!name) return;
    setSaving(true); setErr(null);
    try {
      const c = await fetch(`${SERVER}/api/consoles`,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({nodeId:selNode,name,type:selType.id,captureDevice:dev,resolution:res,launchConfig:{}})
      }).then(r=>r.json());
      if (c.error) throw new Error(c.error);
      const updated = [...consoles, c];
      setConsoles(updated); setData(d=>({...d,addedConsoles:updated}));
      setSelType(null); setName(""); setDev("video0");
    } catch(e){setErr(String(e));}
    finally{setSaving(false);}
  };

  const remove = async id => {
    await fetch(`${SERVER}/api/consoles/${id}`,{method:"DELETE"}).catch(()=>{});
    const updated = consoles.filter(c=>c.id!==id);
    setConsoles(updated); setData(d=>({...d,addedConsoles:updated}));
  };

  if (nodes.length===0) return (
    <>
      <div className="warn-box">No online nodes. Go back and install the node agent on a Wyse 3040 first.</div>
      <div style={{display:"flex",gap:9,marginTop:20}}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <div style={{flex:1}}/>
        <button className="btn btn-primary" onClick={onNext}>Skip →</button>
      </div>
    </>
  );

  return (
    <>
      {err && <div className="err-box">✗ {err}</div>}

      {consoles.length>0 && (
        <>
          <div className="sdiv"><div className="sdiv-line"/><span className="sdiv-label">Added ({consoles.length})</span><div className="sdiv-line"/></div>
          {consoles.map(c=>{
            const ct=CONSOLE_TYPES.find(t=>t.id===c.type)||{};
            return (
              <div key={c.id} className="nc on" style={{borderLeftColor:ct.color||"var(--border2)"}}>
                <div className="cicon" style={{width:34,height:22,background:(ct.color||"#333")+"22",color:ct.color,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,fontFamily:"var(--mono)"}}>
                  {ct.icon||"?"}
                </div>
                <div style={{flex:1}}>
                  <div className="nc-name">{c.name}</div>
                  <div className="nc-meta">{ct.name} · /dev/{c.capture_device} · {c.resolution}</div>
                </div>
                <button className="btn btn-danger" style={{padding:"4px 10px",fontSize:10,borderRadius:6}} onClick={()=>remove(c.id)}>Remove</button>
              </div>
            );
          })}
        </>
      )}

      <div className="sdiv"><div className="sdiv-line"/><span className="sdiv-label">Add Console</span><div className="sdiv-line"/></div>

      {nodes.length>1 && (
        <div className="field">
          <label>Assign to Node</label>
          <select value={selNode} onChange={e=>setSelNode(e.target.value)}>
            {nodes.map(n=><option key={n.id} value={n.id}>{n.name} ({n.ip})</option>)}
          </select>
        </div>
      )}

      <div className="field">
        <label>Console Type</label>
        <div className="scroll" style={{maxHeight:260}}>
          {gens.map(gen=>(
            <div key={gen}>
              <div className="gen-label">{gen}</div>
              <div className="cgrid">
                {CONSOLE_TYPES.filter(c=>c.gen===gen).map(ct=>(
                  <div key={ct.id} className={`cbtn${selType?.id===ct.id?" on":""}`}
                    style={selType?.id===ct.id?{borderColor:ct.color,boxShadow:`0 0 10px ${ct.color}44`}:{}}
                    onClick={()=>pick(ct)}>
                    <div className="cicon" style={{background:ct.color+"22",color:ct.color}}>{ct.icon}</div>
                    <div className="cname">{ct.name}</div>
                    <div className="cgen">{ct.capture}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selType && (
        <div className="card hi" style={{borderColor:selType.color+"44"}}>
          {selType.hdcp && <div className="warn-box" style={{marginBottom:12}}>⚠ Disable HDCP in console Settings → HDMI before capturing.</div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            <div className="field" style={{marginBottom:0}}>
              <label>Display Name</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder={selType.name}/>
            </div>
            <div className="field" style={{marginBottom:0}}>
              <label>Capture Device</label>
              <input value={dev} onChange={e=>setDev(e.target.value)} placeholder="video0"/>
              <div className="hint">v4l2-ctl --list-devices on node</div>
            </div>
            <div className="field" style={{marginBottom:0}}>
              <label>Resolution</label>
              <select value={res} onChange={e=>setRes(e.target.value)}>
                <option value="720p">720p</option><option value="1080p">1080p</option><option value="4k">4K</option>
              </select>
            </div>
          </div>
          <div style={{marginTop:14,display:"flex",gap:9}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>setSelType(null)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={add} disabled={saving||!name}>
              {saving?<><div className="sp"/>Adding…</>:`Add ${name}`}
            </button>
          </div>
        </div>
      )}

      <div style={{display:"flex",gap:9,marginTop:20}}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <div style={{flex:1}}/>
        <button className="btn btn-primary" onClick={onNext}>
          {consoles.length>0?`Continue with ${consoles.length} console${consoles.length!==1?"s":""}  →`:"Skip →"}
        </button>
      </div>
    </>
  );
}

// ── Step 6: ROM Folder ───────────────────────────────────
function StepRomFolder({ data, setData, onNext, onBack }) {
  const SERVER = data.serverUrl || window.location.origin;
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(data.scanResult||null);
  const [err, setErr] = useState(null);
  const log = useLog();

  const scan = async () => {
    setScanning(true); setResult(null); setErr(null); log.clear();
    log.add("Scanning " + data.romPath + " for ROMs…", "info");
    try {
      const r = await fetch(`${SERVER}/api/roms/scan`,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"}).then(r2=>r2.json());
      if (r.error) throw new Error(r.error);
      log.add(`✓ ${r.added} new ROMs found`, "ok");
      (r.addedList||[]).reduce((acc,x)=>{acc[x.system]=(acc[x.system]||0)+1;return acc;},{});
      const bySys = {};
      (r.addedList||[]).forEach(x=>{bySys[x.system]=(bySys[x.system]||0)+1;});
      Object.entries(bySys).forEach(([s,n])=>log.add(`  ${s}: ${n} ROMs`,"info"));
      if (r.skipped>0) log.add(`  ${r.skipped} already indexed (skipped)`,"muted");
      setResult(r); setData(d=>({...d,scanResult:r}));
    } catch(e){
      log.add("✗ "+String(e),"err");
      log.add("Make sure ROM_PATH in server config matches your Unraid folder","warn");
      setErr(String(e));
    }
    finally{setScanning(false);}
  };

  return (
    <>
      <div className="info-box">
        ROM path is already set to: <strong style={{color:"var(--cyan)"}}>{data.romPath||"/mnt/user/roms"}</strong><br/>
        Structure your ROMs like:<br/>
        <code>{data.romPath||"/mnt/user/roms"}/snes/ChronoTrigger.sfc</code><br/>
        <code>{data.romPath||"/mnt/user/roms"}/ps2/ShadowOfColossus.iso</code>
      </div>

      <div style={{display:"flex",gap:10,marginBottom:14}}>
        <button className="btn btn-primary btn-sm" onClick={scan} disabled={scanning}>
          {scanning?<><div className="sp"/>Scanning…</>:"⟳ Scan ROM Folder"}
        </button>
        {result && <span style={{fontSize:12,fontFamily:"var(--mono)",color:"var(--green)",display:"flex",alignItems:"center",gap:6}}><span className="dot on"/>{result.added} ROMs indexed</span>}
      </div>

      {log.lines.length>0 && <Terminal lines={log.lines} logRef={log.ref}/>}
      {err && <div className="err-box">✗ {err}</div>}

      <div style={{display:"flex",gap:9,marginTop:16}}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <div style={{flex:1}}/>
        <button className="btn btn-primary" onClick={onNext}>Continue →</button>
      </div>
    </>
  );
}

// ── Step 7: Games ────────────────────────────────────────
function StepGames({ data, setData, onNext, onBack }) {
  const SERVER = data.serverUrl || window.location.origin;
  const consoles = data.addedConsoles||[];
  const [selConsole, setSelConsole] = useState(consoles[0]?.id||"");
  const [bulk, setBulk] = useState("");
  const [games, setGames] = useState(data.addedGames||{});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(null);

  const addGames = async () => {
    const titles = bulk.split("\n").map(t=>t.trim()).filter(Boolean);
    if (!titles.length||!selConsole) return;
    setSaving(true); setErr(null);
    try {
      const r = await fetch(`${SERVER}/api/games/bulk`,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({consoleId:selConsole,games:titles.map(t=>({title:t}))})
      }).then(r2=>r2.json());
      if (r.error) throw new Error(r.error);
      const updated = {...games,[selConsole]:[...(games[selConsole]||[]),...titles]};
      setGames(updated); setData(d=>({...d,addedGames:updated}));
      setBulk(""); setSaved(true); setTimeout(()=>setSaved(false),2000);
    } catch(e){setErr(String(e));}
    finally{setSaving(false);}
  };

  const total = Object.values(games).flat().length;
  const sel = consoles.find(c=>c.id===selConsole);
  const ct = sel ? CONSOLE_TYPES.find(t=>t.id===sel.type) : null;

  return (
    <>
      {consoles.length===0 ? (
        <div className="warn-box">No consoles configured. You can add games from the main portal once consoles are set up.</div>
      ) : (
        <>
          <div className="field">
            <label>Select Console</label>
            <select value={selConsole} onChange={e=>{setSelConsole(e.target.value);setSaved(false);}}>
              {consoles.map(c=>{const t=CONSOLE_TYPES.find(x=>x.id===c.type);return<option key={c.id} value={c.id}>{t?.name||c.type} — {c.name} ({games[c.id]?.length||0} games)</option>;})}
            </select>
          </div>

          {sel && (
            <div className="card" style={{borderLeft:"3px solid "+(ct?.color||"var(--border2)"),marginBottom:14}}>
              <div className="field" style={{marginBottom:8}}>
                <label>Game Titles — one per line</label>
                <textarea rows={5} value={bulk} onChange={e=>setBulk(e.target.value)}
                  placeholder={"Halo Infinite\nForza Horizon 5\nPsychonauts 2"}
                  style={{resize:"vertical",fontFamily:"var(--mono)",fontSize:12}}/>
                <div className="hint">Paste a list. Cover art and launch IDs can be added later from the portal.</div>
              </div>
              {err && <div className="err-box">✗ {err}</div>}
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <button className="btn btn-primary btn-sm" onClick={addGames} disabled={saving||!bulk.trim()}>
                  {saving?<><div className="sp"/>Adding…</>:"Add Games"}
                </button>
                {saved && <span style={{fontSize:12,fontFamily:"var(--mono)",color:"var(--green)"}}>✓ Saved</span>}
              </div>
            </div>
          )}

          {Object.keys(games).length>0 && (
            <>
              <div className="sdiv"><div className="sdiv-line"/><span className="sdiv-label">Added ({total} games)</span><div className="sdiv-line"/></div>
              {consoles.map(c=>{
                const glist=games[c.id]||[]; if(!glist.length) return null;
                const t=CONSOLE_TYPES.find(x=>x.id===c.type);
                return (
                  <div key={c.id} className="card" style={{marginBottom:9}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:9}}>
                      <div style={{width:34,height:22,background:(t?.color||"#333")+"22",color:t?.color,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,fontFamily:"var(--mono)"}}>{t?.icon||"?"}</div>
                      <span style={{fontSize:13,fontWeight:600}}>{c.name}</span>
                      <span className="badge b-info" style={{marginLeft:"auto"}}>{glist.length}</span>
                    </div>
                    <div className="tag-row">{glist.slice(0,10).map((g,i)=><span key={i} className="tag">{g}</span>)}
                      {glist.length>10&&<span className="tag">+{glist.length-10} more</span>}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}

      <div style={{display:"flex",gap:9,marginTop:20}}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <div style={{flex:1}}/>
        <button className="btn btn-primary" onClick={onNext}>{total>0?`Continue with ${total} games →`:"Skip →"}</button>
      </div>
    </>
  );
}

// ── Step 8: Done ─────────────────────────────────────────
function StepDone({ data, onFinish }) {
  const online = (data.serverNodes||[]).filter(n=>n.status==="online").length;
  const consoles = (data.addedConsoles||[]).length;
  const games = Object.values(data.addedGames||{}).flat().length;
  const roms = data.scanResult?.added||0;
  return (
    <>
      <div style={{textAlign:"center",padding:"20px 0 28px"}}>
        <div style={{fontSize:44,marginBottom:14}}>🎉</div>
        <div style={{fontSize:22,fontWeight:700,marginBottom:6}}>CyanGame is ready</div>
        <div style={{fontSize:13,color:"var(--text2)",fontWeight:300}}>Everything is configured. Time to play.</div>
      </div>
      <div className="sum-grid">
        <div className="sum"><div className="sum-n" style={{color:"var(--green)"}}>{online}</div><div className="sum-l">Online Nodes</div></div>
        <div className="sum"><div className="sum-n" style={{color:"var(--cyan)"}}>{consoles}</div><div className="sum-l">Consoles</div></div>
        <div className="sum"><div className="sum-n" style={{color:"var(--orange)"}}>{games}</div><div className="sum-l">Games</div></div>
        <div className="sum"><div className="sum-n" style={{color:"var(--purple)"}}>{roms}</div><div className="sum-l">ROMs Indexed</div></div>
      </div>
      <div className="sdiv"><div className="sdiv-line"/><span className="sdiv-label">What's next</span><div className="sdiv-line"/></div>
      <div className="checklist">
        {[["🎮","Open the portal","Browse games and start streaming"],["🖼","Add cover art","IGDB auto-fetch in v0.3 — or paste URLs now"],["🆔","Set launch IDs","PS3 title IDs + Xbox IDs for auto-launch"],["🎮","Controller support","Coming in v0.4"]].map(([i,t,d])=>(
          <div key={t} className="cli"><div className="cli-icon">{i}</div><div><div className="cli-title">{t}</div><div className="cli-desc">{d}</div></div></div>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"center",marginTop:24}}>
        <button className="btn btn-primary" style={{fontSize:14,padding:"13px 32px"}} onClick={onFinish}>Open CyanGame →</button>
      </div>
    </>
  );
}

// ── Main Wizard ──────────────────────────────────────────
export default function CyanGameWizard({ onComplete }) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(new Set());
  const [wdata, setWdata] = useState({});
  const bodyRef = useRef(null);

  const next = useCallback(() => {
    setDone(s=>new Set([...s, STEPS[idx].id]));
    setIdx(i=>Math.min(i+1, STEPS.length-1));
    bodyRef.current?.scrollTo(0,0);
  }, [idx]);

  const back = useCallback(() => { setIdx(i=>Math.max(i-1,0)); bodyRef.current?.scrollTo(0,0); }, []);

  const goTo = useCallback(i => {
    if (i<idx || done.has(STEPS[i].id)) { setIdx(i); bodyRef.current?.scrollTo(0,0); }
  }, [idx, done]);

  const cur = STEPS[idx];
  const props = { data:wdata, setData:setWdata, onNext:next, onBack:back };

  const COMPS = {
    welcome:   <StepWelcome   onNext={next}/>,
    configure: <StepConfigure {...props}/>,
    connect:   <StepConnect   {...props}/>,
    nodes:     <StepNodes     {...props}/>,
    consoles:  <StepConsoles  {...props}/>,
    romfolder: <StepRomFolder {...props}/>,
    games:     <StepGames     {...props}/>,
    done:      <StepDone      data={wdata} onFinish={onComplete||(() => window.location.href="/")}/>,
  };

  const subFor = s => {
    if (!done.has(s.id)) return null;
    if (s.id==="configure") return wdata.nasIp;
    if (s.id==="nodes")     return `${(wdata.serverNodes||[]).filter(n=>n.status==="online").length} online`;
    if (s.id==="consoles")  return `${(wdata.addedConsoles||[]).length} added`;
    if (s.id==="romfolder") return `${wdata.scanResult?.added||0} ROMs`;
    if (s.id==="games")     return `${Object.values(wdata.addedGames||{}).flat().length} games`;
    return null;
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="wizard">
        <div className="sidebar">
          <div className="s-logo"><div className="s-hex"/><span className="s-name">CyanGame</span></div>
          <div className="step-list">
            {STEPS.map((s,i)=>{
              const isDone=done.has(s.id), isCur=i===idx, isLock=i>idx&&!done.has(s.id);
              const sub = subFor(s);
              return (
                <div key={s.id} className={`si${isCur?" cur":""}${isDone?" done":""}${isLock?" lock":""}${isDone||i<=idx?" click":""}`}
                  onClick={()=>(isDone||i<=idx)&&goTo(i)}>
                  <div className="sn">{isDone?"✓":i+1}</div>
                  <div>
                    <div className="sl">{s.label}</div>
                    {sub && <div style={{fontSize:10,fontFamily:"var(--mono)",color:"var(--green)",marginTop:2,opacity:.8}}>{sub}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="s-foot">Setup Wizard · v0.2</div>
        </div>

        <div className="panel">
          <div className="phead">
            <div className="prog">
              {STEPS.map((s,i)=>(
                <div key={s.id} className={`ps${i<idx||done.has(s.id)?" done":i===idx?" cur":""}`}/>
              ))}
            </div>
            <div className="ptitle">{
              cur.id==="welcome"   ?"Welcome to CyanGame":
              cur.id==="configure" ?"Configure your server":
              cur.id==="connect"   ?"Verify connection":
              cur.id==="nodes"     ?"Set up capture nodes":
              cur.id==="consoles"  ?"Add your consoles":
              cur.id==="romfolder" ?"Scan ROM library":
              cur.id==="games"     ?"Build your game library":
              "You're all set"
            }</div>
            <div className="psub">{
              cur.id==="welcome"   ?"Takes about 5 minutes. No terminal required.":
              cur.id==="configure" ?"Set your NAS IP and ROM path — secrets are auto-generated.":
              cur.id==="connect"   ?"Making sure the backend and stream router are online.":
              cur.id==="nodes"     ?"Nodes are the small devices that capture HDMI from each console.":
              cur.id==="consoles"  ?"Assign each physical console to a capture node.":
              cur.id==="romfolder" ?"CyanGame scans your folder and indexes every supported ROM automatically.":
              cur.id==="games"     ?"Add game titles to each console. Paste a list to bulk-import.":
              "CyanGame is configured and ready to stream."
            }</div>
          </div>

          <div className="pbody" ref={bodyRef}>
            {COMPS[cur.id]}
          </div>
        </div>
      </div>
    </>
  );
}
