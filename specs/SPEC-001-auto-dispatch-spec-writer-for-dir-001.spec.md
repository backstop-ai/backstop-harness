---
title: "Backstop Domain Schemas And Deterministic Transition Core"
number: SPEC-001
created: "2026-07-22"
status: implemented
schema_version: spec/v1
spec_version: 1.0.0
source:
  directive: DIR-001
  bundle: BUNDLE-001
  bundle_root: BUNDLE-001
  bundle_file: bundles/BUNDLE-001-ambient-backstop-orchestration.bundle.md
  directive_file: directives/DIR-001-ambient-backstop-orchestration-on-opencode-v2.directive.md
implementation:
  subject: backstop-domain-transition-core
  summary: >
    Define the Backstop harness domain schema and pure deterministic transition core for Seed 1 of
    BUNDLE-001: typed work-unit identities, lifecycle states, role-scoped commands, emitted events,
    aggregate-version fencing, artifact revision identity, append-only attribution corrections, and
    atomic EventV2 current-state projections.
  scope:
    - Model typed IDs for work units, artifacts, artifact revisions, lifecycle attempts, commands, events, sessions, and causal links.
    - Model lifecycle states, commands, command actors, command preconditions, accepted outcomes, rejected outcomes, and emitted lifecycle events.
    - Implement deterministic transition evaluation over a single work-unit aggregate version without side effects.
    - Require optimistic aggregate-version checks so concurrent commands either commit one ordered event sequence or receive a typed conflict.
    - Represent artifact revision identity as a SHA-256 hash of complete line-ending-normalized artifact bytes.
    - Define deterministic EventV2 projection inputs and atomic projection semantics for current lifecycle state and legal next actions.
    - Cover rejection, validation failure, changes requested, repair, retry exhaustion, interruption, restart recovery, supersession, abandonment, cancellation, stale completion, and late completion.
    - Attribute every lifecycle event, command, attempt, review, evidence reference, and correction to exactly one work unit.
  out_of_scope:
    - Building the workflow coordinator that launches writer, reviewer, implementer, repair, and verifier workers.
    - Implementing OpenCode child sessions, delegated execution, or retry scheduling.
    - Implementing the control-plane UI, sidebar dock, detail drawer, or non-chat completion notices.
    - Implementing the backstop-core adapter, Bun verifier pack, artifact traceability graph, or final gate evidence policy.
    - Building full product-path automation beyond the Seed 1 transition core.
verification:
  level: integration
  test_command: "bun test test/backstop/domain && bun typecheck"
  coverage_threshold: 80
  gates:
    - name: spec-schema-validation
      description: The artifact validates as spec/v1 with populated source, implementation, verification, requirements, claims, and contracts.
    - name: transition-table-review
      description: Reviewer confirms the legal transition model covers BUNDLE-001 Seed 1 states and edge cases without requiring coordinator behavior.
    - name: traceability-validation
      description: Every requirement has at least one claim and traces to DIR-001 and BUNDLE-001 requirements.
  acceptance:
    - The spec describes only Seed 1 domain schemas and deterministic transition behavior.
    - Requirement IDs use REQ-NNN and claim IDs use CLM-NNN.
    - Every requirement has at least one claim, and every claim lists tests.
    - Contracts identify implementation files and the domain APIs they provide or consume.
