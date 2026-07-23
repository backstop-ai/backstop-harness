# Backstop Seed 1 domain

This directory contains the side-effect-free Backstop lifecycle core defined by
SPEC-001:

- `schema.ts` defines typed identities, lifecycle vocabulary, attribution, and
  legal-action metadata.
- `artifact-revision.ts` computes normalized artifact revision identities and
  stale-revision preconditions.
- `transition.ts` evaluates commands into typed rejections or ordered lifecycle
  events.
- `projection.ts` folds committed work-unit events into current state and
  defines the append-and-project atomic boundary contract.

## Requirement Mapping

- `schema.ts` implements REQ-001, REQ-002, and REQ-009 with branded identities,
  discriminated command payload schemas, lifecycle vocabulary, legal actions,
  single-work-unit ownership, causal links, and append-only corrections.
- `artifact-revision.ts` implements REQ-005 by hashing every normalized input
  byte and exposing typed candidate/current/stale revision results.
- `transition.ts` implements REQ-003, REQ-004, REQ-007, and REQ-008 with a pure
  transition table, aggregate and artifact fencing, explicit prerequisite
  facts, bounded repair behavior, and stale/late attempt suppression.
- `projection.ts` implements REQ-006 by deterministically folding appendable
  lifecycle events into phase, attempt, blocker, revision, prerequisite,
  terminal, and legal-action state at one append-and-project boundary.
- All four modules implement REQ-010 by exposing domain primitives without
  executing runtime work.

## Contract Mapping

- CON-001 is `schema.ts`: domain identities, lifecycle vocabulary, payload
  schemas, attribution records, aggregate state, and legal-action metadata.
- CON-002 is `transition.ts`: `TRANSITION_TABLE` and `evaluateTransition`.
- CON-003 is `projection.ts`: `projectWorkUnit` and
  `validateAppendAndProjectBoundary`.
- CON-004 is `artifact-revision.ts`: `hashArtifactRevision`, candidate revision
  identity, comparison, and current-revision preconditions.

## Exclusions

Seed 1 deliberately excludes persistence and the backstop-core adapter,
coordinator execution and retry scheduling, OpenCode child sessions, control-
plane UI rendering, the Bun verifier pack and verification execution, artifact
traceability adapters, and full reactive vertical-slice orchestration. Later
specs consume this side-effect-free core to implement those capabilities.

## Sharp Edges

- Aggregate-version fencing must happen before command legality or actor checks.
- Artifact-dependent commands must reject stale revision identities.
- Content-dependent commands must provide a non-empty set of expected and
  actual revision pins; absence is an invalid payload, not implicit approval.
- Validation and verification facts are explicit prerequisites for review, and
  implementation attempts carry typed IDs and interruption status.
- Event append and projection update are one atomic persistence boundary.
- Transition next state and EventV2 projection must agree for every accepted
  command.
- Cancelled, superseded, exhausted, and otherwise terminal work units reject
  stale or late completion.
