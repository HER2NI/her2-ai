/*
 * © HER2NI / Steve Black. Proprietary — Evaluation Use Only. No redistribution without permission.
 */
// labs.js — H.E.R-Crystal v0.2 (manual demo controller)

import { recordWebM, downloadBlob } from "./recorder.js";

/** ---------------------------
 *  DOM
 * -------------------------- */
const el = {
  input: document.getElementById("chatInput"),
  btnRender: document.getElementById("btnRender"),
  btnIdle: document.getElementById("btnIdle"),
  btnExport: document.getElementById("btnExport"),
  panelFrame: document.getElementById("herPanelFrame"),
  labelMode: document.getElementById("labelMode"),
  memoryInfluence: document.getElementById("memoryInfluence"),
  memoryVal: document.getElementById("memoryVal"),
  geoDensity: document.getElementById("geoDensity"),
  geoVal: document.getElementById("geoVal"),
  t1: document.getElementById("t1"),
  t2: document.getElementById("t2"),
  hys: document.getElementById("hys"),
  autoExportToggle: document.getElementById("autoExportToggle"),
};

const customWrap = document.getElementById("customLabelWrap");
const customInput = document.getElementById("customLabel");

/** ---------------------------
 *  Runtime state
 * -------------------------- */
const sessionId = makeSessionId();
let turnsCache = [];
let turnsDirty = true;
const POST_INTERVAL_MS = 900;

/** ---------------------------
 *  UI bindings
 * -------------------------- */
el.memoryInfluence.addEventListener("input", () => {
  el.memoryVal.textContent = Number(el.memoryInfluence.value).toFixed(2);
});
el.geoDensity.addEventListener("input", () => {
  el.geoVal.textContent = Number(el.geoDensity.value).toFixed(2);
});
el.memoryVal.textContent = Number(el.memoryInfluence.value).toFixed(2);
el.geoVal.textContent = Number(el.geoDensity.value).toFixed(2);

el.btnIdle.addEventListener("click", () => {
  turnsCache = [];
  turnsDirty = false;
  postTurns();
});

el.btnRender.addEventListener("click", () => {
  refreshTurnsFromInput();
  turnsDirty = false;
  postTurns();
});

el.btnExport.addEventListener("click", async () => {
  try {
    const canvas = getPanelCanvas();
    if (!canvas) throw new Error("Panel not ready yet.");
    const blob = await recordWebM(canvas, 8000, 30);
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
    downloadBlob(blob, `HER-Crystal_${stamp}.webm`);
  } catch (e) {
    alert(`Export failed: ${e.message}`);
  }
});

// Label controls
el.labelMode.addEventListener("change", () => {
  if (!customWrap) return;
  const on = (el.labelMode.value === "CUSTOM");
  customWrap.style.visibility = on ? "visible" : "hidden";
  customWrap.setAttribute("aria-hidden", on ? "false" : "true");
});
if (customWrap) {
  const on = (el.labelMode.value === "CUSTOM");
  customWrap.style.visibility = on ? "visible" : "hidden";
  customWrap.setAttribute("aria-hidden", on ? "false" : "true");
}
if (el.input) {
  el.input.addEventListener("input", () => {
    turnsDirty = true;
  });
}

/** ---------------------------
 *  Content.js simulator (postMessage)
 * -------------------------- */
setInterval(() => {
  if (turnsDirty) {
    refreshTurnsFromInput();
    turnsDirty = false;
  }
  postTurns();
}, POST_INTERVAL_MS);

postTurns();

/** ---------------------------
 *  Parsing (v0: User:/Assistant:)
 * -------------------------- */
function parseTranscript(text) {
  const lines = text.split(/\r?\n/);
  const turns = [];
  let cur = null;

  const push = () => {
    if (cur && cur.text.trim().length > 0) turns.push(cur);
    cur = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const m = line.match(/^(User|Assistant)\s*:\s*(.*)$/i);
    if (m) {
      push();
      cur = { role: m[1].toLowerCase(), text: m[2] || "" };
    } else {
      if (!cur) cur = { role: "user", text: "" };
      cur.text += (cur.text.length ? "\n" : "") + line;
    }
  }
  push();
  return { turns: turns.filter(t => t.text.trim().length > 0) };
}

/** ---------------------------
 *  Helpers
 * -------------------------- */
function refreshTurnsFromInput() {
  const text = el.input?.value || "";
  const parsed = parseTranscript(text);
  turnsCache = parsed.turns;
}

function postTurns() {
  const win = el.panelFrame?.contentWindow;
  if (!win) return;
  win.postMessage({
    type: "HER_TURNS",
    session_id: sessionId,
    turns: turnsCache,
    locked: false,
    totalTurns: turnsCache.length,
    freeTurns: 30,
    ts: Date.now(),
  }, "*");
}

function getPanelCanvas() {
  const doc = el.panelFrame?.contentWindow?.document;
  return doc ? doc.getElementById("crystal") : null;
}

function makeSessionId() {
  const base = Math.random().toString(36).slice(2, 10);
  return `labs-${Date.now().toString(36)}-${base}`;
}