requirements:
  - id: REQ-001
    title: Define typed Backstop domain identities
    supports:
      - ambient-backstop-orchestration:REQ-003@1.0.0
      - ambient-backstop-orchestration:REQ-004@1.0.0
      - ambient-backstop-orchestration:REQ-006@1.0.0
      - ambient-backstop-orchestration:REQ-016@1.0.0
    text: >
      The Seed 1 implementation MUST define branded or otherwise type-safe identifiers for work units,
      commands, lifecycle events, attempts, sessions, artifact revisions, artifact files, evidence records,
      reviews, causal links, and append-only attribution corrections so unrelated lifecycle entities cannot
      be accidentally interchanged in transition logic.
    claims:
      - CLM-001
  - id: REQ-002
    title: Model lifecycle states, commands, actors, and events explicitly
    supports:
      - ambient-backstop-orchestration:REQ-003@1.0.0
      - ambient-backstop-orchestration:REQ-004@1.0.0
      - ambient-backstop-orchestration:REQ-018@1.0.0
    text: >
      The domain model MUST enumerate the Backstop lifecycle states, role-scoped command types, command
      actors, command payload schemas, rejection reasons, and emitted lifecycle event types used by both
      explicit lifecycle paths: product exploration → bundle → human approval → directive → spec → plan →
      implementation → runtime verification → implementation review → completion, and reactive exploration
      → issue → issue-backed plan → implementation → runtime verification → implementation review →
      completion. Legal-action metadata MUST be available to later tools, slash commands, and UI projections.
    claims:
      - CLM-002
  - id: REQ-003
    title: Enforce deterministic legal transitions in a pure core
    supports:
      - ambient-backstop-orchestration:REQ-003@1.0.0
      - ambient-backstop-orchestration:REQ-004@1.0.0
      - ambient-backstop-orchestration:REQ-005@1.0.0
    text: >
      Transition evaluation MUST be a deterministic side-effect-free function of the current work-unit
      aggregate state, expected aggregate version, command, actor, and pinned artifact revisions. It MUST
      define the phase-to-phase transitions and preconditions for the product and reactive lifecycle paths
      named in REQ-002, then return either typed rejection or the exact ordered lifecycle events to append;
      it MUST NOT launch workers, mutate files, run validation, or update projections directly.
    claims:
      - CLM-003
  - id: REQ-004
    title: Fence concurrent commands with aggregate versions
    supports:
      - ambient-backstop-orchestration:REQ-003@1.0.0
      - ambient-backstop-orchestration:REQ-009@1.0.0
      - ambient-backstop-orchestration:REQ-016@1.0.0
    text: >
      Every accepted command MUST target one work-unit aggregate and an expected aggregate version. If the
      stored version differs at commit time, the command MUST fail with a typed conflict or be re-evaluated
      against the current aggregate before any event is appended, ensuring one ordered lifecycle history per
      work unit.
    claims:
      - CLM-004
  - id: REQ-005
    title: Preserve artifact revision identity in transition preconditions
    supports:
      - ambient-backstop-orchestration:REQ-006@1.0.0
      - ambient-backstop-orchestration:REQ-007@1.0.0
    text: >
      Artifact revision identity MUST be represented as the SHA-256 hash of the complete artifact bytes
      after line-ending normalization. Any command that depends on authored content MUST cite the expected
      artifact revision hash, and stale hashes MUST produce typed stale-artifact rejection or candidate-
      revision events rather than inheriting previous approval or evidence.
    claims:
      - CLM-005
  - id: REQ-006
    title: Project current state atomically from EventV2 lifecycle events
    supports:
      - ambient-backstop-orchestration:REQ-003@1.0.0
      - ambient-backstop-orchestration:REQ-011@1.0.0
      - ambient-backstop-orchestration:REQ-012@1.0.0
    text: >
      Lifecycle event append and current-state projection MUST be one atomic boundary. The projection MUST
      be deterministic, side-effect-free, derived from EventV2 work-unit events, and include current phase,
      active attempt, blockers, terminal state, expected revisions, and legal next actions for later
      coordinator and control-plane consumers.
    claims:
      - CLM-006
  - id: REQ-007
    title: Cover non-happy lifecycle outcomes
    supports:
      - ambient-backstop-orchestration:REQ-004@1.0.0
      - ambient-backstop-orchestration:REQ-008@1.0.0
      - ambient-backstop-orchestration:REQ-009@1.0.0
    text: >
      The transition table MUST include typed states or events for validation failure, review changes
      requested, repair requested, repair accepted, retry exhaustion, interruption, restart recovery,
      supersession, abandonment, cancellation, stale completion, and late completion, and MUST define which
      outcomes are terminal, resumable, repair-scoped, or eligible for bounded retry.
    claims:
      - CLM-007
  - id: REQ-008
    title: Fence stale attempts, interruptions, and completion races
    supports:
      - ambient-backstop-orchestration:REQ-008@1.0.0
      - ambient-backstop-orchestration:REQ-009@1.0.0
      - ambient-backstop-orchestration:REQ-017@1.0.0
    text: >
      Attempt-closing commands MUST carry work-unit ID, attempt ID, role, expected aggregate version,
      expected artifact revisions where applicable, and interruption status. A completion from a cancelled,
      superseded, interrupted, exhausted, or otherwise stale attempt MUST NOT advance lifecycle state and
      MUST instead produce a typed stale-completion rejection or recorded ignored-late-result event.
    claims:
      - CLM-008
  - id: REQ-009
    title: Isolate work-unit attribution and append-only corrections
    supports:
      - ambient-backstop-orchestration:REQ-016@1.0.0
    text: >
      Every command, lifecycle event, attempt, review, evidence reference, conflict, and attribution
      correction MUST belong to exactly one work unit. A follow-on or defect captured from another work unit
      MUST use a typed discovered_from causal-link structure containing the source work-unit ID and source
      session-event ID. If attribution is discovered to be wrong, the model MUST append a correction event
      that preserves the original event and explains the new ownership; no process-global target or session
      focus may implicitly determine ownership.
    claims:
      - CLM-009
  - id: REQ-010
    title: Keep Seed 1 independent from coordinator and UI implementation
    supports:
      - ambient-backstop-orchestration:REQ-005@1.0.0
      - ambient-backstop-orchestration:REQ-011@1.0.0
      - ambient-backstop-orchestration:REQ-015@1.0.0
    text: >
      This slice MUST expose enough typed domain data for later coordinator, command registry, and UI
      slices, but MUST NOT implement background worker dispatch, OpenCode child-session execution, control-
      plane rendering, Bun verification, or full reactive vertical-slice orchestration.
    claims:
      - CLM-010
