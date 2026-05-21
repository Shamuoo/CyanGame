import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────────────────
//  CONFIG + API
// ─────────────────────────────────────────────────────────
function getServer() { return localStorage.getItem("ch_server") || "http://192.168.1.100:7000"; }
function setServer(u) { localStorage.setItem("ch_server", u.replace(/\/$/, "")); }
function api(path, opts = {}) {
  return fetch(`${getServer()}/api${path}`, {
    headers: { "Content-Type": "application/json" }, ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e.error || `HTTP ${r.status}`)));
}

// ─────────────────────────────────────────────────────────
//  DATA
// ─────────────────────────────────────────────────────────
const CONSOLE_TYPES = [
  // Modern
  { id:"ps5",       name:"PlayStation 5",    gen:"Modern",  color:"#0070D1", icon:"PS5", hdcp:true,  capture:"4K",   launch:"ps-remote"  },
  { id:"xboxseries",name:"Xbox Series X|S",  gen:"Modern",  color:"#107C10", icon:"XSX", hdcp:true,  capture:"4K",   launch:"smartglass" },
  { id:"switch",    name:"Nintendo Switch",   gen:"Modern",  color:"#E4000F", icon:"NSW", hdcp:false, capture:"1080p",launch:"usbip-nav"  },
  // 8th gen
  { id:"ps4",       name:"PlayStation 4",    gen:"8th Gen", color:"#003791", icon:"PS4", hdcp:true,  capture:"1080p",launch:"ps-remote"  },
  { id:"xbone",     name:"Xbox One",         gen:"8th Gen", color:"#107C10", icon:"XB1", hdcp:true,  capture:"1080p",launch:"smartglass" },
  { id:"wiiu",      name:"Wii U",            gen:"8th Gen", color:"#009AC7", icon:"WIU", hdcp:false, capture:"1080p",launch:"manual"     },
  // 7th gen
  { id:"ps3",       name:"PlayStation 3",    gen:"7th Gen", color:"#00439C", icon:"PS3", hdcp:true,  capture:"1080p",launch:"webman"     },
  { id:"xbox360",   name:"Xbox 360",         gen:"7th Gen", color:"#52B043", icon:"360", hdcp:false, capture:"1080p",launch:"manual"     },
  { id:"wii",       name:"Wii",              gen:"7th Gen", color:"#C0C0C0", icon:"WII", hdcp:false, capture:"480p", launch:"manual"     },
  // 6th gen
  { id:"ps2",       name:"PlayStation 2",    gen:"6th Gen", color:"#00439C", icon:"PS2", hdcp:false, capture:"480p", launch:"opl"        },
  { id:"gamecube",  name:"GameCube",         gen:"6th Gen", color:"#6A35BE", icon:"GCN", hdcp:false, capture:"480p", launch:"manual"     },
  { id:"xbox",      name:"Xbox (OG)",        gen:"6th Gen", color:"#52B043", icon:"XBX", hdcp:false, capture:"480p", launch:"manual"     },
  // Retro
  { id:"n64",       name:"Nintendo 64",      gen:"Retro",   color:"#009AC7", icon:"N64", hdcp:false, capture:"240p", launch:"manual"     },
  { id:"ps1",       name:"PlayStation",      gen:"Retro",   color:"#003087", icon:"PS1", hdcp:false, capture:"240p", launch:"manual"     },
  { id:"snes",      name:"Super Nintendo",   gen:"Retro",   color:"#7B2FBE", icon:"SNS", hdcp:false, capture:"240p", launch:"manual"     },
  { id:"genesis",   name:"Sega Genesis",     gen:"Retro",   color:"#1A6DD1", icon:"GEN", hdcp:false, capture:"240p", launch:"manual"     },
  { id:"nes",       name:"NES",              gen:"Retro",   color:"#E82C0C", icon:"NES", hdcp:false, capture:"240p", launch:"manual"     },
  { id:"gba",       name:"Game Boy Advance", gen:"Retro",   color:"#7B35A0", icon:"GBA", hdcp:false, capture:"240p", launch:"manual"     },
];

const EMULATORS = [
  { id:"emu-ra-nes",   name:"RetroArch",     systems:["nes"],            core:"fceumm",       binary:"retroarch",          target:"both",   status:"bundled" },
  { id:"emu-ra-snes",  name:"RetroArch",     systems:["snes"],           core:"snes9x",       binary:"retroarch",          target:"both",   status:"bundled" },
  { id:"emu-ra-gb",    name:"RetroArch",     systems:["gb","gbc"],       core:"gambatte",     binary:"retroarch",          target:"both",   status:"bundled" },
  { id:"emu-ra-gba",   name:"RetroArch",     systems:["gba"],            core:"mgba",         binary:"retroarch",          target:"both",   status:"bundled" },
  { id:"emu-ra-gen",   name:"RetroArch",     systems:["genesis"],        core:"genesis_plus_gx",binary:"retroarch",        target:"both",   status:"bundled" },
  { id:"emu-ra-n64",   name:"RetroArch",     systems:["n64"],            core:"mupen64plus_next",binary:"retroarch",       target:"both",   status:"bundled" },
  { id:"emu-ra-ps1",   name:"RetroArch",     systems:["ps1"],            core:"mednafen_psx", binary:"retroarch",          target:"both",   status:"bundled" },
  { id:"emu-ds",       name:"DuckStation",   systems:["ps1"],            core:null,           binary:"duckstation-nogui",  target:"server", status:"bundled", note:"Better PS1 compat" },
  { id:"emu-pcsx2",    name:"PCSX2",         systems:["ps2"],            core:null,           binary:"pcsx2",              target:"server", status:"bundled" },
  { id:"emu-dolphin",  name:"Dolphin",       systems:["gamecube","wii"], core:null,           binary:"dolphin-emu-nogui",  target:"server", status:"bundled" },
  { id:"emu-ryujinx",  name:"Ryujinx",       systems:["switch"],         core:null,           binary:"Ryujinx",            target:"server", status:"manual",  note:"Requires manual install" },
  { id:"emu-rpcs3",    name:"RPCS3",         systems:["ps3"],            core:null,           binary:"rpcs3",              target:"server", status:"manual",  note:"Requires manual install + PS3 firmware" },
  { id:"emu-xenia",    name:"Xenia",         systems:["xbox360"],        core:null,           binary:"xenia",              target:"server", status:"manual",  note:"Limited Linux support" },
];

const ROM_SYSTEMS = [
  { id:"nes",     name:"NES",              ext:[".nes"],                   icon:"🕹️" },
  { id:"snes",    name:"SNES",             ext:[".sfc",".smc"],            icon:"🎮" },
  { id:"gb",      name:"Game Boy",         ext:[".gb"],                    icon:"🎮" },
  { id:"gbc",     name:"Game Boy Color",   ext:[".gbc"],                   icon:"🎮" },
  { id:"gba",     name:"GBA",              ext:[".gba"],                   icon:"🎮" },
  { id:"n64",     name:"Nintendo 64",      ext:[".z64",".n64",".v64"],     icon:"🕹️" },
  { id:"genesis", name:"Sega Genesis",     ext:[".md",".bin",".gen"],      icon:"🕹️" },
  { id:"ps1",     name:"PlayStation",      ext:[".bin",".cue",".iso"],     icon:"💿" },
  { id:"ps2",     name:"PlayStation 2",    ext:[".iso",".bin"],            icon:"💿" },
  { id:"gamecube",name:"GameCube",         ext:[".iso",".gcm",".rvz"],     icon:"💿" },
  { id:"wii",     name:"Wii",              ext:[".iso",".wbfs",".rvz"],    icon:"💿" },
  { id:"nds",     name:"Nintendo DS",      ext:[".nds"],                   icon:"🎮" },
  { id:"switch",  name:"Switch",           ext:[".nsp",".xci"],            icon:"🃏" },
  { id:"ps3",     name:"PlayStation 3",    ext:[".iso",".pkg"],            icon:"💿" },
];

