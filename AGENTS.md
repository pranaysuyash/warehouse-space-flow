# Product 06 — Warehouse Space & Flow Planner

## 1. Instruction Hierarchy & Governance
This directory governs Product 06 (Warehouse Space & Flow Planner) of the TRUCKING platform.
Precedence:
1. `/Users/pranay/AGENTS.md`
2. `/Users/pranay/Projects/AGENTS.md`
3. `/Users/pranay/Projects/trucking/AGENTS.md`
4. This file (`products/product-06-warehouse-space-flow/AGENTS.md`)
5. Local `docs/ARCHITECTURE_AND_SPATIAL_CONTRACT.md`

Compatibility symlinks (`CLAUDE.md`, `GEMINI.md`, `QWEN.md`) must point directly to this file.

---

## 2. Product Identity & Domain Boundary
- **Port:** `5178`
- **Focus:** Facility spatial operations, containment graphs, multi-constraint inbound putaway optimization (beam weight ratings, dimensional clearances, HazMat/cold-chain zoning, ground-only rules), dual-role moveable container modeling (assets that contain assets), GS1 EPCIS 2.0 audit events, and scan-verified putaway execution.
- **Tech Stack:** React 19, TypeScript, Vite 7, Vitest 3.

---

## 3. Sovereign Verification Commands
```bash
npm test        # Run Vitest test suite
npm run build   # Typecheck and production bundle build
npm run dev     # Start local server on port 5178
```

---

## 4. Cross-Project Bridges
- **Consumes:**
  - `product-01-cargo-fit` (Port 5173): `OLLP-v1` (Open Logistics Loading Plan) - Inbound vehicle load arrivals with packed cargo dimensions and weights.
  - `product-04-asset-studio` (Port 5176): `OLAS-v1` - Packaging & equipment digital twins (48x40 pallets, drums, ISO containers).
- **Produces:**
  - `command-center-portal` (Port 5170): `OWSP-v1` - Verified putaway plans, dock reservations, and warehouse capacity utilization telemetry.

---

## 5. Git & Mutation Policy
- Read-only inspection is permitted (`git status`, `git diff`, `git log`).
- Staging, commits, pushes, and branch changes require explicit user authorization.
