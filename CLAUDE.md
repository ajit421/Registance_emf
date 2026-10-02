# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Requires Node.js 20+ (Netlify builds with Node 22).

```bash
npm run dev                         # Vite dev server, http://localhost:5173
npm test                            # vitest run (all tests)
npx vitest run -t "concentrated"    # run tests whose name matches
npm run typecheck                   # tsc -b (app, node and test projects)
npm run lint                        # oxlint
npm run build                       # tsc -b && vite build → dist/
```

All tests live in `src/lib/motor/compute.test.ts` and run in the `node` environment (no DOM).

## Architecture

A static React 19 + TypeScript SPA that calculates axial-flux PCB motor stator designs. Everything is computed client-side and recomputed live from the inputs; results are never stored.

### Data flow

1. **`src/lib/motor/schema.ts`**: the single source of truth for every user input (key, label, unit, default, min/max, `int`, `sci`, live `hint`). The sidebar, the Advanced sheet (section `X`, `advanced: true`), CSV/JSON/TXT export, import validation (`sanitize` in `io.ts`) and the "changed" badges are all generated from `SCHEMA`. Fields with `windings: [...]` apply only to that winding configuration (`usedBy()` filters them). Params are a flat `MotorParams` object; `values(p)` casts it to `Record<string, number>` for formula code. Defaults are per winding: `defCw` overrides `def` for a concentrated winding (12 slots / 10 poles, from the Octave reference design), and `defaults(winding)`, `sanitize(obj, winding)`, `changedKeys`/`shareDiff` and resets all take the winding. Switching winding calls `followDefaults`, so inputs still at the old winding's default move to the new one's and edited values stay. Share links hold only the differences, so they are read back against their own winding's defaults.
2. **`src/store/motor.ts`**: Zustand store persisted to localStorage (`pcbmotor.params.v2`). It holds `params` and `winding` (`null` until the user picks one; the app shows a picker instead of results until then). It also contains the spec "triangle" logic: two of power/speed/torque are given and `spec_solve` is calculated, and typing into the solved field switches which one is solved. Magnet length follows `ORS − IRS` until the user edits it. A `#p=` share link in the URL overrides stored inputs on load and is then removed from the address bar. The persisted store has `version: 1`; `migrate` moves v0 concentrated designs off the distributed defaults once, so bump the version (with a migration) when stored data needs reshaping.
3. **`src/lib/motor/derive.ts`**: `evaluate(params, winding)` is the entry point the UI uses (via `useMotor()`). `derive` / `deriveConcentrated` fill in values that are **not** inputs but which the engines read as if they were (`spec_poles` for distributed, `emf_pp`, `slots_per_phase`, `dOR`/`dIR` from `ew_band`, `ed_len`, `ed_paths`, `emf_Kw` for concentrated).
4. **Engines**: `compute.ts` (distributed winding) and `concentrated.ts` (tooth-wound winding) each compute only section **A** (winding geometry and phase resistance) and return the same `WindingResult` shape. `concentrated.ts` follows the user's Octave reference script (every layer in series; via space and slot space split the slot pitch; end-winding radial legs have their own gap). It maps onto the distributed field names (`series_stacks: total_layers`, `layer_stack: 1`, `total_layer_stacks: 1`) and adds extras under `A.cw` (including the per-turn end-winding detail `A.cw.perTurnEw`). Its tests compare against values from a line-by-line translation of that script, so keep any change to its formulas in step with the script. Both then call the shared `performance()` in `compute.ts` for B (eddy loss), C (EMF/current/efficiency), M (magnet spacing) and D (electric loading). UI code tells the two windings apart by checking `A.cw`.
5. **`checks.ts`** returns design errors and checks as data; `report.ts` produces the plain-text report; `io.ts` handles import/export and format auto-detection (link → JSON → TXT with an inputs trailer → CSV → bare report text).

UI: `App.tsx` lays out the header, the sidebar (`InputPanel`) and the main area (`KpiStrip` + `features/Results.tsx`). `components/ui/` is generated shadcn code (style `radix-nova`, see `components.json`); the `@/` alias maps to `src/`.

### Invariants: the distributed engine is locked

- The regression test replays 200 designs recorded from the original engine (`src/lib/motor/__fixtures__/reference-results.json`) through `compute()` and requires every output to match within 1e-9 relative error, warnings included. It also requires `reportText()` of the legacy defaults to match byte-for-byte. Constants such as `3.1416` and `1.414` in `performance()` are intentional for this reason.
- So: do not change `compute.ts` / `performance()` formulas, warning strings or the distributed report layout unless the physics change is deliberate. If it is, regenerate the fixture and say so in the change description.
- `report.ts` output is also parsed back by `io.ts` (`fromReport`), so changing labels there can break TXT import.
- Share links use `encodeURIComponent(btoa(encodeURIComponent(JSON)))` and only include values that differ from the defaults (`shareDiff`); this stays compatible with links from the original app.

### Adding an input

Add a field to `SCHEMA` (put it in section `X` to keep it in the Advanced sheet; set `windings` if only one configuration uses it), then read it in an engine or in `derive.ts`. No UI or io changes are needed. Keep import backwards-compatible: older exports are migrated in `sanitize()` (e.g. `dOR` → `ew_band`), and files without a `winding` key are treated as `distributed`.
