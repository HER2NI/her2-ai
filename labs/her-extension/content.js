// content.js — H.E.R extension injector + turn extractor + FREE_TURNS gate

const PANEL_W = 380;
const IFRAME_ID = "her-crystal-lens-iframe";

// Monetization gate
const FREE_TURNS = 30;
const UNLOCK_KEY = "her_unlocked";

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

// Push ChatGPT UI left so the panel doesn’t overlap it
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

let collapsed = false;

function setCollapsed(on) {
  const iframe = document.getElementById(IFRAME_ID);
  if (!iframe) return;
  collapsed = on;
  iframe.style.width = on ? "44px" : `${PANEL_W}px`;
  pushLayout(on ? 44 : PANEL_W);
}

// Extract turn blocks with resilient heuristics
function extractTurnsRaw() {
  // ChatGPT DOM changes often. This is intentionally heuristic.
  const candidates = Array.from(
    document.querySelectorAll(
      "main [data-message-author-role], main article, main section"
    )
  );

  const turns = [];
  for (const el of candidates) {
    const txt = (el.innerText || "").trim();
    if (!txt) continue;

    let role = "unknown";
    const roleAttr = el.getAttribute("data-message-author-role");
    if (roleAttr) role = roleAttr; // "user" / "assistant" when present

    turns.push({ role, text: txt });
  }

  // De-dup consecutive identicals
  const dedup = [];
  for (const t of turns) {
    if (!dedup.length || dedup[dedup.length - 1].text !== t.text) dedup.push(t);
  }

  // Keep a reasonable history window to avoid huge payloads
  return dedup.slice(-120);
}

// Apply FREE_TURNS gate (but keep rendering alive)
function extractTurnsGated() {
  const all = extractTurnsRaw();
  const unlocked = localStorage.getItem(UNLOCK_KEY) === "true";

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

// Update cadence: fast enough to feel live, not too heavy
setInterval(sendToPanel, 900);