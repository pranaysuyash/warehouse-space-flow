# Operating Doctrine Review

- Doctrine path: /Users/pranay/Projects/trucking/products/product-06-warehouse-space-flow/OPERATING_DOCTRINE.md
- SHA-256: e14bab7b1964d8b755c9e6c7f5b1c2b44e1d726033fa23aeaee6ce921e271a75
- Generated: 2026-11-05T12:25:46Z
- This is a generated review artifact, not an instruction source.

## SECTION_0

- Label: §0 Start from live truth
- Reviewed: True
- Evidence: Live-truth inspection: wired HazMat site policy into putaway suitability and solver (additive). Staged paths: src/engine/putawayEngine.ts, src/engine/types.ts, tests/hazmatPolicyPutaway.test.ts, docs/reviews/motto_review.md. checkSlotSuitability accepts optional hazmatPolicy+coLocatedHazmatClasses and rejects forbidden-pair conflicts when item hazmatClass known; solvePutawayManifest accepts optional PutawayOptions. No parallel system created; existing hazmatCompatibility/hazmatPolicy engines reused. Evidence tier 2: npm test 22 files, 112 tests passed; npm run build exit 0.

## SECTION_00_INTEGRATED

- Label: Full doctrine integrated audit
- Reviewed: True
- Evidence: Integrated: HazMat site policy wired into putaway suitability/solver (additive, backward compatible). Staged paths: docs/reviews/motto_review.md, src/engine/putawayEngine.ts, src/engine/types.ts, tests/hazmatPolicyPutaway.test.ts. Tests: npm test -> 22 files, 112 tests passed (incl. tests/hazmatPolicyPutaway.test.ts (2)); full suite green. Build: npm run build exit 0, 413.32 kB / 122.64 kB gzip. Residual: segregation enforcement requires item.hazmatClass + co-located slot.hazmatClass + policy; metadata linkage for live inventory is a documented follow-up. No parallel systems; canonical engines reused.

## SECTION_1

- Label: §1 Outcomes and retained value
- Reviewed: True
- Evidence: Goal: enforce segregation policy in putaway decisions (long-term, first-principles) while preserving existing behavior. Backward compatible: options optional, no-policy callers unchanged (regression test confirms). Staged paths: docs/reviews/motto_review.md, src/engine/putawayEngine.ts, src/engine/types.ts, tests/hazmatPolicyPutaway.test.ts. npm test -> 22 files, 112 tests passed (incl. tests/hazmatPolicyPutaway.test.ts (2)); full suite green. npm run build exit 0, 413.32 kB / 122.64 kB gzip.

## SECTION_10

- Label: §10 Parallel work and contested state
- Reviewed: True
- Evidence: Security/data: no secrets, no external calls, deterministic local logic. docs/reviews/motto_review.md, src/engine/putawayEngine.ts, src/engine/types.ts, tests/hazmatPolicyPutaway.test.ts.

## SECTION_11

- Label: §11 Engineering and data integrity
- Reviewed: True
- Evidence: Observability: violations surfaced via existing violation/reason strings ('HazMat policy conflict: ...'). npm test -> 22 files, 112 tests passed (incl. tests/hazmatPolicyPutaway.test.ts (2)); full suite green.

## SECTION_12

- Label: §12 AI output boundary
- Reviewed: True
- Evidence: Docs/decision: audit plan notes hazmat policy wired into suitability (co-location known); gap remains for occupant class metadata in live inventory. Staged paths: docs/reviews/motto_review.md, src/engine/putawayEngine.ts, src/engine/types.ts, tests/hazmatPolicyPutaway.test.ts.

## SECTION_13

- Label: §13 Product, operator, and claim reality
- Reviewed: True
- Evidence: No unrelated fixes; blast radius confined to putaway/types/tests. docs/reviews/motto_review.md, src/engine/putawayEngine.ts, src/engine/types.ts, tests/hazmatPolicyPutaway.test.ts.

## SECTION_14

- Label: §14 Documentation and decisions
- Reviewed: True
- Evidence: Preservation: no deletions, no behavior removal; additive API. npm test -> 22 files, 112 tests passed (incl. tests/hazmatPolicyPutaway.test.ts (2)); full suite green.

