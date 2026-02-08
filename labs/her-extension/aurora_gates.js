/*
 * © HER2NI / Steve Black. Proprietary — Evaluation Use Only. No redistribution without permission.
 */
/* aurora_gates.js — numeric-only, local-only gate functions
   No content, no IDs, no embeddings, no per-turn exports.
*/

function clampIndex(n, i) {
  if (n <= 0) return 0;
  const ii = Math.floor(i);
  return Math.max(0, Math.min(n - 1, ii));
}

function windowBounds(arr, s, e) {
  const n = Array.isArray(arr) ? arr.length : 0;
  if (n <= 0) return { s: 0, e: -1, n };
  const ss = clampIndex(n, s);
  const ee = clampIndex(n, e);
  if (ee < ss) return { s: 0, e: -1, n };
  return { s: ss, e: ee, n };
}

export function windowMeanVar(arr, s, e) {
  const b = windowBounds(arr, s, e);
  if (b.e < b.s) return { mean: 0, var: 0 };
  let mean = 0;
  let m2 = 0;
  let count = 0;
  for (let i = b.s; i <= b.e; i++) {
    const x = arr[i] || 0;
    count += 1;
    const delta = x - mean;
    mean += delta / count;
    const delta2 = x - mean;
    m2 += delta * delta2;
  }
  const variance = (count > 1) ? (m2 / (count - 1)) : 0;
  return { mean, var: variance };
}

export function windowMax(arr, s, e) {
  const b = windowBounds(arr, s, e);
  if (b.e < b.s) return 0;
  let max = arr[b.s] || 0;
  for (let i = b.s + 1; i <= b.e; i++) {
    const v = arr[i] || 0;
    if (v > max) max = v;
  }
  return max;
}

export function windowMin(arr, s, e) {
  const b = windowBounds(arr, s, e);
  if (b.e < b.s) return 0;
  let min = arr[b.s] || 0;
  for (let i = b.s + 1; i <= b.e; i++) {
    const v = arr[i] || 0;
    if (v < min) min = v;
  }
  return min;
}

export function mulberry32(seed) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6D2B79F5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function makePermutation(n, rng) {
  const perm = new Array(n);
  for (let i = 0; i < n; i++) perm[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
  }
  return perm;
}

export function applyPerm(src, perm) {
  const out = new Array(perm.length);
  for (let i = 0; i < perm.length; i++) out[i] = src[perm[i]];
  return out;
}

function inferLength(arrs) {
  for (const k in arrs) {
    if (Array.isArray(arrs[k])) return arrs[k].length;
  }
  return 0;
}

function permuteArrs(arrs, perm) {
  const out = {};
  for (const k in arrs) {
    const arr = arrs[k];
    if (Array.isArray(arr) && arr.length === perm.length) {
      out[k] = applyPerm(arr, perm);
    } else {
      out[k] = arr;
    }
  }
  return out;
}

function windowScoreNumeric(arrs, s, e, cfg) {
  const core = windowMeanVar(arrs.coreJ || [], s, e).mean;
  const churn = windowMeanVar(arrs.churn || [], s, e).mean;
  const drift = windowMeanVar(arrs.drift || [], s, e).mean;
  const eff = windowMeanVar(arrs.eff || [], s, e).mean;
  const activeMin = Array.isArray(arrs.activeCount)
    ? windowMin(arrs.activeCount, s, e)
    : 0;

  const wCore = cfg.AURORA_SCORE_CORE_W ?? 1000;
  const wChurn = cfg.AURORA_SCORE_CHURN_W ?? 1000;
  const wDrift = cfg.AURORA_SCORE_DRIFT_W ?? 1000;
  const wEff = cfg.AURORA_SCORE_EFF_W ?? 1000;
  const wActive = cfg.AURORA_SCORE_ACTIVE_W ?? 10;

  let score = 0;
  score += Math.floor(core * wCore);
  score += Math.floor(eff * wEff);
  score -= Math.floor(churn * wChurn);
  score -= Math.floor(drift * wDrift);
  score += Math.floor(activeMin * wActive);
  return score | 0;
}

