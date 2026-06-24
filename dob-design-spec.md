# Dobsonian Designer — Consolidated Design Spec

*Derived from the grilling session. This is the sharpened design: scope, inputs with
validation, the part-by-part geometry, joinery, outputs, and the architecture decision
with its tripwire. Read the **Load-bearing assumptions** and **Open items** sections —
those are where this will break if anyone forgets them.*

---

## 1. Scope

**In scope:** a parametric designer for a **classic solid-tube (sonotube) Newtonian
Dobsonian** — rocker box + ground board + a tube cradle carrying two altitude bearings.
The deliverable is **cut-ready geometry**: DXF per plywood part, placeholder STL for the
bearings, and a 3D/flat visualization to confirm the parts assemble correctly.

**Explicitly NOT in scope (and why):**
- **Optical / tube-spacing design.** Already solved by newt-web and friends; "not that
  complicated." We *accept* optical inputs (aperture, focal length, tube OD) but add no
  value there. Tube length may be entered directly or derived from focal length.
- **Balance / CG computation.** We do **not** take component masses. The user balances by
  **sliding the tube in the cradle**; we represent balance as a single parameter
  (`balance_point`, % from the mirror end). This was a deliberate scope cut — but note the
  consequence in §4: rocker height is derived *from that parameter*, not from tube center.
- **Truss/upper-cage Dobs.** Different part family entirely. Not this tool.

---

## 2. Inputs (every one needs a validation rule)

| Input | Default | Validation / notes |
|---|---|---|
| `aperture` | — | optical context only |
| `focal_length` | — | may derive `tube_length` |
| `tube_length` (L) | from `focal_length` + allowance, or direct | drives rocker height |
| `tube_OD` | — | drives cradle + bearing separation |
| `plywood_thickness` (t) | ½" or ¾" | per-part thickness allowed (½/¾ mix) |
| `joint_type` | butt \| box(finger) | box adds finger geometry to outlines |
| `finger_count` | 5 (per edge) | odd → symmetric mating pattern |
| `finger_allowance` | 0 | **TODO:** real fit needs >0; revisit |
| `bearing_diameter` | — | **MUST be > tube_OD** → clamp or warn |
| `balance_point` (p) | 42% from mirror end | sets axis position along tube |
| `pad_angle` (θ) | 35° from vertical (70° total) | tunable |
| `clearance_margin` | 2" | mirror-end → rocker floor at zenith |
| `cradle_length` (axial) | = `tube_OD` | user-settable |
| `bolt_circle_radius` | — | **shared** by bearing STL *and* cradle holes |
| `bolt_clearance` | 0.266" (¼" bolt) | 4-bolt diamond / 4-fold pattern |
| `bearing_width` (axial) | 1" | also the Teflon contact width |
| `pivot_hole` | 5/16" | rocker bottom + ground board centers |
| `pad_foot_size` | ~1"×1" | non-critical, user-settable |

---

## 3. Part inventory

1. **Cradle** — open-ended **square box** around the tube, inner side = `tube_OD`,
   outer = `tube_OD + 2t`. Four boards. Two side faces carry the **4-bolt diamond**
   (matching the bearing bolt circle) + Teflon-location markers. Tube held by **friction**;
   slides to balance.
2. **Altitude bearings ×2** — **3D-printed, modeled as placeholder solid cylinders**:
   outer radius, 4-fold bolt circle (`bolt_circle_radius`), width `bearing_width`.
   "Some other process" owns the real printable design.
3. **Rocker box** — 2 side boards (top edge carries the two Teflon pads at ±θ),
   1 front board (height derived, see §4), 1 **bottom disk**.
4. **Ground board** — 1 **disk** (diameter = rocker bottom disk), center pivot hole,
   3 Teflon-pad markers, 3 feet.
5. **Teflon pads & feet** — **hardware, not plywood**; not cut parts. Their **locations
   are marked** on the relevant plywood parts for assembly.

---

## 4. Geometry (the dependency graph)

Reference point: **altitude axis is on the tube centerline.**

```
R_b                 = bearing_diameter / 2
axis_above_top_edge = R_b · cos(θ)                     # bearing rests on pads at ±θ
H_rocker_side       = p·L − R_b·cos(θ) + clearance_margin
axis_height         = H_rocker_side + R_b·cos(θ)       # = p·L + clearance_margin
front_board_height  = axis_height − tube_OD/2 − margin # tube clears front at horizon
cradle_outer_width  = tube_OD + 2t                     # square cross-section
bearing_separation  = tube_OD + 2t                     # DERIVED, tied to tube width
```

**Notes & gotchas:**
- The old `tube_length/2 − tube_diameter/2` rule was wrong twice: it used tube *center*
  (must be the **balance point** `p·L`) and the correction term is `R_b·cos(θ)`, not
  `tube_OD/2`. Fixed above.
- **Narrow bearing separation** is accepted: separation = tube width means a long tube on
  a small scope is tippy in altitude and friction may struggle. Accepted trade-off for
  simplicity.
- **`front_board_height < 0` → warn:** the front board has vanished and the rocker loses
  rigidity. (Below-horizon aiming would push it further negative — see Open items.)