claims:
  - id: CLM-001
    requirement: REQ-001
    text: Typed ID definitions prevent transition code from mixing work-unit, attempt, event, session, artifact, revision, evidence, review, causal-link, and correction identities.
    tests:
      - "defines distinct branded identities"
  - id: CLM-002
    requirement: REQ-002
    text: Lifecycle states, commands, actors, rejection reasons, and events are represented as explicit schemas for the product and reactive lifecycle paths with legal-action metadata.
    tests:
      - "enumerates unambiguous product and reactive lifecycle vocabulary"
      - "decodes command payloads by their discriminant"
  - id: CLM-003
    requirement: REQ-003
    text: The transition evaluator enumerates phase-to-phase transitions and preconditions for the product and reactive lifecycle paths, returning rejections or appendable events without performing I/O, spawning work, or mutating projections.
    tests:
      - "advances product path from exploring"
      - "advances reactive issue path into the shared plan lifecycle"
  - id: CLM-004
    requirement: REQ-004
    text: Commands submitted against stale aggregate versions are rejected or re-evaluated before commit and cannot overwrite newer lifecycle events.
    tests:
      - "rejects aggregate_version_conflict without events"
  - id: CLM-005
    requirement: REQ-005
    text: Content-dependent transitions pin normalized SHA-256 artifact revision hashes and reject stale revisions.
    tests:
      - "requires current artifact revision pins for content-dependent commands"
  - id: CLM-006
    requirement: REQ-006
    text: Event append and current-state projection share an atomic boundary and produce deterministic legal-next-action projections.
    tests:
      - "validates the complete append-and-project contract"
  - id: CLM-007
    requirement: REQ-007
    text: Non-happy outcomes have explicit states or events with terminal, resumable, repair-scoped, or retryable semantics.
    tests:
      - "models validation failure and repair acceptance explicitly"
      - "uses one retry threshold for events, state, and semantics"
  - id: CLM-008
    requirement: REQ-008
    text: Late or stale attempt completion cannot advance cancelled, superseded, interrupted, exhausted, or newer-version work units.
    tests:
      - "rejects stale_attempt without events"
      - "rejects late_completion without events"
  - id: CLM-009
    requirement: REQ-009
    text: Work-unit ownership is explicit on every lifecycle fact, discovered_from records source work-unit and source session-event attribution, and reattribution uses append-only correction events.
    tests:
      - "requires exact work-unit attribution and typed discovered_from links"
      - "models attribution corrections as append-only facts"
  - id: CLM-010
    requirement: REQ-010
    text: Seed 1 exports domain transition and projection contracts without implementing coordinator, UI, verifier, or child-session behavior.
    tests:
      - "exports only Seed 1 domain surfaces"