// Gate 1: oscillation_fail
export function oscillationFail(stateRaw, s, e, cfg) {
  const b = windowBounds(stateRaw, s, e);
  if (b.e < b.s) return false;

  for (let i = b.s; i <= b.e; i++) {
    if ((stateRaw[i] | 0) === 0) return true;
  }

  let switches = 0;
  for (let i = b.s + 1; i <= b.e; i++) {
    if (stateRaw[i] !== stateRaw[i - 1]) switches++;
  }

  const maxSwitch = cfg.AURORA_OSC_SWITCH_MAX ?? Infinity;
  return switches > maxSwitch;
}

// Gate 2: rupture_fail
export function ruptureFail(coreJ, churn, s, e, cfg) {
  const b = windowBounds(coreJ, s, e);
  if (b.e < b.s) return false;

  const start = Math.max(b.s + 1, 1);
  const stop = Math.min(b.e, (Array.isArray(churn) ? churn.length - 1 : -1));
  if (stop < start) return false;

  const dropMax = cfg.AURORA_RUPTURE_CORE_DROP_MAX ?? -Infinity;
  const spikeMin = cfg.AURORA_RUPTURE_CHURN_SPIKE_MIN ?? Infinity;

  for (let i = start; i <= stop; i++) {
    if ((coreJ[i] || 0) < dropMax && (churn[i] || 0) > spikeMin) return true;
  }
  return false;
}

// Gate 3: length_norm_pass (self-null shuffle)
export function lengthNormPassSelfNull(arrs, candidate, cfg, seed) {
  const n = inferLength(arrs);
  if (n <= 0) return false;
  const s = clampIndex(n, candidate.s);
  const e = clampIndex(n, candidate.e);
  if (e < s) return false;
  const len = e - s + 1;
  if (len < 2) return false;

  const Qobs = windowScoreNumeric(arrs, s, e, cfg);

  const K = cfg.AURORA_LENGTH_NORM_SHUFFLES_K ?? 8;
  const stride = Math.max(1, cfg.AURORA_LENGTH_NORM_STRIDE ?? 1);
  const pMax = cfg.AURORA_LENGTH_NORM_P_MAX ?? 0.2;

  const rng = mulberry32((seed || 0) >>> 0);
  let count = 0;

  for (let k = 1; k <= K; k++) {
    const perm = makePermutation(n, rng);
    const permArrs = permuteArrs(arrs, perm);
    let bestQ = -Infinity;
    for (let ws = 0; ws + len - 1 < n; ws += stride) {
      const we = ws + len - 1;
      const q = windowScoreNumeric(permArrs, ws, we, cfg);
      if (q > bestQ) bestQ = q;
    }
    if (bestQ >= Qobs) count++;
  }

  const p = (count + 1) / (K + 1);
  return p <= pMax;
}

