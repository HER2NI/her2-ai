import { initHER, updateHERFromTurns } from "./her_core.js";

const canvas = document.getElementById("crystal");
const stateTag = document.getElementById("stateTag");
const hsTag = document.getElementById("hsTag");
const turnTag = document.getElementById("turnTag");
const memTag = document.getElementById("memTag"); // if you add it later

// init core once
initHER({
  canvas,
  hud: { stateTag, hsTag, turnTag, memTag }
});

window.addEventListener("message", (ev) => {
  const data = ev.data;
  if (!data || data.type !== "HER_TURNS") return;
  const turns = data.turns || [];
  updateHERFromTurns(turns);
  if (turnTag) turnTag.textContent = `Turns: ${turns.length}`;
});