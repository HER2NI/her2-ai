# H.E.R Labs Render Behavior Spec (Extension-Parity)

This spec summarizes the visual time dynamics from the H.E.R extension renderer and is the target for the public labs demo.

## Idle Behavior
- **State**: Visual state is `ICE` while HUD shows `IDLE`.
- **Field drift**: Minimal drift (near-frozen). Field flow speed ≈ `0.02`, finer grain scale ≈ `0.03`.
- **Pulse cadence**: Slow global pulse (~1.0 Hz) drives subtle H/S modulation.
- **Shimmer**: Continuous shimmer overlays (smooth sinusoids around ~6 Hz and ~9 Hz with a faint ~18 Hz sparkle).
- **Heartbeat overlay**: A low-amplitude screen pulse (~1.6 Hz) keeps the idle field alive.
- **Nodes**: No node motion in idle because the graph is empty when there are no turns.

## Run Behavior
- **Turn scan cadence**: Continuous scan across turns at `scanSpeed ≈ 0.22` (index interpolates between adjacent turns).
- **Interpolation**: H(t) and S(t) are linearly interpolated between adjacent turn samples.
- **Breath**: A breath pulse spikes to `1.0` when the scan crosses a new turn index, then decays each frame.
- **Field motion**: State-dependent flow (ICE slow, WATER mid, AURORA fastest) with banding tied to scan time.
- **Node physics**: Graph nodes step every frame (center attraction, repulsion, edge springs, friction). Stability scales with S(t) and intro.
- **Never freeze**: In RUN, nodes and field evolve continuously even if no new text is rendered.

## State Machine (ICE/WATER/AURORA)
- **Thresholds**: `t1 ≈ 0.38`, `t2 ≈ 0.68`, hysteresis `hys ≈ 0.06`.
- **ICE → WATER/AURORA**: When H rises above `t1 + hys` (or above `t2` directly to AURORA).
- **WATER → ICE**: When H falls below `t1 - hys`.
- **WATER → AURORA**: When H rises above `t2 + hys`.
- **AURORA → WATER/ICE**: When H falls below `t2 - hys` (or below `t1` to ICE).
