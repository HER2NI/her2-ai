// panel.js — receives turns from content.js and drives H.E.R core + lock overlay

import { initHER, updateHERFromTurns, setHERLocked } from "./her_core.js";

const canvas = document.getElementById("crystal");
const stateTag = document.getElementById("stateTag");
const hsTag = document.getElementById("hsTag");
const turnTag = document.getElementById("turnTag");
const memTag = document.getElementById("memTag");

const btnExport = document.getElementById("btnExport");
const autoExport = document.getElementById("autoExport");

// We’ll create a lock overlay dynamically (no HTML edits required)
const UNLOCK_KEY = "her_unlocked";

let lockEl = null;

let lockModalEl = null;
let lockShownOnce = false;
let lastLocked = false;

function ensureLockModal() {
  if (lockModalEl) return lockModalEl;

  lockModalEl = document.createElement("div");
  lockModalEl.id = "herLockModal";
  lockModalEl.style.position = "fixed";
  lockModalEl.style.left = "0";
  lockModalEl.style.top = "0";
  lockModalEl.style.right = "0";
  lockModalEl.style.bottom = "0";
  lockModalEl.style.zIndex = "999";
  lockModalEl.style.display = "none";
  lockModalEl.style.background = "rgba(0,0,0,0.70)";
  lockModalEl.style.backdropFilter = "blur(10px)";
  lockModalEl.style.padding = "18px";
  lockModalEl.style.boxSizing = "border-box";

  lockModalEl.innerHTML = `
    <div style="
      max-width: 520px;
      margin: 10vh auto 0 auto;
      border: 1px solid rgba(255,255,255,0.10);
      border-radius: 18px;
      background: radial-gradient(circle at top, rgba(79,209,197,0.12), rgba(2,3,9,0.92));
      box-shadow: 0 28px 80px rgba(0,0,0,0.75);
      padding: 16px 16px 14px 16px;
      color: rgba(229,231,235,0.98);
      font-family: system-ui,-apple-system,Segoe UI,sans-serif;
    ">
      <div style="font-weight:900; letter-spacing:.18em; text-transform:uppercase; font-size:11px; color: rgba(79,209,197,0.95);">
        H.E.R — Free limit reached
      </div>

      <div style="margin-top:10px; font-size:14px; line-height:1.5; color: rgba(229,231,235,0.95);">
        H.E.R shows the first <strong>__FREE_TURNS__</strong> turns.
        Unlock to see resonance evolve continuously during live chat.
      </div>

      <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <button id="btnUnlockHER_MODAL" style="
          cursor:pointer;
          border-radius:999px;
          border:1px solid rgba(79,209,197,.55);
          background:rgba(79,209,197,.16);
          color:#e0fdf7;
          padding:10px 14px;
          text-transform:uppercase;
          font-size:11px;
          letter-spacing:.10em;
          font-weight:800;
        ">Unlock</button>

        <button id="btnNotNowHER_MODAL" style="
          cursor:pointer;
          border-radius:999px;
          border:1px solid rgba(255,255,255,.16);
          background:rgba(15,23,42,.55);
          color:rgba(229,231,235,0.85);
          padding:10px 14px;
          text-transform:uppercase;
          font-size:11px;
          letter-spacing:.10em;
          font-weight:700;
        ">Not now</button>
      </div>

      <div style="margin-top:10px; font-size:12px; color: rgba(160,174,192,0.95); line-height:1.45;">
        Runs locally. No chat content is stored or transmitted.
      </div>
    </div>
  `;

  document.body.appendChild(lockModalEl);

  // click outside closes
  lockModalEl.addEventListener("click", (e) => {
    if (e.target === lockModalEl) lockModalEl.style.display = "none";
  });

  return lockModalEl;
}

