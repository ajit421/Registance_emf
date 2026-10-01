# PCB Motor Designer

Interactive calculator for axial-flux PCB motor stators. From the winding geometry and the motor
specification it computes:

- **Winding resistance:** trace widths, per-turn geometry, radial legs and end-windings, up to the
  phase resistance
- **Eddy current loss** in the copper traces
- **Back-EMF and performance:** current, copper loss, efficiency (with and without the ESC), terminal voltage
- **Magnet spacing** checked against the design limits
- **Electric loading:** present vs required

After the motor specification you choose the winding configuration. Distributed winding is
fully calculated; concentrated winding is not implemented yet. Results are shown as one
expandable card per section, with to-scale coil and stator drawings, and inputs can be
imported/exported as JSON, CSV, TXT or a shareable link. Everything updates live as you type.

## Tech stack

| Area | Tools |
|---|---|
| Build | [Vite 8](https://vite.dev) (Rolldown) |
| UI | React 19, TypeScript (strict) |
| Styling | Tailwind CSS 4, [shadcn/ui](https://ui.shadcn.com) on Radix, light/dark/system theme |
| State | Zustand, with inputs saved in `localStorage` |
| Quality | Vitest, oxlint |

## Getting started

Requires Node.js 20 or newer.

```bash
npm install
npm run dev          # http://localhost:5173 with hot reload
```

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Unit and regression tests |
| `npm run typecheck` | TypeScript project check |
| `npm run lint` | Lint with oxlint |
| `npm run build` | Type-check and build the static site into `dist/` |
| `npm run preview` | Serve the production build locally |

The build output is a static site, so it can be hosted on Netlify, Vercel, GitHub Pages or any
static file server.

## Project structure

```
src/
├─ lib/motor/            calculation code, no React
│  ├─ schema.ts          every input (label, unit, default, limits) is declared once here
│  ├─ derive.ts          values that follow from other inputs (poles = slots / 3, …)
│  ├─ compute.ts         engine: spec → A winding → B eddy → C EMF → M magnets → D loading
│  ├─ checks.ts          design errors and checks, returned as data
│  ├─ report.ts          plain-text report
│  ├─ io.ts              validation and JSON / CSV / TXT / link import and export
│  ├─ compute.test.ts
│  └─ __fixtures__/      recorded reference results used by the regression test
├─ store/                Zustand stores (inputs, theme)
├─ hooks/                useMotor (inputs plus derived results), file import, drag-and-drop
├─ components/           header, inputs sidebar, winding picker, advanced sheet, KPI strip,
│                        coil drawings, ui/ (shadcn)
└─ features/             Results: one expandable card per section
```

### Adding an input

1. Add a field to `SCHEMA` in `src/lib/motor/schema.ts` (put it in the `X` section to keep it
   in the Advanced sheet instead of the sidebar).
2. Use it in `compute.ts`, or in `derive.ts` if it only feeds other engine values.

The sidebar, Advanced sheet, exports and import validation are generated from the schema,
so they pick it up automatically.

### Derived values (distributed winding)

`derive.ts` fills these before the engine runs, so they are not inputs:

| Value | Formula |
|---|---|
| Poles | slots / 3 |
| Pole pairs, slots per phase | poles / 2 |
| Outer and inner end-winding bands | end winding thickness |
| Eddy conductor length | Rout − Rin |
| Eddy parallel paths | layers per stack × parallel layer stacks |

## Tests

`src/lib/motor/compute.test.ts` covers:

- **Reference results:** 200 randomly generated designs whose outputs were recorded from the
  original engine (`__fixtures__/reference-results.json`). Every value must match to within
  1e-9 relative error. A change of even the fourth decimal of a constant fails this test.
- **Derived inputs:** the distributed-winding relations above.
- **Default design:** known headline numbers.
- **Import/export:** round trips through JSON, TXT, CSV and shareable links (including the
  winding choice), older exports, and input sanitising.

If you change the physics model on purpose, regenerate the fixture and say so in the change
description.