// ─────────────────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300&family=JetBrains+Mono:wght@400;500;600&display=swap');

*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#05080F;--bg2:#090E1A;--bg3:#0F1728;--bg4:#141E32;
  --card:#0C1422;--card2:#111B2E;
  --border:rgba(255,255,255,0.06);--border2:rgba(255,255,255,0.12);--border3:rgba(255,255,255,0.18);
  --cyan:#22D3EE;--cyan2:#0EA5E9;--purple:#A855F7;--green:#10B981;--orange:#F97316;--red:#EF4444;
  --text:#E2E8F0;--text2:#94A3B8;--muted:#475569;
  --font:'Chakra Petch',sans-serif;--mono:'JetBrains Mono',monospace;
  --glow-cyan:0 0 20px rgba(34,211,238,.15);
  --glow-purple:0 0 20px rgba(168,85,247,.15);
}
body{background:var(--bg);color:var(--text);font-family:var(--font);min-height:100vh;overflow-x:hidden;}

/* ── Wizard Shell ── */
.wizard{display:flex;min-height:100vh;position:relative;}

/* ── Background grid ── */
.wizard::before{
  content:'';position:fixed;inset:0;z-index:0;
  background-image:linear-gradient(rgba(34,211,238,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,.03) 1px,transparent 1px);
  background-size:40px 40px;
  mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 40%,transparent 100%);
}

/* ── Sidebar ── */
.sidebar{width:260px;flex-shrink:0;background:var(--bg2);border-right:1px solid var(--border);
  display:flex;flex-direction:column;padding:28px 0;position:sticky;top:0;height:100vh;z-index:10;}

.sidebar-logo{padding:0 24px 28px;border-bottom:1px solid var(--border);margin-bottom:24px;}
.s-logo{display:flex;align-items:center;gap:10px;}
.s-hex{width:30px;height:30px;background:var(--cyan);
  clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);flex-shrink:0;}
.s-name{font-size:15px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;}
.s-tagline{font-size:10px;font-family:var(--mono);color:var(--muted);margin-top:6px;line-height:1.5;}

.step-list{flex:1;padding:0 16px;display:flex;flex-direction:column;gap:3px;}

.step-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:9px;
  cursor:default;transition:all .2s;position:relative;}
.step-item.clickable{cursor:pointer;}
.step-item.clickable:hover{background:var(--bg3);}
.step-item.current{background:var(--bg3);box-shadow:inset 1px 0 0 var(--cyan);}
.step-item.done .step-num{background:var(--green);color:#000;border-color:var(--green);}
.step-item.current .step-num{border-color:var(--cyan);color:var(--cyan);box-shadow:0 0 10px rgba(34,211,238,.3);}
.step-item.locked{opacity:.4;}

.step-num{width:26px;height:26px;border-radius:50%;border:1.5px solid var(--border3);
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
  font-size:11px;font-weight:700;font-family:var(--mono);color:var(--muted);
  transition:all .2s;}
.step-check{font-size:12px;}
.step-info{flex:1;min-width:0;}
.step-label{font-size:12px;font-weight:600;letter-spacing:.03em;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.step-item.current .step-label{color:var(--text);}
.step-item:not(.current):not(.done) .step-label{color:var(--muted);}
.step-sub{font-size:10px;font-family:var(--mono);color:var(--muted);margin-top:2px;}
.step-item.done .step-sub{color:var(--green);opacity:.7;}

.sidebar-footer{padding:20px 24px 0;border-top:1px solid var(--border);margin-top:auto;}
.sf-version{font-size:10px;font-family:var(--mono);color:var(--muted);}

/* ── Main panel ── */
.panel{flex:1;display:flex;flex-direction:column;min-height:100vh;position:relative;z-index:1;}

.panel-header{padding:32px 48px 0;margin-bottom:36px;}
.step-progress{display:flex;gap:4px;margin-bottom:28px;}
.prog-seg{height:3px;flex:1;border-radius:2px;background:var(--bg4);transition:background .4s;}
.prog-seg.done{background:var(--green);}
.prog-seg.current{background:var(--cyan);box-shadow:0 0 8px rgba(34,211,238,.4);}

.panel-title{font-size:28px;font-weight:700;letter-spacing:.02em;line-height:1.2;margin-bottom:8px;}
.panel-sub{font-size:14px;color:var(--text2);font-weight:300;line-height:1.6;}

.panel-body{flex:1;padding:0 48px;overflow-y:auto;}
.panel-footer{padding:28px 48px;border-top:1px solid var(--border);display:flex;align-items:center;gap:12px;margin-top:auto;}

/* ── Inputs ── */
input,select,textarea{
  background:var(--bg3);border:1px solid var(--border2);border-radius:8px;
  padding:10px 14px;font-family:var(--font);font-size:13px;color:var(--text);
  outline:none;width:100%;transition:all .15s;}
input:focus,select:focus,textarea:focus{border-color:rgba(34,211,238,.5);background:var(--bg4);box-shadow:0 0 0 3px rgba(34,211,238,.08);}
select option{background:var(--bg3);}
label{font-size:11px;font-family:var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.08em;display:block;margin-bottom:6px;}
.field{margin-bottom:18px;}
.field-row{display:grid;gap:14px;margin-bottom:18px;}
.field-hint{font-size:11px;font-family:var(--mono);color:var(--muted);margin-top:6px;line-height:1.5;}

/* ── Buttons ── */
.btn{border:none;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:600;
  letter-spacing:.05em;border-radius:9px;padding:11px 22px;transition:all .15s;
  display:inline-flex;align-items:center;gap:8px;text-transform:uppercase;}
.btn-primary{background:var(--cyan);color:#000;}
.btn-primary:hover{background:#38BDF8;transform:translateY(-1px);box-shadow:0 4px 20px rgba(34,211,238,.3);}
.btn-primary:disabled{background:var(--bg4);color:var(--muted);cursor:not-allowed;transform:none;box-shadow:none;}
.btn-ghost{background:var(--bg3);border:1px solid var(--border2);color:var(--text2);}
.btn-ghost:hover{border-color:var(--border3);color:var(--text);}
.btn-danger{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);color:var(--red);}
.btn-danger:hover{background:rgba(239,68,68,.18);}
.btn-sm{padding:7px 14px;font-size:11px;border-radius:7px;}
.btn-xs{padding:5px 10px;font-size:10px;border-radius:6px;}

/* ── Status / Badges ── */
.badge{font-size:10px;font-family:var(--mono);font-weight:600;padding:3px 8px;border-radius:4px;letter-spacing:.05em;}
.badge-ok{background:rgba(16,185,129,.15);color:var(--green);border:1px solid rgba(16,185,129,.2);}
.badge-warn{background:rgba(245,158,11,.1);color:var(--orange);border:1px solid rgba(245,158,11,.2);}
.badge-err{background:rgba(239,68,68,.1);color:var(--red);border:1px solid rgba(239,68,68,.2);}
.badge-info{background:rgba(34,211,238,.1);color:var(--cyan);border:1px solid rgba(34,211,238,.2);}
.badge-purple{background:rgba(168,85,247,.1);color:var(--purple);border:1px solid rgba(168,85,247,.2);}

.dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0;}
.dot.on{background:var(--green);box-shadow:0 0 6px var(--green);animation:pulse 2s infinite;}
.dot.off{background:var(--red);}
.dot.warn{background:var(--orange);}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}

/* ── Cards ── */
.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin-bottom:12px;}
.card.highlight{border-color:var(--border2);}
.card.selected{border-color:var(--cyan);background:var(--card2);box-shadow:var(--glow-cyan);}
.card.selected-purple{border-color:var(--purple);background:var(--card2);box-shadow:var(--glow-purple);}
.card-head{display:flex;align-items:center;gap:10px;margin-bottom:12px;}
.card-title{font-size:14px;font-weight:600;}
.card-sub{font-size:11px;font-family:var(--mono);color:var(--muted);margin-top:2px;}