contracts:
  - file: packages/opencode/src/backstop/domain/schema.ts
    provides:
      - name: Work unit identity schema
        kind: constant
        signature: "const WorkUnitID = unknown"
      - name: Command identity schema
        kind: constant
        signature: "const CommandID = unknown"
      - name: Lifecycle event identity schema
        kind: constant
        signature: "const LifecycleEventID = unknown"
      - name: Attempt identity schema
        kind: constant
        signature: "const AttemptID = unknown"
      - name: Session event identity schema
        kind: constant
        signature: "const SessionEventID = unknown"
      - name: Artifact file identity schema
        kind: constant
        signature: "const ArtifactFileID = unknown"
      - name: Artifact revision identity schema
        kind: constant
        signature: "const ArtifactRevisionID = unknown"
      - name: Evidence identity schema
        kind: constant
        signature: "const EvidenceID = unknown"
      - name: Review identity schema
        kind: constant
        signature: "const ReviewID = unknown"
      - name: Causal link identity schema
        kind: constant
        signature: "const CausalLinkID = unknown"
      - name: Attribution correction identity schema
        kind: constant
        signature: "const AttributionCorrectionID = unknown"
      - name: Lifecycle states
        kind: constant
        signature: "const LIFECYCLE_STATES = unknown"
      - name: Command types
        kind: constant
        signature: "const COMMAND_TYPES = unknown"
      - name: Command actors
        kind: constant
        signature: "const COMMAND_ACTORS = unknown"
      - name: Lifecycle event types
        kind: constant
        signature: "const LIFECYCLE_EVENT_TYPES = unknown"
      - name: Rejection reasons
        kind: constant
        signature: "const REJECTION_REASONS = unknown"
      - name: Legal actions by state
        kind: constant
        signature: "const LEGAL_ACTIONS_BY_STATE = unknown"
  - file: packages/opencode/src/backstop/domain/transition.ts
    provides:
      - name: evaluateTransition
        kind: function
        signature: "function evaluateTransition(input: { aggregate: Aggregate; command: Command }): TransitionResult"
      - name: TRANSITION_TABLE
        kind: constant
        signature: "const TRANSITION_TABLE: readonly TransitionRule[]"
    consumes:
      - source: packages/opencode/src/backstop/domain/schema.ts
        name: Lifecycle event identity schema
        kind: constant
  - file: packages/opencode/src/backstop/domain/projection.ts
    provides:
      - name: projectWorkUnit
        kind: function
        signature: "function projectWorkUnit(input: { work_unit_id: WorkUnitID; events: readonly EventV2[] }): WorkUnitProjection"
      - name: validateAppendAndProjectBoundary
        kind: function
        signature: "function validateAppendAndProjectBoundary(input): AppendAndProjectBoundaryResult"
    consumes:
      - source: packages/opencode/src/backstop/domain/schema.ts
        name: Legal actions by state
        kind: constant
  - file: packages/opencode/src/backstop/domain/artifact-revision.ts
    provides:
      - name: hashArtifactRevision
        kind: function
        signature: "function hashArtifactRevision(content: ArtifactRevisionContent): ArtifactRevisionID"
      - name: requireCurrentArtifactRevision
        kind: function
        signature: "function requireCurrentArtifactRevision(input)"
    consumes:
      - source: node:crypto
        name: createHash
        kind: function
---

# SPEC-001: Backstop Domain Schemas And Deterministic Transition Core

## Overview

SPEC-001 defines the first bounded implementation slice for DIR-001 from BUNDLE-001: Backstop domain
schemas and a deterministic transition core. It corresponds to BUNDLE-001 Seed 1 and covers the state
machine authority required before coordinator, UI, verifier, or child-session work can safely build on the
domain.

The problem is that the new OpenCode V2 harness must not carry forward stringly lifecycle state, synthetic
handoffs, process-global target state, or ad hoc continuation rules. Durable Backstop work needs one typed
command boundary, one legal transition evaluator, one ordered work-unit event stream, and current-state
projections that are derived atomically from committed EventV2 lifecycle events.

