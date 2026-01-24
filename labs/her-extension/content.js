const PANEL_W = 380;
const IFRAME_ID = "her-crystal-lens-iframe";

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
    background: "transparent"
  });
  document.body.appendChild(iframe);

  // prevent covering the chat UI
  document.documentElement.style.paddingRight = `${PANEL_W}px`;
}

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

pushLayout(380);

let collapsed = false;

function setCollapsed(on) {
  const iframe = document.getElementById(IFRAME_ID);
  if (!iframe) return;
  collapsed = on;

  iframe.style.width = on ? "44px" : `${PANEL_W}px`;
  pushLayout(on ? 44 : PANEL_W);
}

function extractTurns() {
  // SAFEST approach: grab message-like blocks and label them heuristically.
  // ChatGPT DOM changes often, so we use resilient heuristics.
  const candidates = Array.from(document.querySelectorAll("main [data-message-author-role], main article, main section"));

  const turns = [];
  for (const el of candidates) {
    const txt = (el.innerText || "").trim();
    if (!txt) continue;

    let role = "unknown";
    const roleAttr = el.getAttribute("data-message-author-role");
    if (roleAttr) role = roleAttr; // "user" / "assistant" on some builds
    else {
      // heuristic: if block contains "You" label is unreliable; keep unknown
      role = "unknown";
    }

    turns.push({ role, text: txt });
  }

  // De-dup consecutive identicals
  const dedup = [];
  for (const t of turns) {
    if (!dedup.length || dedup[dedup.length - 1].text !== t.text) dedup.push(t);
  }
  return dedup.slice(-30); // last N turns
}

function sendToPanel() {
  const iframe = document.getElementById(IFRAME_ID);
  if (!iframe?.contentWindow) return;
  iframe.contentWindow.postMessage(
    { type: "HER_TURNS", turns: extractTurns(), ts: Date.now() },
    "*"
  );
}

injectPanel();
setInterval(sendToPanel, 900);