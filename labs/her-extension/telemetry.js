/*
 * Public stub — Labs demo only.
 * Numeric-only, local-only placeholders.
 * No exports of per-turn arrays. No gating. No scoring.
 */

let MODE = 0;
let SESSION_ID = Math.floor(Math.random() * 1e9);
let BUILD_ID = 1;

export function initTelemetry(opts = {}) {
  if (typeof opts.build_id === "number") BUILD_ID = opts.build_id;
}

export function setTelemetryMode(modeNum) {
  if (typeof modeNum === "number") MODE = modeNum;
}

export function resetTelemetrySession() {
  SESSION_ID = Math.floor(Math.random() * 1e9);
}

export function recordTelemetrySample() {
  // no-op in public demo
}

export function getWindowCandidates() {
  return []; // gating disabled in public demo
}

export function getTelemetrySnapshot() {
  return {
    schema_version: 1,
    build_id: BUILD_ID,
    mode: MODE,
    session: SESSION_ID,
    summary_exportable: {
      note: "Public demo build: telemetry disabled.",
    },
    window_candidates_exportable: {
      note: "Public demo build: telemetry disabled.",
    },
  };
}
