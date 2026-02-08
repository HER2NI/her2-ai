/*
 * © HER2NI / Steve Black. Proprietary — Evaluation Use Only. No redistribution without permission.
 */
/* telemetry.js — numeric-only, local-only telemetry
   No content storage, no IDs, no hashes, no embeddings.
*/

import { evaluateAuroraWindow } from "./aurora_gates.js";

const SCHEMA_VERSION = 1;

let BUILD_ID = 1;
let SESSION_ID = Math.floor(Math.random() * 1e9);
let MODE = 0; // 0=IDLE, 1=RUN

let WINDOW_SIZE = 120;

// Running summary (Welford)
let turnsTotal = 0;
let sampleN = 0;
let hMean = 0, hM2 = 0, hMin = 1, hMax = 0, hLast = 0;
let sMean = 0, sM2 = 0, sMin = 1, sMax = 0, sLast = 0;
let lockCount = 0;
let graphNodesMean = 0, graphNodesM2 = 0, graphNodesLast = 0;
let graphEdgesMean = 0, graphEdgesM2 = 0, graphEdgesLast = 0;

// Rolling window (numeric only)
let winH = [];
let winS = [];
let winLock = [];
let winNodes = [];
let winEdges = [];

// Ephemeral per-turn arrays (numeric only; never exported)
let winHs = [];
let winChurn = [];
let winDrift = [];
let winCoreJ = [];
let winStateRaw = [];
let winStateDisplay = [];
let winActiveCount = null;
let winEff = null;

function clamp01(v) {
  return Math.max(0, Math.min(1, v || 0));
}

function updateWelford(x, n, mean, m2) {
  const delta = x - mean;
  const mean2 = mean + delta / n;
  const delta2 = x - mean2;
  const m22 = m2 + delta * delta2;
  return [mean2, m22];
}

function windowPush(arr, v) {
  arr.push(v);
  if (arr.length > WINDOW_SIZE) arr.shift();
}

export function initTelemetry(opts = {}) {
  if (typeof opts.build_id === "number") BUILD_ID = opts.build_id;
  if (typeof opts.window_size === "number" && opts.window_size > 1) {
    WINDOW_SIZE = Math.floor(opts.window_size);
  }
}

export function setTelemetryMode(modeNum) {
  MODE = (typeof modeNum === "number") ? modeNum : MODE;
}

export function resetTelemetrySession() {
  SESSION_ID = Math.floor(Math.random() * 1e9);
  turnsTotal = 0;
  sampleN = 0;
  hMean = 0; hM2 = 0; hMin = 1; hMax = 0; hLast = 0;
  sMean = 0; sM2 = 0; sMin = 1; sMax = 0; sLast = 0;
  lockCount = 0;
  graphNodesMean = 0; graphNodesM2 = 0; graphNodesLast = 0;
  graphEdgesMean = 0; graphEdgesM2 = 0; graphEdgesLast = 0;
  winH = [];
  winS = [];
  winLock = [];
  winNodes = [];
  winEdges = [];
  winHs = [];
  winChurn = [];
  winDrift = [];
  winCoreJ = [];
  winStateRaw = [];
  winStateDisplay = [];
  winActiveCount = null;
  winEff = null;
}

export function recordTelemetrySample({
  h,
  s,
  Hs,
  turn_count,
  locked,
  graph_counts,
  churn,
  drift,
  coreJ,
  stateRaw,
  stateDisplay,
  activeCount,
  eff,
} = {}) {
  const hh = clamp01(h);
  const ss = clamp01(s);
  const hsVal = (typeof Hs === "number") ? Hs : hh;
  const lock = locked ? 1 : 0;
  const nodes = Math.max(0, Math.floor(graph_counts?.nodes || 0));
  const edges = Math.max(0, Math.floor(graph_counts?.edges || 0));

  turnsTotal = Math.max(turnsTotal, Math.floor(turn_count || 0));
  sampleN += 1;

  // Summary stats
  hLast = hh;
  sLast = ss;
  if (sampleN > 0) {
    const n = sampleN;
    [hMean, hM2] = updateWelford(hh, n, hMean, hM2);
    [sMean, sM2] = updateWelford(ss, n, sMean, sM2);
    [graphNodesMean, graphNodesM2] = updateWelford(nodes, n, graphNodesMean, graphNodesM2);
    [graphEdgesMean, graphEdgesM2] = updateWelford(edges, n, graphEdgesMean, graphEdgesM2);
  }
  hMin = Math.min(hMin, hh);
  hMax = Math.max(hMax, hh);
  sMin = Math.min(sMin, ss);
  sMax = Math.max(sMax, ss);
  lockCount += lock;
  graphNodesLast = nodes;
  graphEdgesLast = edges;

  // Window stats
  windowPush(winH, hh);
  windowPush(winS, ss);
  windowPush(winLock, lock);
  windowPush(winNodes, nodes);
  windowPush(winEdges, edges);

  // Ephemeral arrays
  windowPush(winHs, (typeof hsVal === "number") ? hsVal : 0);
  windowPush(winChurn, (typeof churn === "number") ? churn : 0);
  windowPush(winDrift, (typeof drift === "number") ? drift : 0);
  windowPush(winCoreJ, (typeof coreJ === "number") ? coreJ : 0);
  windowPush(winStateRaw, (typeof stateRaw === "number") ? stateRaw : 0);
  windowPush(winStateDisplay, (typeof stateDisplay === "number") ? stateDisplay : 0);
  if (typeof activeCount === "number" || winActiveCount) {
    if (!winActiveCount) winActiveCount = [];
    windowPush(winActiveCount, Math.max(0, Math.round(activeCount || 0)));
  }
  if (typeof eff === "number" || winEff) {
    if (!winEff) winEff = [];
    windowPush(winEff, (typeof eff === "number") ? eff : 0);
  }
}

