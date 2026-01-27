// panel.js — receives turns from content.js and drives H.E.R core + lock overlay

import { initHER, updateHERFromTurns } from "./her_core.js";

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

  const el = ensureLockOverlay();
  el.style.display = "block";

  el.innerHTML = `
    <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap;">
      <div>
        <div style="font-weight:800; letter-spacing:.08em; text-transform:uppercase; font-size:11px; opacity:.95;">
          Free limit reached
        </div>
        <div style="margin-top:6px; font-size:12px; line-height:1.4; color:rgba(160,174,192,.95);">
          H.E.R shows the first <strong style="color:#e5e7eb">${freeTurns}</strong> turns.
          Unlock to see resonance evolve continuously.
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
      ">Unlock</button>
    </div>
  `;

  const btn = document.getElementById("btnUnlockHER");
  if (btn) {
    btn.onclick = () => {
      // DEV unlock (replace later with Stripe success)
      localStorage.setItem(UNLOCK_KEY, "true");
      el.style.display = "none";
    };
  }
}

function hideLockCTA() {
  if (!lockEl) return;
  lockEl.style.display = "none";
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

  if (turnTag) turnTag.textContent = `Turns: ${data.totalTurns ?? turns.length}`;

  // Lock overlay if we’re gated
  if (data.locked) showLockCTA(data.freeTurns ?? 30, data.totalTurns ?? turns.length);
  else hideLockCTA();
});