/* ── Terminal / Log ── */
.terminal{background:#020408;border:1px solid var(--border2);border-radius:10px;
  padding:16px;font-family:var(--mono);font-size:12px;line-height:1.8;
  max-height:220px;overflow-y:auto;margin-bottom:16px;}
.terminal::-webkit-scrollbar{width:4px;}
.terminal::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:2px;}
.tline{display:flex;gap:10px;}
.tline-time{color:var(--muted);flex-shrink:0;}
.tline-ok{color:var(--green);}
.tline-err{color:var(--red);}
.tline-info{color:var(--cyan);}
.tline-warn{color:var(--orange);}
.tline-muted{color:var(--muted);}
.cursor{display:inline-block;width:8px;height:13px;background:var(--cyan);
  animation:blink .8s step-end infinite;vertical-align:middle;}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}

/* ── Console Type Grid ── */
.console-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:16px;}
.ctype-btn{background:var(--bg3);border:1.5px solid var(--border);border-radius:10px;
  padding:12px 10px;cursor:pointer;transition:all .15s;text-align:center;
  display:flex;flex-direction:column;align-items:center;gap:6px;}
.ctype-btn:hover{border-color:var(--border2);transform:translateY(-2px);}
.ctype-btn.active{border-width:2px;box-shadow:0 4px 16px rgba(0,0,0,.4);}
.ct-icon{width:36px;height:26px;border-radius:5px;display:flex;align-items:center;
  justify-content:center;font-size:9px;font-weight:700;font-family:var(--mono);flex-shrink:0;}
.ct-name{font-size:10px;font-weight:600;color:var(--text);text-align:center;line-height:1.3;}
.ct-gen{font-size:9px;font-family:var(--mono);color:var(--muted);}

/* ── Console gen section ── */
.gen-label{font-size:10px;font-family:var(--mono);color:var(--muted);
  text-transform:uppercase;letter-spacing:.1em;
  margin:14px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border);}

/* ── Node card ── */
.node-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:10px;display:flex;align-items:center;gap:14px;}
.node-card.online{border-left:3px solid var(--green);}
.node-card.offline{border-left:3px solid var(--red);opacity:.6;}
.nc-info{flex:1;}
.nc-name{font-size:13px;font-weight:600;margin-bottom:2px;}
.nc-meta{font-size:11px;font-family:var(--mono);color:var(--muted);}
.nc-actions{display:flex;gap:8px;}

/* ── ROM system grid ── */
.sys-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:20px;}
.sys-card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px 16px;
  display:flex;align-items:center;gap:12px;}
.sys-card.active{border-color:rgba(168,85,247,.4);background:rgba(168,85,247,.06);}
.sys-icon{font-size:20px;flex-shrink:0;}
.sys-name{font-size:12px;font-weight:600;margin-bottom:2px;}
.sys-count{font-size:11px;font-family:var(--mono);color:var(--purple);}
.sys-ext{font-size:10px;font-family:var(--mono);color:var(--muted);}

/* ── Emulator list ── */
.emu-row{background:var(--card);border:1px solid var(--border);border-radius:10px;
  padding:13px 16px;margin-bottom:8px;display:flex;align-items:center;gap:12px;}
.emu-row.disabled{opacity:.5;}
.emu-icon{width:32px;height:32px;background:var(--bg3);border-radius:7px;
  display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
.emu-info{flex:1;}
.emu-name{font-size:13px;font-weight:600;margin-bottom:3px;}
.emu-systems{display:flex;gap:5px;flex-wrap:wrap;}
.emu-sys-tag{font-size:9px;font-family:var(--mono);background:var(--bg3);
  color:var(--text2);padding:2px 6px;border-radius:3px;text-transform:uppercase;}
.emu-note{font-size:10px;font-family:var(--mono);color:var(--orange);margin-top:3px;}
.emu-toggle{width:36px;height:20px;border-radius:10px;background:var(--bg4);
  border:none;cursor:pointer;position:relative;transition:background .2s;flex-shrink:0;}
.emu-toggle.on{background:var(--green);}
.emu-toggle::after{content:'';position:absolute;top:3px;left:3px;width:14px;height:14px;
  background:#fff;border-radius:50%;transition:transform .2s;}
.emu-toggle.on::after{transform:translateX(16px);}

/* ── Summary ── */
.summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;}
.sum-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px 20px;}
.sum-num{font-size:36px;font-weight:700;font-family:var(--mono);line-height:1;}
.sum-label{font-size:11px;font-family:var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-top:4px;}

/* ── Welcome screen ── */
.welcome-hero{text-align:center;padding:20px 0 36px;}
.w-hex-big{width:72px;height:72px;background:var(--cyan);margin:0 auto 20px;
  clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);
  display:flex;align-items:center;justify-content:center;font-size:28px;}
.w-title{font-size:32px;font-weight:700;letter-spacing:.02em;margin-bottom:10px;}
.w-sub{font-size:15px;color:var(--text2);font-weight:300;max-width:480px;margin:0 auto;line-height:1.6;}

.checklist{display:flex;flex-direction:column;gap:8px;margin:24px 0;}
.cl-item{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;
  background:var(--card);border:1px solid var(--border);border-radius:10px;}
.cl-icon{font-size:18px;flex-shrink:0;margin-top:1px;}
.cl-body{}
.cl-title{font-size:13px;font-weight:600;margin-bottom:2px;}
.cl-desc{font-size:12px;font-family:var(--mono);color:var(--muted);line-height:1.5;}

/* ── Connect step ── */
.conn-box{background:var(--card);border:1px solid var(--border);border-radius:12px;
  padding:22px 24px;margin-bottom:16px;}
.conn-status-row{display:flex;align-items:center;gap:10px;padding:12px 14px;
  background:var(--bg3);border-radius:8px;font-family:var(--mono);font-size:12px;margin-top:14px;}

/* ── Install command ── */
.install-cmd{background:#020408;border:1px solid var(--border2);border-radius:10px;padding:14px 16px;
  font-family:var(--mono);font-size:12px;color:var(--cyan);
  display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;}