## SECTION_15

- Label: §15 Completion contract
- Reviewed: True
- Evidence: Migration/compat: optional parameters; existing callers/tests unaffected (112 passed). npm test -> 22 files, 112 tests passed (incl. tests/hazmatPolicyPutaway.test.ts (2)); full suite green.

## SECTION_16

- Label: §16 Specialist doctrine routing
- Reviewed: True
- Evidence: Residual risk: co-located hazmat only enforced when slot.hazmatClass metadata present and policy provided; live inventory→slot metadata linkage is follow-up. Honest, not claimed complete. docs/reviews/motto_review.md, src/engine/putawayEngine.ts, src/engine/types.ts, tests/hazmatPolicyPutaway.test.ts.

## SECTION_17

- Label: §17 Propagation contract
- Reviewed: True
- Evidence: Readiness: unit/regression verified; build green. Runtime segregation depends on metadata availability (documented). npm test -> 22 files, 112 tests passed (incl. tests/hazmatPolicyPutaway.test.ts (2)); full suite green. npm run build exit 0, 413.32 kB / 122.64 kB gzip.

## SECTION_2

- Label: §2 Truth taxonomy
- Reviewed: True
- Evidence: Canonical ownership preserved in src/engine/putawayEngine.ts + src/engine/types.ts; no duplicate route/store. HazMat policy engine (hazmatPolicy.ts) is the canonical policy evaluator; compatibility matrix remains complementary. Staged paths: docs/reviews/motto_review.md, src/engine/putawayEngine.ts, src/engine/types.ts, tests/hazmatPolicyPutaway.test.ts.

## SECTION_3

- Label: §3 Proportional rigor and evidence
- Reviewed: True
- Evidence: Scope limited to putaway/slot suitability + LocationSlot metadata + regression test. No demo data added. Staged paths: docs/reviews/motto_review.md, src/engine/putawayEngine.ts, src/engine/types.ts, tests/hazmatPolicyPutaway.test.ts.

## SECTION_4

- Label: §4 Authorization and side effects
- Reviewed: True
- Evidence: Safety/correctness: segregation conflicts now block incompatible co-location when data known; unknown hazmat class/co-location remains a documented gap (honest, no false pass). Staged paths: docs/reviews/motto_review.md, src/engine/putawayEngine.ts, src/engine/types.ts, tests/hazmatPolicyPutaway.test.ts. npm test -> 22 files, 112 tests passed (incl. tests/hazmatPolicyPutaway.test.ts (2)); full suite green.

## SECTION_5

- Label: §5 Canonical paths and ownership
- Reviewed: True
- Evidence: Architecture: optional options bag, pure functions, no side effects; LocationSlot.hazmatClass enables future/real occupancy segregation. Staged paths: docs/reviews/motto_review.md, src/engine/putawayEngine.ts, src/engine/types.ts, tests/hazmatPolicyPutaway.test.ts.

## SECTION_6

- Label: §6 Semantic salvage and supersession
- Reviewed: True
- Evidence: Testing: added tests/hazmatPolicyPutaway.test.ts (rejects forbidden co-location, preserves no-policy behavior). Full regression suite 112 tests passed. npm test -> 22 files, 112 tests passed (incl. tests/hazmatPolicyPutaway.test.ts (2)); full suite green.

## SECTION_7

- Label: §7 Capability routing
- Reviewed: True
- Evidence: Build/type: npm run build exit 0, 413.32 kB / 122.64 kB gzip. TypeScript clean.

## SECTION_8

- Label: §8 Skills lifecycle
- Reviewed: True
- Evidence: UX/behavior: no UI regression; solver becomes stricter only when policy+class metadata provided. Existing canonical flows preserved. npm test -> 22 files, 112 tests passed (incl. tests/hazmatPolicyPutaway.test.ts (2)); full suite green.

## SECTION_9

- Label: §9 Exploration and durable knowledge
- Reviewed: True
- Evidence: Performance: co-location scan is linear over slots per candidate only when policy provided; negligible for facility scale. No hot-path allocation added. npm run build exit 0, 413.32 kB / 122.64 kB gzip.
