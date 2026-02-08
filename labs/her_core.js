/*
 * © HER2NI / Steve Black. Proprietary — Evaluation Use Only. No redistribution without permission.
 *
 * Labs renderer uses the same core as the extension for visual parity.
 * No extension APIs, capture logic, injection listeners, or telemetry export are wired here.
 */

export {
  initHER,
  updateHERFromTurns,
  setHERLocked,
  getGraphCounts,
  getStateRaw,
} from "./her-extension/her_core.js";