.cmd-text{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.copy-btn{background:var(--bg3);border:1px solid var(--border2);color:var(--muted);
  border-radius:6px;padding:5px 10px;font-family:var(--mono);font-size:10px;cursor:pointer;
  flex-shrink:0;transition:all .15s;}
.copy-btn:hover{border-color:var(--cyan);color:var(--cyan);}

/* ── Section divider ── */
.sdiv{display:flex;align-items:center;gap:12px;margin:20px 0 14px;}
.sdiv-line{flex:1;height:1px;background:var(--border);}
.sdiv-label{font-size:10px;font-family:var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.1em;flex-shrink:0;}

/* ── Misc ── */
.row{display:flex;align-items:center;gap:10px;}
.spinner{width:14px;height:14px;border:2px solid var(--border2);border-top-color:var(--cyan);
  border-radius:50%;animation:spin .65s linear infinite;flex-shrink:0;}
@keyframes spin{to{transform:rotate(360deg)}}
.err-box{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:9px;
  padding:12px 14px;font-size:12px;font-family:var(--mono);color:var(--red);margin-bottom:14px;}
.info-box{background:rgba(34,211,238,.06);border:1px solid rgba(34,211,238,.15);border-radius:9px;
  padding:12px 14px;font-size:12px;font-family:var(--mono);color:var(--cyan);margin-bottom:14px;line-height:1.6;}
.warn-box{background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.15);border-radius:9px;
  padding:12px 14px;font-size:12px;font-family:var(--mono);color:var(--orange);margin-bottom:14px;line-height:1.6;}
