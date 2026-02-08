/*
 * © HER2NI / Steve Black. Proprietary — Evaluation Use Only. No redistribution without permission.
 */
// content.js — H.E.R extension injector + turn extractor + FREE_TURNS gate

if (window.__HER_CONTENT_RUNNING__) {
  console.debug("HER content already running");
} else {
  window.__HER_CONTENT_RUNNING__ = true;

  const PANEL_W = 380;
  const IFRAME_ID = "her-crystal-lens-iframe";

  const SESSION_ID =
    (globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  // Monetization gate
  const FREE_TURNS = 30;
  const UNLOCK_KEY = "her_unlocked";

  // Unlock state must be shared across extension contexts (content script + iframe)
  let unlocked = false;
  try {
    chrome.storage.local.get([UNLOCK_KEY], (res) => {
      unlocked = res && res[UNLOCK_KEY] === true;
    });
  } catch {}

  // Listen for unlock signal from panel iframe
  window.addEventListener("message", (ev) => {
    if (!ev?.data || ev.data.type !== "HER_UNLOCK") return;
    unlocked = true;
    try { chrome.storage.local.set({ [UNLOCK_KEY]: true }); } catch {}
  });

  function pushLayout(widthPx) {
    const id = "her-push-style";
    let style = document.getElementById(id);
    if (!style) {
      style = document.createElement("style");
      style.id = id;
      document.head.appendChild(style);
    }
    style.textContent = `
      html { padding-right: ${widthPx}px !important; }
      body { padding-right: ${widthPx}px !important; }
      main { padding-right: ${widthPx}px !important; }
    `;
  }

  function injectPanel() {
    if (document.getElementById(IFRAME_ID)) return;

    const iframe = document.createElement("iframe");
    iframe.id = IFRAME_ID;
    iframe.src = chrome.runtime.getURL("panel.html");

    Object.assign(iframe.style, {
      position: "fixed",
      top: "0",
      right: "0",
      width: `${PANEL_W}px`,
      height: "100vh",
      zIndex: "999999",
      border: "0",
      background: "transparent",
    });

    document.body.appendChild(iframe);
    pushLayout(PANEL_W);
  }

  function extractTurnsRaw() {
    const primary = Array.from(
      document.querySelectorAll('[data-message-author-role]')
    );
    const candidates = primary.length
      ? primary
      : Array.from(document.querySelectorAll("main article, main section"));

    const seen = new Set();
    const turns = [];

    for (const el of candidates) {
      const txt = (el.innerText || "").trim();
      if (!txt) continue;

      const roleAttr = el.getAttribute("data-message-author-role") || "unknown";
      const msgId =
        el.getAttribute("data-message-id") ||
        el.dataset?.messageId ||
        null;

      const key = msgId ? `id:${msgId}` : `rt:${roleAttr}::${txt}`;
      if (seen.has(key)) continue;
      seen.add(key);

      turns.push({ role: roleAttr, text: txt });
    }

    return turns.slice(-120);
  }

  function extractTurnsGated() {
    const all = extractTurnsRaw();

    if (!unlocked && all.length > FREE_TURNS) {
      return {
        turns: all.slice(0, FREE_TURNS),
        locked: true,
        totalTurns: all.length,
        freeTurns: FREE_TURNS,
      };
    }

    return {
      turns: all,
      locked: false,
      totalTurns: all.length,
      freeTurns: FREE_TURNS,
    };
  }

  function sendToPanel() {
    const iframe = document.getElementById(IFRAME_ID);
    if (!iframe?.contentWindow) return;

    const payload = extractTurnsGated();

    iframe.contentWindow.postMessage(
      {
        type: "HER_TURNS",
        session_id: SESSION_ID,
        turns: payload.turns,
        locked: payload.locked,
        totalTurns: payload.totalTurns,
        freeTurns: payload.freeTurns,
        ts: Date.now(),
      },
      "*"
    );
  }

  injectPanel();

  window.addEventListener("message", (ev) => {
    if (ev?.data?.type !== "HER_UNLOCK") return;
    localStorage.setItem(UNLOCK_KEY, "true");
    const iframe = document.getElementById(IFRAME_ID);
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: "HER_UNLOCK_ACK", unlocked: true }, "*");
    }
    sendToPanel();
  });

  // Start loop once
  if (!window.__HER_INTERVAL_ID__) {
    window.__HER_INTERVAL_ID__ = setInterval(sendToPanel, 900);
  }
}
