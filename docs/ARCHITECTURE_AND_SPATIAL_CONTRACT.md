# Architecture & Shared Spatial Contract
## Product 06 — Warehouse Space & Flow Planner (`product-06-warehouse-space-flow`)

### 1. Executive Summary & Problem Space
Physical freight moves across interconnected spatial boundaries:
$$\text{Supplier Truck} \longrightarrow \text{Receiving Dock} \longrightarrow \text{Staging Lane} \longrightarrow \text{Warehouse Rack/Bin} \longrightarrow \text{Yard Container} \longrightarrow \text{Outbound Bay}$$

Historically, tracking systems treat containers and warehouse spaces as disjoint data domains. Product 06 solves this with a **unified spatial operations platform**:
- Moving physical cargo preserves its global identity, dimensions, mass, provenance, and ownership.
- Only its location node, operational containment status, and active physical constraints change.
- The fundamental differentiator is not merely showing *where* goods are; it is **deciding where goods can physically fit**, verifying constraint compliance, and **keeping the operational record synchronized** through barcode-scanned putaway events.

---

### 2. Core Architectural Invariant: Dual-Role Containers & Containment Graphs
A shipping container or trailer can simultaneously act as:
1. **An Asset (Cargo item):** Stored at yard coordinate `YARD-07` or docked at door `D-02`.
2. **A Storage Space (Location context):** Holding 24 pallet units inside its interior volume.

When a pallet is unloaded from container `MSKU-928174` at dock `D-02` and transferred into warehouse high-bay rack `RACK-A02-B03-L2`, the container's contents decrease, the rack's occupied volume/weight increases, and the pallet's movement history records an immutable chain of custody.

```
       [Facility DC-04]
        /           \
   [Zone: Yard]   [Zone: Ambient High-Bay]
       |                   |
 [Space: Y-07]        [Aisle R1]
       |                   |
 [Container 53ft]      [Bay B-03]
 (Space & Asset)           |
       |               [Level L-2]
 [Pallet #14]              |
                  [Bin R1-B03-L2-A]
```

---

### 3. Physical Constraints Engine
Unlike generic WMS slotting that treats bins as abstract integers, P06 enforces strict physical laws:

| Constraint Dimension | Evaluated Parameter | Violation Handling |
| :--- | :--- | :--- |
| **Volumetric Clearance** | $(L \le L_{\max}) \land (W \le W_{\max}) \land (H \le H_{\max} - \Delta_{\text{clearance}})$ | Rejection; proposes high-clearance bulk floor or top rack tier. |
| **Beam & Slab Weight Rating** | $W_{\text{cargo}} \le W_{\text{bin\_limit}}$ and $\sum W_{\text{bay}} \le W_{\text{bay\_max}}$ | Rejection; prevents rack collapse. Proposes floor slots. |
| **Environmental Regime** | Ambient, Chilled ($2^\circ\text{C} - 8^\circ\text{C}$), Frozen ($-20^\circ\text{C}$) | Hard rejection for thermal-sensitive perishable freight. |
| **HazMat Compatibility** | DOT HazMat Class 1–9, containment bunds, separation buffer | Rejection; enforces dedicated hazardous containment pads. |
| **Vertical Stacking Rules** | Crush resistance rating ($\text{lbs/ft}^2$), max tier stack limit | Rejection of double-stacking fragile or top-heavy freight. |
| **Ground-Floor Only** | Heavy machinery, oversized crates $> 3,000\,\text{lbs}$ | Must be assigned to slab-on-grade bulk zone (`BLK-*`). |

---

### 4. GS1 EPCIS 2.0 Event Compatibility
Every state transition produces a standard-compliant event envelope:
- **`bizStep`**: `urn:epcglobal:cbv:bizstep:receiving`, `urn:epcglobal:cbv:bizstep:staging`, `urn:epcglobal:cbv:bizstep:putting_away`, `urn:epcglobal:cbv:bizstep:storing`
- **`disposition`**: `urn:epcglobal:cbv:disp:in_progress`, `urn:epcglobal:cbv:disp:staged`, `urn:epcglobal:cbv:disp:active`, `urn:epcglobal:cbv:disp:quarantined`
- **`readPoint`**: The handheld terminal or dock portal scanner ID (e.g. `urn:epc:id:sgln:0614141.00002.D02`).
- **`bizLocation`**: The target bin coordinate (e.g. `urn:epc:id:sgln:0614141.00001.R01-B04-L1`).

---

### 5. Inbound Space & Flow Planning Workflow
```
[Inbound Manifest (40 Pallets)]
              │
              ▼
   [Multi-Constraint Solver]
     ├── Beam Weight Limits
     ├── Height Clearances
     ├── HazMat/Reefer Zones
     └── Ground-Only Constraints
              │
       ┌──────┴──────────────────────┬────────────────────────┐
       ▼                             ▼                        ▼
[32 Optimal Positions]   [5 Alternative Positions]   [3 Constraint Conflicts]
       │                             │                        │
       └─────────────────────────────┴────────────────────────┘
                                     │
                             [Reservation Lock]
                                     │
                             [Putaway Work Queue]
                                     │
                        [Barcode Scan Verification]
                                     │
                                     ▼
                      [Actual Occupancy Confirmed]
                      [GS1 EPCIS Event Published]
```

---

### 6. Integration Bridges
- **Bridge P01 (`product-01-cargo-fit`):**
  Accepts outbound vehicle manifests from Cargo Fit via `OLLP-v1` (Open Logistics Loading Plan). Cargo Fit solves truck packing; P06 verifies whether the destination distribution center has available dock and rack capacity before the truck departs.
- **Bridge P04 (`product-04-asset-studio`):**
  Imports 3D packaging twins (standard GMA pallets, Euro pallets, chemical drums, IBC totes) and storage equipment definitions.
