import { WebView } from "react-native-webview";
import { useState } from "react";
import {
  StyleSheet, View, Text, ScrollView, StatusBar, Platform, TouchableOpacity,
} from "react-native";

// ---- EDIT THIS ----
// Phone IS the host (proroot/Termux), so talk to it over loopback. 127.0.0.1 never
// breaks when WiFi reconnects/roams (a LAN IP like 10.108.123.51 goes stale on drop).
const HOST = "127.0.0.1";
// -------------------

// One bot = one ws_bridge port. The agent only spawns when you connect to it.
const BOTS = [
  { name: "AGY", port: 8765, hint: "Antigravity CLI" },
  { name: "CODEX", port: 8766, hint: "OpenAI Codex CLI" },
  { name: "QODER", port: 8767, hint: "Qoder CLI" },
  { name: "SHELL", port: 8768, hint: "bash login" },
  { name: "MANUS", port: 8769, hint: "OpenManus — needs API key" },
];

function buildHtml(port: number): string {
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.min.css">
<style>
  html,body{margin:0;height:100%;background:#070709;}
  #wrap{display:flex;flex-direction:column;height:100%;}
  #term{flex:1;min-height:0;}
  #bar{display:flex;gap:6px;padding:6px;background:#121216;overflow-x:auto;
       border-top:1px solid #23232b;-webkit-overflow-scrolling:touch;}
  .k{flex:0 0 auto;padding:10px 12px;background:#1c1c24;color:#fff;border-radius:6px;
     font:700 13px/1 monospace;border:none;min-width:44px;}
  .k.on{background:#30d158;color:#000;}
  .k.active{background:#5b5b66;color:#fff;}
  .k:active{background:#5b5b66;}
  #status{color:#8e8e93;font:11px/1 monospace;padding:4px 8px;background:#0b0b0e;}
</style>
</head><body>
<div id="wrap">
  <div id="status">connecting…</div>
  <div id="term"></div>
  <div id="bar">
    <button class="k" data-key="tab">TAB</button>
    <button class="k" data-key="esc">ESC</button>
    <button class="k" id="ctrl">CTRL</button>
    <button class="k" data-key="up">▲</button>
    <button class="k" data-key="down">▼</button>
    <button class="k" data-key="right">▶</button>
    <button class="k" data-key="left">◀</button>
    <button class="k" data-key="c">^C</button>
    <button class="k" data-key="d">^D</button>
    <button class="k" data-key="l">^L</button>
    <button class="k" id="kb">KEYS</button>
  </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/lib/xterm.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.min.js"></script>
<script>
const HOST="${HOST}", PORT=${port};
const statusEl=document.getElementById("status");
const term=new Terminal({cursorBlink:true,theme:{background:"#070709",foreground:"#d4d4d4"},
  fontSize:13,fontFamily:"monospace",scrollback:5000});
term.loadAddon(new FitAddon.FitAddon());
term.open(document.getElementById("term"));
let ws, ctrl=false;
const E=String.fromCharCode(27);
const KEYS={
  tab:String.fromCharCode(9), esc:E,
  up:E+"[A", down:E+"[B", right:E+"[C", left:E+"[D",
  c:String.fromCharCode(3), d:String.fromCharCode(4), l:String.fromCharCode(12)
};
const CTRL_KEYS={
  up:E+"[1;5A", down:E+"[1;5B", right:E+"[1;5C", left:E+"[1;5D", tab:E+"[27;5;9~"
};

function fit(){ try{term.fit();}catch(e){} return term.cols+","+term.rows; }
function sendRaw(s){ if(ws&&ws.readyState===1) ws.send(s); }
function sendResize(){ if(ws&&ws.readyState===1) ws.send(JSON.stringify({type:"resize",rows:term.rows,cols:term.cols})); }

function connect(){
  statusEl.textContent="connecting to ws://"+HOST+":"+PORT+" …";
  ws=new WebSocket("ws://"+HOST+":"+PORT);
  ws.onopen=()=>{ statusEl.textContent="connected "+fit(); sendResize(); };
  ws.onmessage=e=>{ term.write(typeof e.data==="string"?e.data:new TextDecoder().decode(e.data)); };
  ws.onclose=()=>{ statusEl.textContent="closed — retry in 2s"; setTimeout(connect,2000); };
  ws.onerror=()=>{ statusEl.textContent="error"; };
  term.onData(d=>{
    if(ctrl){ const c=d.toUpperCase().charCodeAt(0); if(c>=65&&c<=90){ sendRaw(String.fromCharCode(c-64)); setCtrl(false); return; } }
    sendRaw(d);
  });
  term.onResize?.(()=>{ sendResize(); });
}

function setCtrl(v){ ctrl=v; const b=document.getElementById("ctrl"); if(b) b.classList.toggle("on",v); }
function flash(b){ b.classList.add("active"); setTimeout(()=>b.classList.remove("active"),120); }
function press(name){
  let s;
  if(ctrl && CTRL_KEYS[name]) s=CTRL_KEYS[name]; else s=KEYS[name];
  if(s){ sendRaw(s); if(ctrl) setCtrl(false); }
  term.focus();
}
function bind(el,fn){ if(el) el.addEventListener("pointerdown",e=>{ e.preventDefault(); fn(e); }); }
document.querySelectorAll("[data-key]").forEach(b=>{
  const name=b.getAttribute("data-key");
  bind(b,()=>{ flash(b); press(name); });
});
bind(document.getElementById("ctrl"),()=>setCtrl(!ctrl));
bind(document.getElementById("kb"),()=>{ term.focus(); });
window.addEventListener("resize",()=>{ fit(); sendResize(); });
connect();
</script>
</body></html>`;
}

export default function App() {
  const [sel, setSel] = useState(0);
  const bot = BOTS[sel];
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabs}
        contentContainerStyle={styles.tabRow}
      >
        {BOTS.map((b, i) => (
          <TouchableOpacity
            key={b.name}
            onPress={() => setSel(i)}
            style={[styles.tab, i === sel && styles.tabOn]}
          >
            <Text style={[styles.tabText, i === sel && styles.tabTextOn]}>{b.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={styles.hint} numberOfLines={1}>
        {bot.hint} · ws://{HOST}:{bot.port}
      </Text>
      <WebView
        key={bot.port}
        originWhitelist={["*"]}
        source={{ html: buildHtml(bot.port), baseUrl: `http://${HOST}:${bot.port}` }}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mixedContentMode="always"
        webviewDebuggingEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#070709",
    // Clear the Android status bar / notch so the tabs are tappable, with a little breathing room.
    paddingTop: (Platform.OS === "android" ? (StatusBar.currentHeight ?? 28) : 54) + 12,
  },
  tabs: { backgroundColor: "#0d0d12", flexGrow: 0 },
  tabRow: { gap: 8, padding: 10 },
  tab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18,
    backgroundColor: "#1c1c24", borderWidth: 1, borderColor: "#2a2a33",
  },
  tabOn: { backgroundColor: "#7c3aed", borderColor: "#a855f7" },
  tabText: { color: "#c9c9d1", fontWeight: "700", fontSize: 13, fontFamily: "monospace" },
  tabTextOn: { color: "#ffffff" },
  hint: { color: "#8e8e93", fontSize: 11, fontFamily: "monospace", paddingHorizontal: 12, paddingBottom: 4 },
  web: { flex: 1, backgroundColor: "#070709" },
});