.scroll-area{max-height:360px;overflow-y:auto;padding-right:4px;}
.scroll-area::-webkit-scrollbar{width:4px;}
.scroll-area::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:2px;}
.tag-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:5px;}
.tag{font-size:10px;font-family:var(--mono);padding:2px 7px;border-radius:3px;background:var(--bg3);color:var(--text2);}
`;

// ─────────────────────────────────────────────────────────
//  STEP DEFINITIONS
// ─────────────────────────────────────────────────────────
const STEPS = [
  { id:"welcome",   label:"Welcome",        sub:"Get started"        },
  { id:"server",    label:"Server",          sub:"Connect to NAS"     },
  { id:"nodes",     label:"Nodes",           sub:"Wyse / N100 devices" },
  { id:"consoles",  label:"Consoles",        sub:"Add your hardware"  },
  { id:"romfolder", label:"ROM Folder",      sub:"Emulation library"  },
  { id:"emulators", label:"Emulators",       sub:"Configure engines"  },
  { id:"games",     label:"Games",           sub:"Build your library" },
  { id:"done",      label:"Done",            sub:"Ready to play"      },
];

// ─────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────
function useLog() {
  const [lines, setLines] = useState([]);
  const ref = useRef(null);
  const add = useCallback((msg, type = "info") => {
    const time = new Date().toLocaleTimeString("en",{hour12:false,hour:"2-digit",minute:"2-digit",second:"2-digit"});
    setLines(l => [...l, { msg, type, time, id: Date.now() + Math.random() }]);
    setTimeout(() => ref.current?.scrollTo(0, ref.current.scrollHeight), 50);
  }, []);
  const clear = () => setLines([]);
  return { lines, add, clear, ref };
}

function Terminal({ lines, logRef }) {
  return (
    <div className="terminal" ref={logRef}>
      {lines.map(l => (
        <div key={l.id} className="tline">
          <span className="tline-time">{l.time}</span>
          <span className={`tline-${l.type}`}>{l.msg}</span>
        </div>
      ))}
      {lines.length > 0 && <div className="tline"><span className="tline-time"/><span><span className="cursor"/></span></div>}
    </div>
  );
}

function CopyCmd({ cmd }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(cmd);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="install-cmd">
      <span className="cmd-text">$ {cmd}</span>
      <button className="copy-btn" onClick={copy}>{copied ? "✓ Copied" : "Copy"}</button>
    </div>
  );
}

const INSTALL_CMD = "curl -fsSL https://raw.githubusercontent.com/YOUR_USER/consolehub/main/install-node.sh | bash";

// ─────────────────────────────────────────────────────────
//  STEP COMPONENTS
// ─────────────────────────────────────────────────────────

// ── Step 1: Welcome ──────────────────────────────────────
function StepWelcome({ onNext }) {
  return (
    <>
      <div className="welcome-hero">
        <div className="w-hex-big">🎮</div>
        <div className="w-title">Welcome to ConsoleHub</div>
        <div className="w-sub">Your private cloud gaming platform. Stream any console — real or emulated — to any browser on your network.</div>
      </div>

      <div className="sdiv"><div className="sdiv-line"/><span className="sdiv-label">What we'll set up</span><div className="sdiv-line"/></div>

      <div className="checklist">
        {[
          ["🖧", "Server Connection",   "Point ConsoleHub at your NAS running the Docker stack"],
          ["📡", "Capture Nodes",       "Wyse 3040s or N100 mini PCs connected to your consoles"],
          ["🎮", "Physical Consoles",   "Every console from NES to PS5, assigned to a node"],
          ["💾", "ROM Library",         "Point to your NAS ROM folder — we'll scan and index everything"],
          ["⚙",  "Emulators",          "RetroArch, PCSX2, Dolphin and more — pre-configured"],
          ["📋", "Game Library",        "Add game titles to each console for one-click launch"],
        ].map(([icon, title, desc]) => (
          <div key={title} className="cl-item">
            <div className="cl-icon">{icon}</div>
            <div className="cl-body">
              <div className="cl-title">{title}</div>
              <div className="cl-desc">{desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
        <button className="btn btn-primary" onClick={onNext}>Get Started →</button>
      </div>
    </>
  );
}

// ── Step 2: Server ───────────────────────────────────────
function StepServer({ data, setData, onNext, onBack }) {
  const [url, setUrl] = useState(data.serverUrl || getServer());
  const [status, setStatus] = useState(null); // null | testing | ok | err
  const [err, setErr] = useState(null);
  const log = useLog();

  const test = async () => {
    setStatus("testing"); setErr(null); log.clear();
    log.add("Testing connection to " + url, "info");
    try {
      setServer(url);
      log.add("GET " + url + "/api/health", "muted");
      const r = await fetch(url + "/api/health", { signal: AbortSignal.timeout(5000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      log.add("✓ Server responded — ConsoleHub backend online", "ok");
      log.add("Fetching node list…", "muted");
      const nodes = await fetch(url + "/api/nodes").then(r2 => r2.json());
      log.add(`✓ Found ${nodes.length} registered node(s)`, "ok");
      setStatus("ok");
      setData(d => ({ ...d, serverUrl: url, serverNodes: nodes }));
    } catch(e) {
      log.add("✗ " + e.message, "err");
      log.add("Check: is the Docker stack running on your NAS?", "warn");
      setStatus("err"); setErr(e.message);
    }
  };

  return (
    <>
      <div className="conn-box">
        <div className="field">
          <label>ConsoleHub Server URL</label>
          <input value={url} onChange={e => setUrl(e.target.value)}
            placeholder="http://192.168.1.100:7000"
            onKeyDown={e => e.key === "Enter" && test()}/>
          <div className="field-hint">The IP of your NAS running the Docker stack · Port 7000 by default</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={test} disabled={status==="testing"}>
          {status==="testing" ? <><div className="spinner"/>Testing…</> : "Test Connection"}
        </button>
        {status && (
          <div className="conn-status-row">
            {status==="testing" && <><div className="spinner"/><span style={{color:"var(--text2)"}}>Connecting…</span></>}
            {status==="ok"      && <><span className="dot on"/><span style={{color:"var(--green)"}}>Connected — server is online</span></>}
            {status==="err"     && <><span className="dot off"/><span style={{color:"var(--red)"}}>Could not connect</span></>}
          </div>
        )}
      </div>

      {log.lines.length > 0 && <Terminal lines={log.lines} logRef={log.ref}/>}

      {status !== "ok" && (
        <div className="info-box">
          Haven't installed the server yet?<br/>
          On your NAS: <strong style={{color:"var(--cyan)"}}>curl -fsSL …/install-server.sh | bash</strong>
        </div>
      )}

      <div className="panel-footer" style={{padding:0,border:0,marginTop:20}}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <div style={{flex:1}}/>
        <button className="btn btn-primary" onClick={onNext} disabled={status !== "ok"}>
          Continue →
        </button>
      </div>
    </>
  );
}

// ── Step 3: Nodes ────────────────────────────────────────
function StepNodes({ data, setData, onNext, onBack }) {
  const [nodes, setNodes] = useState(data.serverNodes || []);
  const [loading, setLoading] = useState(false);
  const log = useLog();

  const refresh = async () => {
    setLoading(true); log.clear();
    log.add("Scanning for nodes on network…", "info");
    try {
      const n = await api("/nodes");
      setNodes(n);
      setData(d => ({ ...d, serverNodes: n }));
      log.add(`Found ${n.length} node(s)`, n.length > 0 ? "ok" : "warn");
      n.forEach(nd => log.add(`  ${nd.status==="online"?"✓":"✗"} ${nd.name} — ${nd.ip} (${nd.status})`, nd.status==="online"?"ok":"err"));
    } catch(e) { log.add("✗ " + e.message, "err"); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (nodes.length === 0) refresh(); }, []);

  const onlineCount = nodes.filter(n => n.status === "online").length;

  return (
    <>
      <div className="row" style={{marginBottom:16}}>
        <span style={{fontSize:12,fontFamily:"var(--mono)",color:"var(--muted)"}}>{nodes.length} registered · {onlineCount} online</span>
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading}>
            {loading ? <><div className="spinner"/>Scanning…</> : "⟳ Refresh"}
          </button>
        </div>
      </div>

      {nodes.length > 0 && (
        <div className="scroll-area" style={{marginBottom:16}}>
          {nodes.map(n => (
            <div key={n.id} className={`node-card ${n.status}`}>
              <span className={`dot ${n.status==="online"?"on":"off"}`}/>
              <div className="nc-info">
                <div className="nc-name">{n.name}</div>
                <div className="nc-meta">{n.ip} · {n.os || "linux"} · ID: {n.id}</div>
              </div>
              <span className={`badge ${n.status==="online"?"badge-ok":"badge-err"}`}>{n.status}</span>
            </div>
          ))}
        </div>
      )}

      {log.lines.length > 0 && <Terminal lines={log.lines} logRef={log.ref}/>}

      <div className="sdiv"><div className="sdiv-line"/><span className="sdiv-label">Don't see your node?</span><div className="sdiv-line"/></div>

      <div style={{fontSize:12,fontFamily:"var(--mono)",color:"var(--text2)",marginBottom:10,lineHeight:1.6}}>
        Run this on each Wyse 3040 or N100 (as root):
      </div>
      <CopyCmd cmd={INSTALL_CMD}/>
      <div style={{fontSize:11,fontFamily:"var(--mono)",color:"var(--muted)",marginTop:8}}>
        The node will register automatically within 30 seconds of install.
      </div>

      <div className="panel-footer" style={{padding:0,border:0,marginTop:20}}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <div style={{flex:1}}/>
        {onlineCount === 0 && (
          <span style={{fontSize:11,fontFamily:"var(--mono)",color:"var(--orange)",marginRight:12}}>
            No online nodes — you can skip and add later
          </span>
        )}
        <button className="btn btn-primary" onClick={onNext}>
          {onlineCount > 0 ? "Continue →" : "Skip for now →"}
        </button>
      </div>
    </>
  );
}

// ── Step 4: Consoles ─────────────────────────────────────
function StepConsoles({ data, setData, onNext, onBack }) {
  const nodes = (data.serverNodes || []).filter(n => n.status === "online");
  const [consoles, setConsoles] = useState(data.addedConsoles || []);
  const [adding, setAdding] = useState(false);

  // Form state
  const [selectedNode, setSelectedNode]     = useState(nodes[0]?.id || "");
  const [selectedType, setSelectedType]     = useState(null);
  const [displayName, setDisplayName]       = useState("");
  const [captureDevice, setCaptureDevice]   = useState("video0");
  const [resolution, setResolution]         = useState("1080p");
  const [saving, setSaving]                 = useState(false);
  const [err, setErr]                       = useState(null);

  const selectType = (ct) => {
    setSelectedType(ct);
    setDisplayName(ct.name);
    setResolution(ct.capture === "4K" ? "4k" : ct.capture === "480p" ? "720p" : "1080p");
  };

  const addConsole = async () => {
    if (!selectedType || !selectedNode || !displayName) return;
    setSaving(true); setErr(null);
    try {
      const c = await api("/consoles", { method:"POST", body:{
        nodeId: selectedNode, name: displayName, type: selectedType.id,
        captureDevice, resolution,
        launchConfig: JSON.stringify({}),
      }});
      setConsoles(cs => [...cs, c]);
      setData(d => ({ ...d, addedConsoles: [...(d.addedConsoles||[]), c] }));
      setSelectedType(null); setDisplayName(""); setCaptureDevice("video0");
    } catch(e) { setErr(String(e)); }
    finally { setSaving(false); }
  };

  const removeConsole = async (id) => {
    await api(`/consoles/${id}`, { method:"DELETE" }).catch(()=>{});
    setConsoles(cs => cs.filter(c => c.id !== id));
  };

  const gens = [...new Set(CONSOLE_TYPES.map(c => c.gen))];

  return (
    <>
      {nodes.length === 0 ? (
        <div className="warn-box">No online nodes found. Go back and install the node agent on a Wyse 3040 first, then return to this step.</div>
      ) : (
        <>
          {err && <div className="err-box">✗ {err}</div>}

          {/* Added consoles */}
          {consoles.length > 0 && (
            <>
              <div className="sdiv"><div className="sdiv-line"/><span className="sdiv-label">Added ({consoles.length})</span><div className="sdiv-line"/></div>
              {consoles.map(c => {
                const ct = CONSOLE_TYPES.find(t => t.id === c.type) || {};
                return (
                  <div key={c.id} className="node-card" style={{borderLeft:"3px solid "+(ct.color||"var(--border2)")}}>
                    <div className="ct-icon" style={{width:36,height:26,background:(ct.color||"#333")+"22",color:ct.color,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,fontFamily:"var(--mono)"}}>
                      {ct.icon||"?"}
                    </div>
                    <div className="nc-info">
                      <div className="nc-name">{c.name}</div>
                      <div className="nc-meta">{ct.name} · /dev/{c.capture_device} · {c.resolution} · {nodes.find(n=>n.id===c.node_id)?.name}</div>
                    </div>
                    <button className="btn btn-danger btn-xs" onClick={() => removeConsole(c.id)}>Remove</button>
                  </div>
                );
              })}
            </>
          )}

          <div className="sdiv"><div className="sdiv-line"/><span className="sdiv-label">Add Console</span><div className="sdiv-line"/></div>

          {/* Node picker */}
          {nodes.length > 1 && (
            <div className="field">
              <label>Assign to Node</label>
              <select value={selectedNode} onChange={e => setSelectedNode(e.target.value)}>
                {nodes.map(n => <option key={n.id} value={n.id}>{n.name} ({n.ip})</option>)}
              </select>
            </div>
          )}

          {/* Console type grid */}
          <div className="field">
            <label>Console Type</label>
            <div className="scroll-area" style={{maxHeight:300}}>
              {gens.map(gen => (
                <div key={gen}>
                  <div className="gen-label">{gen}</div>
                  <div className="console-grid">
                    {CONSOLE_TYPES.filter(c => c.gen === gen).map(ct => (
                      <div key={ct.id} className={`ctype-btn${selectedType?.id===ct.id?" active":""}`}
                        style={selectedType?.id===ct.id?{borderColor:ct.color,boxShadow:`0 0 12px ${ct.color}44`}:{}}
                        onClick={() => selectType(ct)}>
                        <div className="ct-icon" style={{background:ct.color+"22",color:ct.color}}>{ct.icon}</div>
                        <div className="ct-name">{ct.name}</div>
                        <div className="ct-gen">{ct.capture}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Details form — shown after type selected */}
          {selectedType && (
            <div className="card highlight" style={{borderColor:selectedType.color+"44"}}>
              <div className="card-head">
                <div className="ct-icon" style={{width:40,height:28,background:selectedType.color+"22",color:selectedType.color,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,fontFamily:"var(--mono)"}}>
                  {selectedType.icon}
                </div>
                <div>
                  <div className="card-title">{selectedType.name}</div>
                  <div className="card-sub">{selectedType.gen} · HDCP: {selectedType.hdcp?"Yes":"No"} · Max: {selectedType.capture}</div>
                </div>
              </div>

              {selectedType.hdcp && (
                <div className="warn-box" style={{marginBottom:14}}>⚠ This console outputs HDCP. Disable it: Settings → HDMI → HDCP Off. Required for capture to work.</div>
              )}

              <div className="field-row" style={{gridTemplateColumns:"1fr 1fr 1fr"}}>
                <div className="field" style={{marginBottom:0}}>
                  <label>Display Name</label>
                  <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={selectedType.name}/>
                </div>
                <div className="field" style={{marginBottom:0}}>
                  <label>Capture Device</label>
                  <input value={captureDevice} onChange={e => setCaptureDevice(e.target.value)} placeholder="video0"/>
                  <div className="field-hint">Run v4l2-ctl --list-devices on node</div>
                </div>
                <div className="field" style={{marginBottom:0}}>
                  <label>Resolution</label>
                  <select value={resolution} onChange={e => setResolution(e.target.value)}>
                    <option value="720p">720p</option>
                    <option value="1080p">1080p</option>
                    <option value="4k">4K</option>
                  </select>
                </div>
              </div>

              <div style={{marginTop:16,display:"flex",gap:9}}>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedType(null)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={addConsole} disabled={saving||!displayName}>
                  {saving ? <><div className="spinner"/>Adding…</> : `Add ${displayName}`}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="panel-footer" style={{padding:0,border:0,marginTop:24}}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <div style={{flex:1}}/>
        {consoles.length === 0 && <span style={{fontSize:11,fontFamily:"var(--mono)",color:"var(--orange)",marginRight:12}}>No consoles added — you can add later</span>}
        <button className="btn btn-primary" onClick={onNext}>
          {consoles.length > 0 ? `Continue with ${consoles.length} console${consoles.length!==1?"s":""} →` : "Skip →"}
        </button>
      </div>
    </>
  );
}

// ── Step 5: ROM Folder ───────────────────────────────────
function StepRomFolder({ data, setData, onNext, onBack }) {
  const [romPath, setRomPath] = useState(data.romPath || "/roms");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(data.scanResult || null);
  const [err, setErr] = useState(null);
  const log = useLog();

  const scan = async () => {
    setScanning(true); setScanResult(null); setErr(null); log.clear();
    log.add("Starting ROM scan at " + romPath, "info");
    log.add("Looking for supported file extensions…", "muted");
    try {
      const r = await api("/roms/scan", { method:"POST", body:{ path: romPath } });
      log.add(`✓ Scan complete — ${r.added} new ROMs found`, "ok");
      if (r.addedList?.length) {
        const bySys = {};
        r.addedList.forEach(x => { bySys[x.system] = (bySys[x.system]||0)+1; });
        Object.entries(bySys).forEach(([sys,cnt]) => log.add(`  ${sys}: ${cnt} ROM${cnt!==1?"s":""}`, "info"));
      }
      if (r.skipped > 0) log.add(`  ${r.skipped} already in library (skipped)`, "muted");
      setScanResult(r);
      setData(d => ({ ...d, romPath, scanResult:r }));
    } catch(e) {
      log.add("✗ " + String(e), "err");
      log.add("Make sure the path is mounted in the Docker container (ROM_PATH in .env)", "warn");
      setErr(String(e));
    }
    finally { setScanning(false); }
  };

  const bySys = {};
  scanResult?.addedList?.forEach(x => { bySys[x.system] = (bySys[x.system]||0)+1; });

  return (
    <>
      <div className="info-box">
        Organize your ROMs in folders by system name. Example:<br/>
        <code style={{color:"var(--cyan)"}}>/roms/snes/ChronoTrigger.sfc</code><br/>
        <code style={{color:"var(--cyan)"}}>/roms/ps2/ShadowOfColossus.iso</code><br/>
        <code style={{color:"var(--cyan)"}}>/roms/n64/OcarinaOfTime.z64</code>
      </div>

      <div className="field">
        <label>NAS ROM Root Path</label>
        <input value={romPath} onChange={e => setRomPath(e.target.value)}
          placeholder="/roms"/>
        <div className="field-hint">This path must be mounted into the Docker container. Set ROM_PATH in your .env file on the NAS, then restart the stack.</div>
      </div>

      <div className="sdiv"><div className="sdiv-line"/><span className="sdiv-label">Supported Systems</span><div className="sdiv-line"/></div>
      <div className="sys-grid">
        {ROM_SYSTEMS.map(s => (
          <div key={s.id} className={`sys-card${bySys[s.id]?" active":""}`}>
            <div className="sys-icon">{s.icon}</div>
            <div>
              <div className="sys-name">{s.name}</div>
              {bySys[s.id]
                ? <div className="sys-count">✓ {bySys[s.id]} ROMs found</div>
                : <div className="sys-ext">{s.ext.join(", ")}</div>}
            </div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:10,marginBottom:16}}>
        <button className="btn btn-primary btn-sm" onClick={scan} disabled={scanning}>
          {scanning ? <><div className="spinner"/>Scanning…</> : "⟳ Scan ROM Folder"}
        </button>
        {scanResult && <span style={{fontSize:12,fontFamily:"var(--mono)",color:"var(--green)",display:"flex",alignItems:"center",gap:6}}><span className="dot on"/>Scan complete — {scanResult.added} added</span>}
      </div>

      {log.lines.length > 0 && <Terminal lines={log.lines} logRef={log.ref}/>}

      <div className="panel-footer" style={{padding:0,border:0,marginTop:16}}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <div style={{flex:1}}/>
        <button className="btn btn-primary" onClick={onNext}>Continue →</button>
      </div>
    </>
  );
}

// ── Step 6: Emulators ────────────────────────────────────
function StepEmulators({ data, setData, onNext, onBack }) {
  const [enabled, setEnabled] = useState(() => {
    const saved = data.enabledEmulators;
    if (saved) return saved;
    const def = {};
    EMULATORS.forEach(e => { def[e.id] = e.status === "bundled"; });
    return def;
  });

  const toggle = (id) => setEnabled(e => ({ ...e, [id]: !e[id] }));

  const save = () => {
    setData(d => ({ ...d, enabledEmulators: enabled }));
    onNext();
  };

  const emuIcons = { retroarch:"🎮", DuckStation:"💿", PCSX2:"💿", Dolphin:"🐬", Ryujinx:"🔵", RPCS3:"🟡", Xenia:"🟩" };

  return (
    <>
      <div className="info-box">
        These emulators run inside the <strong style={{color:"var(--cyan)"}}>emulation</strong> Docker container on your NAS. Bundled ones install automatically. Manual ones need extra setup.
      </div>

      <div className="scroll-area">
        {EMULATORS.map(e => (
          <div key={e.id} className={`emu-row${!enabled[e.id]?" disabled":""}`}>
            <div className="emu-icon">{emuIcons[e.name] || "⚙"}</div>
            <div className="emu-info">
              <div className="emu-name">{e.name} <span style={{fontSize:10,fontFamily:"var(--mono)",color:"var(--muted)"}}>({e.binary})</span></div>
              <div className="emu-systems">
                {e.systems.map(s => <span key={s} className="emu-sys-tag">{s}</span>)}
                <span className={`badge ${e.target==="server"?"badge-info":"badge-purple"}`} style={{fontSize:9}}>{e.target}</span>
                <span className={`badge ${e.status==="bundled"?"badge-ok":"badge-warn"}`} style={{fontSize:9}}>{e.status}</span>
              </div>
              {e.note && <div className="emu-note">⚠ {e.note}</div>}
            </div>
            <button className={`emu-toggle${enabled[e.id]?" on":""}`} onClick={() => toggle(e.id)} title={enabled[e.id]?"Disable":"Enable"}/>
          </div>
        ))}
      </div>

      <div style={{fontSize:11,fontFamily:"var(--mono)",color:"var(--muted)",marginTop:14,lineHeight:1.6}}>
        The emulation container is built automatically when you run <code style={{color:"var(--cyan)"}}>docker compose up</code>.<br/>
        Bundled emulators install via apt. Manual ones require additional steps — see docs.
      </div>

      <div className="panel-footer" style={{padding:0,border:0,marginTop:20}}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <div style={{flex:1}}/>
        <button className="btn btn-primary" onClick={save}>Save & Continue →</button>
      </div>
    </>
  );
}

// ── Step 7: Games ────────────────────────────────────────
function StepGames({ data, setData, onNext, onBack }) {
  const consoles = data.addedConsoles || [];
  const [selectedConsole, setSelectedConsole] = useState(consoles[0]?.id || "");
  const [bulkText, setBulkText] = useState("");
  const [games, setGames] = useState(data.addedGames || {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(null);

  const addGames = async () => {
    const titles = bulkText.split("\n").map(t => t.trim()).filter(Boolean);
    if (!titles.length || !selectedConsole) return;
    setSaving(true); setErr(null);
    try {
      const result = await api("/games/bulk", { method:"POST", body:{
        consoleId: selectedConsole,
        games: titles.map(t => ({ title: t })),
      }});
      setGames(g => ({ ...g, [selectedConsole]: [...(g[selectedConsole]||[]), ...titles] }));
      setData(d => ({ ...d, addedGames: { ...(d.addedGames||{}), [selectedConsole]: [...(d.addedGames?.[selectedConsole]||[]), ...titles] } }));
      setBulkText(""); setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch(e) { setErr(String(e)); }
    finally { setSaving(false); }
  };

  const sel = consoles.find(c => c.id === selectedConsole);
  const ct = sel ? CONSOLE_TYPES.find(t => t.id === sel.type) : null;
  const totalGames = Object.values(games).flat().length;

  return (
    <>
      {consoles.length === 0 ? (
        <div className="warn-box">No consoles configured. You can add games later from the main portal once consoles are set up.</div>
      ) : (
        <>
          <div className="field">
            <label>Select Console</label>
            <select value={selectedConsole} onChange={e => { setSelectedConsole(e.target.value); setSaved(false); }}>
              {consoles.map(c => {
                const t = CONSOLE_TYPES.find(x => x.id === c.type);
                const cnt = games[c.id]?.length || 0;
                return <option key={c.id} value={c.id}>{t?.name || c.type} — {c.name} ({cnt} games)</option>;
              })}
            </select>
          </div>

          {sel && (
            <div className="card" style={{borderLeft:"3px solid "+(ct?.color||"var(--border2)"),marginBottom:16}}>
              <div style={{fontSize:12,fontFamily:"var(--mono)",color:"var(--muted)",marginBottom:10}}>
                {ct?.name} · Launch: <span style={{color:"var(--cyan)"}}>{sel.launch_method||"manual"}</span>
                {sel.type==="ps3" && " (WebMAN auto-launch if title ID is set)"}
                {sel.type==="xboxseries" && " (SmartGlass auto-launch if title ID is set)"}
              </div>

              <div className="field" style={{marginBottom:8}}>
                <label>Game Titles — one per line</label>
                <textarea rows={6} value={bulkText} onChange={e => setBulkText(e.target.value)}
                  placeholder={"Halo Infinite\nForza Horizon 5\nPsychonauts 2\n…"}
                  style={{resize:"vertical",fontFamily:"var(--mono)",fontSize:12}}/>
                <div className="field-hint">Paste your game list. You can add box art and launch IDs from the portal later.</div>
              </div>

              {err && <div className="err-box">✗ {err}</div>}

              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <button className="btn btn-primary btn-sm" onClick={addGames} disabled={saving||!bulkText.trim()}>
                  {saving ? <><div className="spinner"/>Adding…</> : "Add Games"}
                </button>
                {saved && <span style={{fontSize:12,fontFamily:"var(--mono)",color:"var(--green)"}}>✓ Saved</span>}
              </div>
            </div>
          )}

          {/* Show what's been added */}
          {Object.keys(games).length > 0 && (
            <>
              <div className="sdiv"><div className="sdiv-line"/><span className="sdiv-label">Added ({totalGames} games)</span><div className="sdiv-line"/></div>
              {consoles.map(c => {
                const glist = games[c.id] || [];
                if (!glist.length) return null;
                const t = CONSOLE_TYPES.find(x => x.id === c.type);
                return (
                  <div key={c.id} className="card" style={{marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                      <div className="ct-icon" style={{width:36,height:26,background:(t?.color||"#333")+"22",color:t?.color,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,fontFamily:"var(--mono)"}}>
                        {t?.icon||"?"}
                      </div>
                      <span style={{fontSize:13,fontWeight:600}}>{c.name}</span>
                      <span className="badge badge-info" style={{marginLeft:"auto"}}>{glist.length} games</span>
                    </div>
                    <div className="tag-row">{glist.slice(0,12).map((g,i) => <span key={i} className="tag">{g}</span>)}
                      {glist.length>12&&<span className="tag">+{glist.length-12} more</span>}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}

      <div className="panel-footer" style={{padding:0,border:0,marginTop:24}}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <div style={{flex:1}}/>
        <button className="btn btn-primary" onClick={onNext}>
          {totalGames > 0 ? `Continue with ${totalGames} games →` : "Skip →"}
        </button>
      </div>
    </>
  );
}

// ── Step 8: Done ─────────────────────────────────────────
function StepDone({ data, onFinish }) {
  const nodes    = (data.serverNodes || []).filter(n => n.status === "online");
  const consoles = data.addedConsoles || [];
  const totalGames = Object.values(data.addedGames || {}).flat().length;
  const roms     = data.scanResult?.added || 0;
  const enabledEmu = Object.values(data.enabledEmulators || {}).filter(Boolean).length;

  return (
    <>
      <div style={{textAlign:"center",padding:"24px 0 32px"}}>
        <div style={{fontSize:48,marginBottom:16}}>🎉</div>
        <div style={{fontSize:22,fontWeight:700,marginBottom:8}}>ConsoleHub is ready</div>
        <div style={{fontSize:14,color:"var(--text2)",fontWeight:300}}>Everything is configured. Time to play.</div>
      </div>

      <div className="summary-grid">
        <div className="sum-card">
          <div className="sum-num" style={{color:"var(--green)"}}>{nodes.length}</div>
          <div className="sum-label">Online Nodes</div>
        </div>
        <div className="sum-card">
          <div className="sum-num" style={{color:"var(--cyan)"}}>{consoles.length}</div>
          <div className="sum-label">Consoles</div>
        </div>
        <div className="sum-card">
          <div className="sum-num" style={{color:"var(--orange)"}}>{totalGames}</div>
          <div className="sum-label">Games</div>
        </div>
        <div className="sum-card">
          <div className="sum-num" style={{color:"var(--purple)"}}>{roms}</div>
          <div className="sum-label">ROMs Indexed</div>
        </div>
      </div>

      <div className="sdiv"><div className="sdiv-line"/><span className="sdiv-label">What's next</span><div className="sdiv-line"/></div>
      <div className="checklist">
        {[
          ["🎮", "Open the portal",        "Browse your game library and start streaming"],
          ["🖼",  "Add cover art",          "IGDB auto-fetch coming in v0.3 — or paste URLs manually"],
          ["🆔", "Set launch IDs",          "PS3 title IDs (WebMAN) + Xbox IDs (SmartGlass) for auto-launch"],
          ["💾", "Configure save states",  "Emulation save slots sync to NAS automatically"],
        ].map(([icon, title, desc]) => (
          <div key={title} className="cl-item">
            <div className="cl-icon">{icon}</div>
            <div><div className="cl-title">{title}</div><div className="cl-desc">{desc}</div></div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",justifyContent:"center",marginTop:24}}>
        <button className="btn btn-primary" style={{fontSize:15,padding:"14px 36px"}} onClick={onFinish}>
          Open ConsoleHub →
        </button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────
//  MAIN WIZARD
// ─────────────────────────────────────────────────────────
export default function ConsoleHubWizard({ onComplete }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [completed, setCompleted] = useState(new Set());
  const [wizardData, setWizardData] = useState({});
  const bodyRef = useRef(null);

  const goNext = useCallback(() => {
    setCompleted(s => new Set([...s, STEPS[stepIdx].id]));
    setStepIdx(i => Math.min(i + 1, STEPS.length - 1));
    bodyRef.current?.scrollTo(0, 0);
  }, [stepIdx]);

  const goBack = useCallback(() => {
    setStepIdx(i => Math.max(i - 1, 0));
    bodyRef.current?.scrollTo(0, 0);
  }, []);

  const goTo = useCallback((idx) => {
    if (idx < stepIdx || completed.has(STEPS[idx].id)) setStepIdx(idx);
  }, [stepIdx, completed]);

  const current = STEPS[stepIdx];

  const stepProps = { data: wizardData, setData: setWizardData, onNext: goNext, onBack: goBack };

  const STEP_COMPONENTS = {
    welcome:   <StepWelcome   onNext={goNext} />,
    server:    <StepServer    {...stepProps} />,
    nodes:     <StepNodes     {...stepProps} />,
    consoles:  <StepConsoles  {...stepProps} />,
    romfolder: <StepRomFolder {...stepProps} />,
    emulators: <StepEmulators {...stepProps} />,
    games:     <StepGames     {...stepProps} />,
    done:      <StepDone      data={wizardData} onFinish={onComplete || (() => {})} />,
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="wizard">
        {/* ── Sidebar ── */}
        <div className="sidebar">
          <div className="sidebar-logo">
            <div className="s-logo">
              <div className="s-hex"/>
              <span className="s-name">ConsoleHub</span>
            </div>
            <div className="s-tagline">Setup Wizard · v0.2</div>
          </div>

          <div className="step-list">
            {STEPS.map((s, idx) => {
              const done    = completed.has(s.id);
              const isCur   = idx === stepIdx;
              const locked  = idx > stepIdx && !completed.has(s.id);
              const clickable = done || idx <= stepIdx;
              return (
                <div key={s.id}
                  className={`step-item${isCur?" current":""}${done?" done":""}${locked?" locked":""}${clickable?" clickable":""}`}
                  onClick={() => clickable && goTo(idx)}>
                  <div className="step-num">
                    {done ? <span className="step-check">✓</span> : <span>{idx + 1}</span>}
                  </div>
                  <div className="step-info">
                    <div className="step-label">{s.label}</div>
                    <div className="step-sub">{
                      done && s.id === "server"   ? wizardData.serverUrl?.replace("http://","") :
                      done && s.id === "nodes"    ? `${(wizardData.serverNodes||[]).filter(n=>n.status==="online").length} online` :
                      done && s.id === "consoles" ? `${(wizardData.addedConsoles||[]).length} added` :
                      done && s.id === "romfolder"? `${wizardData.scanResult?.added||0} ROMs` :
                      done && s.id === "games"    ? `${Object.values(wizardData.addedGames||{}).flat().length} games` :
                      s.sub
                    }</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sidebar-footer">
            <div className="sf-version">ConsoleHub v0.2 · MIT</div>
          </div>
        </div>

        {/* ── Main Panel ── */}
        <div className="panel">
          <div className="panel-header">
            {/* Progress bar */}
            <div className="step-progress">
              {STEPS.map((s, idx) => (
                <div key={s.id} className={`prog-seg${idx < stepIdx || completed.has(s.id)?" done":idx===stepIdx?" current":""}`}/>
              ))}
            </div>

            <div className="panel-title">{
              current.id === "welcome"   ? "Let's get you set up" :
              current.id === "server"    ? "Connect to your server" :
              current.id === "nodes"     ? "Configure your nodes" :
              current.id === "consoles"  ? "Add your consoles" :
              current.id === "romfolder" ? "Set up your ROM library" :
              current.id === "emulators" ? "Configure emulators" :
              current.id === "games"     ? "Build your game library" :
              "You're all set"
            }</div>
            <div className="panel-sub">{
              current.id === "welcome"   ? "We'll walk through server, nodes, consoles, ROMs and emulators. Takes about 5 minutes." :
              current.id === "server"    ? "Enter the IP of your NAS running the ConsoleHub Docker stack." :
              current.id === "nodes"     ? "Nodes are small devices (Wyse 3040, N100) that sit next to each console and capture video." :
              current.id === "consoles"  ? "Assign each physical console to a node. You can always add more later." :
              current.id === "romfolder" ? "Point to the folder on your NAS where ROM files live. We'll index them automatically." :
              current.id === "emulators" ? "Choose which emulators to include in the Docker build. All bundled ones install automatically." :
              current.id === "games"     ? "Add game titles to each console. Paste a list to bulk-import." :
              "ConsoleHub is configured and ready to stream."
            }</div>
          </div>

          <div className="panel-body" ref={bodyRef}>
            {STEP_COMPONENTS[current.id]}
          </div>
        </div>
      </div>
    </>
  );
}