function ensureLockOverlay() {
  if (lockEl) return lockEl;

  lockEl = document.createElement("div");
  lockEl.id = "herLockOverlay";
  lockEl.style.position = "absolute";
  lockEl.style.left = "0";
  lockEl.style.right = "0";
  lockEl.style.bottom = "0";
  lockEl.style.padding = "12px";
  lockEl.style.background =
    "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.72) 45%, rgba(0,0,0,0.85) 100%)";
  lockEl.style.backdropFilter = "blur(10px)";
  lockEl.style.borderTop = "1px solid rgba(255,255,255,0.08)";
  lockEl.style.color = "rgba(229,231,235,0.95)";
  lockEl.style.fontFamily =
    "system-ui,-apple-system,Segoe UI,sans-serif";
  lockEl.style.zIndex = "50";
  lockEl.style.display = "none";

  // Make sure wrap is relative so absolute overlay anchors correctly
  const wrap = document.querySelector(".wrap");
  if (wrap) {
    wrap.style.position = "relative";
  }

  // Insert overlay after canvas so it sits above bottom area
  const canvasEl = document.getElementById("crystal");
  if (canvasEl && canvasEl.parentElement) {
    canvasEl.parentElement.appendChild(lockEl);
  } else if (wrap) {
    wrap.appendChild(lockEl);
  }

  return lockEl;
}

function showLockCTA(freeTurns, totalTurns) {
  const unlocked = localStorage.getItem(UNLOCK_KEY) === "true";
  if (unlocked) return;

  // Bottom strip (persistent)
  const el = ensureLockOverlay();
  el.style.display = "block";

  el.innerHTML = `
    <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap;">
      <div>
        <div style="font-weight:800; letter-spacing:.08em; text-transform:uppercase; font-size:11px; opacity:.95;">
          Free limit reached
        </div>
        <div style="margin-top:6px; font-size:12px; line-height:1.4; color:rgba(160,174,192,.95);">
          Showing first <strong style="color:#e5e7eb">${freeTurns}</strong> turns.
          Unlock to continue.
        </div>
      </div>

      <button id="btnUnlockHER" style="
        cursor:pointer;
        border-radius:999px;
        border:1px solid rgba(79,209,197,.45);
        background:rgba(79,209,197,.14);
        color:#e0fdf7;
        padding:8px 12px;
        text-transform:uppercase;
        font-size:11px;
        letter-spacing:.08em;
        font-weight:800;
      ">Unlock</button>
    </div>
  `;

  const hookUnlock = () => {
    localStorage.setItem(UNLOCK_KEY, "true");   // DEV unlock
    el.style.display = "none";
    if (lockModalEl) lockModalEl.style.display = "none";
  };

  const btn = document.getElementById("btnUnlockHER");
  if (btn) btn.onclick = hookUnlock;

  // Modal (only once per lock event)
  if (!lockShownOnce) {
    lockShownOnce = true;
    const modal = ensureLockModal();

    modal.innerHTML = modal.innerHTML.replace("__FREE_TURNS__", String(freeTurns));

    modal.style.display = "block";

    const btnU = document.getElementById("btnUnlockHER_MODAL");
    const btnN = document.getElementById("btnNotNowHER_MODAL");

    if (btnU) btnU.onclick = hookUnlock;
    if (btnN) btnN.onclick = () => (modal.style.display = "none");
  }
}

function hideLockCTA() {
  if (lockEl) lockEl.style.display = "none";
  if (lockModalEl) lockModalEl.style.display = "none";
  lockShownOnce = false;
}

// init core once
initHER({
  canvas,
  hud: { stateTag, hsTag, turnTag, memTag },
});

// Listen for turns pushed from content script
window.addEventListener("message", (ev) => {
  const data = ev.data;
  if (!data || data.type !== "HER_TURNS") return;

  const turns = data.turns || [];
  updateHERFromTurns(turns);

  const isLocked = !!data.locked;
  setHERLocked(isLocked);

  // 🔒 Show modal ONCE, at the moment lock is first hit
  if (isLocked && !lockShownOnce) {
    ensureLockModal();
    lockModalEl.style.display = "block";
    lockShownOnce = true;
  }

  if (turnTag) {
    turnTag.textContent = isLocked
      ? `TURNS: ${data.freeTurns}`
      : `TURNS: ${data.totalTurns ?? turns.length}`;
  }

  if (isLocked) {
    showLockCTA(data.freeTurns ?? 30, data.totalTurns ?? turns.length);
  } else {
    hideLockCTA();
  }

  lastLocked = isLocked;
});