// Gate 4: extractor_robust_pass (micro-perturb trials)
export function extractorRobustPassMicroPerturb(arrs, candidate, cfg, seed) {
  const n = inferLength(arrs);
  if (n <= 0) return false;
  const s = clampIndex(n, candidate.s);
  const e = clampIndex(n, candidate.e);
  if (e < s) return false;

  const trials = cfg.AURORA_EXTRACTOR_PERTURB_K ?? 6;
  const req = cfg.AURORA_EXTRACTOR_ROBUST_REQ ?? Math.max(1, Math.floor(trials * 0.6));
  const eps = cfg.AURORA_EXTRACTOR_PERTURB_EPS ?? 0.01;
  const epsCount = cfg.AURORA_EXTRACTOR_PERTURB_COUNT ?? 1;

  const hsVarMax = cfg.AURORA_HS_VAR_MAX ?? Infinity;
  const churnMaxLimit = cfg.AURORA_CHURN_MAX ?? Infinity;
  const driftMaxLimit = cfg.AURORA_DRIFT_MAX ?? Infinity;
  const coreMinLimit = cfg.AURORA_CORE_PERSIST_MIN ?? -Infinity;
  const activeMinLimit = cfg.AURORA_ACTIVE_COUNT_MIN ?? -Infinity;

  const hsVar = windowMeanVar(arrs.Hs || [], s, e).var;
  if (hsVar > hsVarMax) return false;

  const oscFail = oscillationFail(arrs.stateRaw || [], s, e, cfg);
  if (oscFail) return false;

  const rupFailBase = ruptureFail(arrs.coreJ || [], arrs.churn || [], s, e, cfg);
  if (rupFailBase) return false;

  const effPass = efficiencyDeltaPassHalves(arrs.eff || [], s, e, cfg);
  if (!effPass) return false;

  const rng = mulberry32((seed || 0) >>> 0);
  let passCount = 0;

  for (let k = 0; k < trials; k++) {
    const coreJp = Array.isArray(arrs.coreJ) ? arrs.coreJ.slice() : [];
    const churnp = Array.isArray(arrs.churn) ? arrs.churn.slice() : [];
    const driftp = Array.isArray(arrs.drift) ? arrs.drift.slice() : [];
    const activep = Array.isArray(arrs.activeCount) ? arrs.activeCount.slice() : null;

    for (let i = s; i <= e; i++) {
      if (coreJp.length) coreJp[i] = (coreJp[i] || 0) + (rng() * 2 - 1) * eps;
      if (churnp.length) churnp[i] = (churnp[i] || 0) + (rng() * 2 - 1) * eps;
      if (driftp.length) driftp[i] = (driftp[i] || 0) + (rng() * 2 - 1) * eps;
      if (activep && activep.length) {
        const v = (activep[i] || 0) + (rng() * 2 - 1) * epsCount;
        activep[i] = Math.max(0, Math.round(v));
      }
    }

    const churnMax = windowMax(churnp, s, e);
    const driftMax = windowMax(driftp, s, e);
    const coreMin = windowMin(coreJp, s, e);
    const countMin = activep ? windowMin(activep, s, e) : null;

    const churnPass = churnMax <= churnMaxLimit;
    const driftPass = driftMax <= driftMaxLimit;
    const corePass = coreMin >= coreMinLimit;
    const activePass = (countMin == null) ? true : (countMin >= activeMinLimit);

    if (churnPass && driftPass && corePass && activePass) passCount++;
    if (passCount >= req) return true;
  }
  return false;
}

export function efficiencyDeltaPassHalves(eff, s, e, cfg) {
  const b = windowBounds(eff, s, e);
  if (b.e - b.s + 1 < 2) return false;
  const len = b.e - b.s + 1;
  const firstLen = Math.floor(len / 2);
  const mid = b.s + firstLen - 1;

  const m1 = windowMeanVar(eff, b.s, mid).mean;
  const m2 = windowMeanVar(eff, mid + 1, b.e).mean;
  const delta = m2 - m1;

  const minDelta = cfg.AURORA_EFF_DELTA_MIN ?? 0;
  const noLossTol = cfg.AURORA_EFF_NOLOSS_TOL ?? 0;
  return delta >= minDelta && delta >= -noLossTol;
}

function efficiencyDeltaValue(eff, s, e) {
  const b = windowBounds(eff, s, e);
  if (b.e - b.s + 1 < 2) return 0;
  const len = b.e - b.s + 1;
  const firstLen = Math.floor(len / 2);
  const mid = b.s + firstLen - 1;
  const m1 = windowMeanVar(eff, b.s, mid).mean;
  const m2 = windowMeanVar(eff, mid + 1, b.e).mean;
  return m2 - m1;
}

