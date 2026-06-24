# Dobsonian Designer

A browser-based parametric designer for a **classic solid-tube Newtonian telescope on a
Dobsonian mount**. You enter a handful of dimensions; it derives every plywood part,
shows the assembled scope in an interactive 3D viewer, checks that nothing collides as the
tube swings, and exports **cut-ready DXF files** for the wooden parts.

The optical/tube math (aperture, focal length, spacing) is assumed solved elsewhere
(e.g. newt-web); this tool's value is the **mount structure → cut list / DXF**.

## Features

- **Parametric geometry** — tube cradle, three-sided rocker box with a circular bearing
  saddle, and a round ground board, all derived live from your inputs.
- **Balance by sliding** — the tube slides in the cradle to balance; the altitude axis is
  placed from a balance-point percentage rather than a full CG/mass solve.
- **Joinery** — selectable **box (finger) joints** at the cradle and rocker-front corners,
  and **tabs-in-slots** attaching the sides/front to the bottom disk. Joints are part of
  the 2D outline, so they flow straight to the DXF.
- **Rigorous interference check** — a conservative-advancement sweep over the full
  altitude range (0°–90°) that is *certain*, not sample-based, and reports the minimum
  swing clearance and the angle it occurs at.
- **3D viewer** — orbit, swing the altitude/azimuth, per-group visibility toggles, and a
  "distinct part colors" mode to make the interlocking joints obvious.
- **DXF export** — one R12 DXF per plywood part (outlines, bolt/pivot holes, tab slots,
  altitude-center markers), bundled into a single `.zip`. Units are inches.
- **Persistence** — parameters, pose, visibility, and display options are saved to
  `localStorage` and restored on reload.

## Design philosophy: a single source of truth

Every plywood part is **prismatic** — a 2D profile polygon (with holes) extruded by a
constant thickness, then placed. From that one record the app derives the 3D mesh, the
flat outline, the DXF, and the collision geometry, so they cannot drift apart. There is no
heavy CAD kernel; the domain is prismatic by design. See `dob-design-spec.md` for the full
rationale, formulas, and the **tripwire**: if any part ever needs a genuine 3D solid
(fillets, lofts, compound curves), this architecture should be reconsidered.

## Running it

It's a static site using ES modules and an import map for three.js (loaded from a CDN), so
it must be served over HTTP — opening `index.html` via `file://` will not work.

```sh
python3 -m http.server 8017
# then open http://localhost:8017/
```

Any static file server works. The only runtime dependency is three.js, pulled from a CDN
by the import map in `index.html`.

## Project layout

| File | Purpose |
|------|---------|
| `index.html`        | UI shell, control panel, three.js import map |
| `js/params.js`      | input definitions, defaults, fixed constants |
| `js/geometry.js`    | the geometry engine — derived dimensions and part assembly |
| `js/joinery.js`     | finger/box joints, tabs, and matching disk slots |
| `js/interference.js`| conservative-advancement swept collision check (SAT-based) |
| `js/viewer.js`      | three.js rendering, visibility groups, color modes |
| `js/dxf.js`         | minimal R12 DXF writer |
| `js/zip.js`         | dependency-free store-method ZIP writer |
| `js/main.js`        | UI wiring, persistence, export |
| `dob-design-spec.md`| the consolidated design spec and decision record |

## Status

Implemented: inputs + validation, parametric geometry, joinery, interference check, 3D
visualization, and DXF export. **STL export is shelved** (the side bearings are produced by
another process and modeled here as placeholder cylinders). Deferred niceties: kerf
compensation, finger fit allowance > 0, and tuning a few flagged default constants.

## License

Public domain — released under [The Unlicense](LICENSE). Do whatever you like.