- **Cradle corner swing:** the square cradle's corners swing on radius
  `√(((tube_OD/2)+t)² ... )` wider than the tube. Handled by the interference check, not a
  formula.

**Rocker side fore-aft width (derived 2026-06-24):** the side panel must contain the
bearing saddle, whose mouth half-width is `xi = √((Rb+clr)² − (Rb·cosθ)²)`. So
`rockerDepth = 2·xi + 2·rocker_edge_margin` — leaving `rocker_edge_margin` (flagged
default, 2") of solid wood beyond each end of the saddle. This replaced an earlier
unjustified `1.6 × bearing_diameter` heuristic; the dependency on bearing size is real
(the saddle scales with `Rb`) but is now explicit rather than a magic multiplier.

**Underspecified, needs a default before coding (see Open items):** rocker side-clearance
constant (rocker inner width vs cradle), rocker bottom disk diameter rule, feet placement
radius.

---

## 5. Joinery

- **Butt joints:** rectangular outlines; assembled with screws.
- **Box (finger) joints — edge-to-edge corners only:** the 4 cradle corners and the rocker
  side↔front corners. `finger_count = 5`, **finger depth = mating board's thickness**,
  `finger_allowance = 0` (for now). The fingers **are** the part outline.
- **Rocker sides/front ↔ bottom disk:** NOT a box joint (a board landing on a flat face).
  Use **tabs + slots** — tabs on the side/front outlines, matching slots in the disk.

---

## 6. Interference check

At **three poses — zenith, 45°, horizon** — test the swept tube/cradle against the rocker
and **warn** on collision (detect-and-warn, do not silently emit broken parts).
Implementation: decompose the hollow square cradle into its **4 convex boards** and run
**pairwise convex prism intersection (SAT)** against the rocker boards. This is code you
own (a CAD kernel would have given it for free — see §8).

---

## 7. Outputs

- **DXF** — **one file per part** (no nesting/packing). Simple **outlines, single layer**.
  Holes: azimuth pivot (5/16") in rocker bottom + ground board; 4-bolt diamond (0.266") on
  cradle side faces. **Markers** (not holes): altitude-bearing center; Teflon-pad
  locations. Kerf ignored for now.
- **STL** — *shelved (2026-06-23).* Not a current requirement. The side bearings are
  generated by "some other process"; the app models them only as in-viewer placeholder
  cylinders. Revisit only if printable bearing geometry is ever pulled back in scope.
- **Visualization (staged, see §8):** (1) 3D interactive model, (2) flat-parts preview,
  (3) 2D assembly drawing / UI polish later.

---

## 8. Architecture

**Single source of truth — the central decision.** Every part is **prismatic**: a 2D
profile extruded by a constant thickness (the bearings are cylinders). So each part is one
small record:

```
Part = { profile_polygon (with holes), thickness, placement_transform }
```

Everything derives from that one record:
- **3D model** = `THREE.ExtrudeGeometry(profile, thickness)` + transform.
- **Flat preview** = draw the profile (same polygon).
- **DXF** = write the profile polylines/arcs + hole circles (small custom writer; no CAD lib).
- **STL** = export the extruded mesh / cylinder.
- **Interference** = SAT on the extruded prisms (§6).

**Stack:** **web application, three.js** for 3D. No Python/OpenCascade — a CAD kernel is
**over-engineering for a prismatic domain**.

**Staging:**
1. Geometry engine + **3D viewer + flat preview** — *first*, to validate that parts fit
   (the 3D model is a correctness tool before it's eye-candy).
2. DXF / STL export.
3. UI interactions and visual polish.

**Load-bearing assumption (write it on the wall):** **all parts are prismatic** — a single
flat profile × constant thickness. Curved cutouts (e.g. a curved cradle saddle) are still
prismatic and fine. **Tripwire:** the moment any part needs a *genuine* 3D solid (true
chamfers/fillets, lofts, compound curves), this architecture no longer holds — reconsider
a kernel (build123d/CadQuery). Until then, three.js + the profile model satisfies every
output consistently.

---

## 9. Validation rules summary

- `bearing_diameter > tube_OD` — else clamp or warn.
- `front_board_height < 0` — warn (front board gone, rigidity lost).
- Interference at any of the 3 poses — warn.
- `bolt_circle_radius` is **one** parameter feeding both the bearing STL and the cradle DXF
  holes — never two that can drift.

---

## 10. Open items / deferred

- **STL export** — shelved 2026-06-23 (see §7); bearings stay placeholder cylinders.
- **Kerf compensation** — deferred.
- **finger_allowance = 0** — real assembly needs a small allowance; revisit before cutting.
- **Mass-based balance / CG** — deferred; using `balance_point` % input instead.
- **Below-horizon aiming** — undecided; affects `front_board_height` (may go negative).
- **Nesting** — rejected; one DXF per part.
- **Eyepiece-height ergonomics** — acknowledged, currently unconstrained.
- **Rocker side width** — now derived from the saddle (`2·xi + 2·rocker_edge_margin`),
  replacing the old `1.6 × bearing_diameter` guess (2026-06-24).
- **Defaults still needed:** rocker side-clearance constant, rocker bottom disk diameter
  rule, feet placement radius.
- **tube_length** — decide: direct input vs derived from focal length + allowance.