export function evaluateAuroraWindow(arrs, s, e, cfg, seedBase) {
  const hsStats = windowMeanVar(arrs.Hs || [], s, e);
  const churnMax = windowMax(arrs.churn || [], s, e);
  const driftMax = windowMax(arrs.drift || [], s, e);
  const coreMin = windowMin(arrs.coreJ || [], s, e);

  const hasActive = Array.isArray(arrs.activeCount);
  const activeMin = hasActive ? windowMin(arrs.activeCount, s, e) : undefined;

  const oscillation_fail = oscillationFail(arrs.stateRaw || [], s, e, cfg);
  const rupture_fail = ruptureFail(arrs.coreJ || [], arrs.churn || [], s, e, cfg);
  const length_norm_pass = lengthNormPassSelfNull(arrs, { s, e }, cfg, (seedBase || 0) + 1);
  const extractor_robust_pass = extractorRobustPassMicroPerturb(arrs, { s, e }, cfg, (seedBase || 0) + 2);

  const agreeMin = cfg.AURORA_RAW_DISPLAY_AGREE_MIN ?? 0.9;
  const raw = arrs.stateRaw || [];
  const disp = arrs.stateDisplay || [];
  const bb = windowBounds(raw, s, e);
  let agreeRatio = 0;
  if (bb.e >= bb.s && disp.length > 0) {
    let agree = 0;
    let total = 0;
    const stop = Math.min(bb.e, disp.length - 1);
    for (let i = bb.s; i <= stop; i++) {
      total++;
      if (raw[i] === disp[i]) agree++;
    }
    agreeRatio = total ? (agree / total) : 0;
  }
  const raw_vs_display_agree = agreeRatio >= agreeMin;

  const integration_proxy_delta = efficiencyDeltaValue(arrs.eff || [], s, e);
  const efficiency_delta_pass = efficiencyDeltaPassHalves(arrs.eff || [], s, e, cfg);

  const hsVarMax = cfg.AURORA_HS_VAR_MAX ?? Infinity;
  const churnMaxLimit = cfg.AURORA_CHURN_MAX ?? Infinity;
  const driftMaxLimit = cfg.AURORA_DRIFT_MAX ?? Infinity;
  const coreMinLimit = cfg.AURORA_CORE_PERSIST_MIN ?? -Infinity;
  const activeMinLimit = cfg.AURORA_ACTIVE_COUNT_MIN ?? -Infinity;

  const hsVarFail = hsStats.var > hsVarMax;
  const churnFail = churnMax > churnMaxLimit;
  const driftFail = driftMax > driftMaxLimit;
  const coreFail = coreMin < coreMinLimit;
  const activeFail = hasActive ? (activeMin < activeMinLimit) : false;

  const qualified =
    !oscillation_fail &&
    !rupture_fail &&
    length_norm_pass &&
    extractor_robust_pass &&
    raw_vs_display_agree &&
    !hsVarFail &&
    !churnFail &&
    !driftFail &&
    !coreFail &&
    !activeFail &&
    efficiency_delta_pass;

  let fail_bitmask = 0;
  if (oscillation_fail) fail_bitmask |= 1 << 0;
  if (rupture_fail) fail_bitmask |= 1 << 1;
  if (!length_norm_pass) fail_bitmask |= 1 << 2;
  if (!extractor_robust_pass) fail_bitmask |= 1 << 3;
  if (!efficiency_delta_pass) fail_bitmask |= 1 << 4;
  if (!raw_vs_display_agree) fail_bitmask |= 1 << 5;
  if (hsVarFail) fail_bitmask |= 1 << 6;
  if (churnFail) fail_bitmask |= 1 << 7;
  if (driftFail) fail_bitmask |= 1 << 8;
  if (coreFail) fail_bitmask |= 1 << 9;
  if (activeFail) fail_bitmask |= 1 << 10;

  const out = {
    kind: "AURORA",
    start_turn: s,
    end_turn: e,
    run_length: Math.max(0, e - s + 1),
    Hs_mean: hsStats.mean,
    Hs_var: hsStats.var,
    churn_max: churnMax,
    layout_drift_max: driftMax,
    core_persist_min: coreMin,
    oscillation_fail,
    rupture_fail,
    length_norm_pass,
    extractor_robust_pass,
    raw_vs_display_agree,
    efficiency_delta_pass,
    integration_proxy: "EFFICIENCY",
    integration_proxy_delta,
    qualified,
    fail_bitmask,
  };

  if (hasActive) out.active_concept_count_min = activeMin;
  return out;
}