function windowStats(arr) {
  const n = arr.length;
  if (!n) return { n: 0, mean: 0, min: 0, max: 0 };
  let sum = 0, min = arr[0], max = arr[0];
  for (let i = 0; i < n; i++) {
    const v = arr[i];
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { n, mean: sum / n, min, max };
}

export function getWindowCandidates(cfg = {}, seedBase = 0) {
  const n = winHs.length;
  if (n < 2) return [];

  const arrs = {
    Hs: winHs,
    churn: winChurn,
    drift: winDrift,
    coreJ: winCoreJ,
    stateRaw: winStateRaw,
    stateDisplay: winStateDisplay,
  };
  if (winActiveCount) arrs.activeCount = winActiveCount;
  if (winEff) arrs.eff = winEff;

  const L = Math.max(1, cfg.AURORA_L_MIN ?? Math.min(40, WINDOW_SIZE));
  const out = [];

  let i = 0;
  while (i < n) {
    if ((winStateRaw[i] | 0) !== 2) {
      i++;
      continue;
    }
    const segStart = i;
    while (i < n && (winStateRaw[i] | 0) === 2) i++;
    const segEnd = i - 1;
    const segLen = segEnd - segStart + 1;

    if (segLen >= L) {
      const s = segStart;
      const e0 = s + L - 1;
      const seed0 = (seedBase || 0) + (SESSION_ID ^ (s * 131 + e0 * 31));
      const w0 = evaluateAuroraWindow(arrs, s, e0, cfg, seed0);
      if (w0 && w0.qualified) {
        if (cfg.AURORA_GROW_TO_SEG_END) {
          const e1 = segEnd;
          const seed1 = (seedBase || 0) + (SESSION_ID ^ (s * 131 + e1 * 31 + 1));
          const w1 = evaluateAuroraWindow(arrs, s, e1, cfg, seed1);
          if (w1 && w1.qualified) out.push(w1);
          else out.push(w0);
        } else {
          out.push(w0);
        }
      }
    }
  }

  return out;
}

export function getTelemetrySnapshot() {
  const hWin = windowStats(winH);
  const sWin = windowStats(winS);
  const lockWin = windowStats(winLock);
  const nodesWin = windowStats(winNodes);
  const edgesWin = windowStats(winEdges);

  return {
    schema_version: SCHEMA_VERSION,
    build_id: BUILD_ID,
    mode: MODE,
    session: SESSION_ID,
    summary_exportable: {
      turns_total: turnsTotal,
      h_last: hLast,
      h_mean: hMean,
      h_min: (turnsTotal ? hMin : 0),
      h_max: (turnsTotal ? hMax : 0),
      s_last: sLast,
      s_mean: sMean,
      s_min: (turnsTotal ? sMin : 0),
      s_max: (turnsTotal ? sMax : 0),
      lock_ratio: (turnsTotal ? (lockCount / turnsTotal) : 0),
      graph_nodes_last: graphNodesLast,
      graph_edges_last: graphEdgesLast,
      graph_nodes_mean: graphNodesMean,
      graph_edges_mean: graphEdgesMean
    },
    window_candidates_exportable: {
      window_size: WINDOW_SIZE,
      window_filled: hWin.n,
      h_mean: hWin.mean,
      h_min: hWin.min,
      h_max: hWin.max,
      s_mean: sWin.mean,
      s_min: sWin.min,
      s_max: sWin.max,
      lock_ratio: (lockWin.n ? (lockWin.mean) : 0),
      graph_nodes_mean: nodesWin.mean,
      graph_nodes_min: nodesWin.min,
      graph_nodes_max: nodesWin.max,
      graph_edges_mean: edgesWin.mean,
      graph_edges_min: edgesWin.min,
      graph_edges_max: edgesWin.max
    }
  };
}