This spec is intentionally limited to domain modeling and pure transition behavior. It does not implement
the runtime coordinator that consumes committed events, does not launch background agents, does not run
backstop-core or Bun verification, and does not build the control-plane UI.

## Requirements

The authoritative requirements are listed in YAML frontmatter as REQ-001 through REQ-010, each with at
least one claim. In summary, the Seed 1 implementation must:

1. Define type-safe identities for all lifecycle entities.
2. Model lifecycle states, commands, actors, rejection reasons, and events explicitly for both the product
   path and the reactive issue path.
3. Evaluate legal phase-to-phase transitions and preconditions through a deterministic side-effect-free core.
4. Fence concurrent commands with work-unit aggregate versions.
5. Preserve artifact revision identity in transition preconditions.
6. Project current state atomically from EventV2 lifecycle events.
7. Cover validation failure, changes requested, repair, retry exhaustion, interruption, restart recovery,
   supersession, abandonment, cancellation, and stale or late completion.
8. Prevent stale attempts from advancing lifecycle state.
9. Attribute all lifecycle facts to exactly one work unit, use typed `discovered_from` links with source
   work-unit and source session-event IDs, and support append-only corrections.
10. Stay within Seed 1, leaving coordinator, UI, verifier, adapter, and full reactive-slice delivery to
    later specs.

Traceability is to DIR-001 and BUNDLE-001, especially BUNDLE-001 requirements REQ-003, REQ-004, the state
portion of REQ-006, and REQ-016 as named in Seed 1.

## Implementation

Implement the slice as domain modules, not as a background runtime. The core shape is:

- Schema module: defines typed IDs, lifecycle states, commands, actors, event types, rejection reasons,
  aggregate state, typed `discovered_from` causal discovery links, conflicts, and attribution correction
  events.
- Transition module: evaluates a command against the current work-unit aggregate and expected aggregate
  version, enumerates the product and reactive phase transitions, then returns either a typed rejection or
  the ordered lifecycle events to append.
- Projection module: folds committed EventV2 lifecycle events into current work-unit state and legal next
  actions, with append and projection treated as one atomic persistence boundary by future adapters.
- Artifact revision module: defines normalized SHA-256 artifact revision identity and stale/candidate
  revision comparisons for transition preconditions.

Transition evaluation must be pure. It may describe that a later coordinator should dispatch a writer,
reviewer, repair attempt, or verifier by emitting lifecycle events and legal next actions, but it must not
perform that dispatch itself.

## Verification

This spec is done when structural validation and review can confirm that:

- The frontmatter validates as spec/v1 and includes populated source, implementation, verification,
  requirements, claims, and contracts.
- Requirement IDs are REQ-NNN, claim IDs are CLM-NNN, and every claim includes tests.
- The requirements cover all BUNDLE-001 Seed 1 concepts without expanding into later seeds.
- The transition model has explicit rejected outcomes for stale aggregate versions, stale artifact
  revisions, unauthorized actors, illegal commands, terminal work units, stale attempts, and late
  completions.
- The projection contract states that event append and current-state projection are atomic and
  deterministic.
- Work-unit attribution and append-only correction semantics are explicit enough to plan implementation.
- The transition table explicitly names the product path phases and reactive path phases from BUNDLE-001
  REQ-004, and `discovered_from` causal links explicitly cite a source work-unit ID and source
  session-event ID.

## Sharp Edges / Open Questions

- Event append and projection must be atomic. If projection fails after an event append, later coordinator
  code could observe impossible state; the persistence adapter must commit or roll back both together.
- Restart recovery cannot assume provider or tool effects replay safely. Seed 1 should model interrupted
  and uncertain attempts explicitly so later coordinator code can block or retry from durable state.
- File content can change while an attempt is active. Any transition that depends on authored content must
  compare the pinned artifact revision hash before accepting completion or approval.
- Session focus is not lifecycle ownership. Capturing a follow-on from active work must record the
  `discovered_from` source work-unit and source session event rather than inferring either from current UI
  focus or process-global context.
