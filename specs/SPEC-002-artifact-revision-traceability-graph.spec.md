---
title: "Artifact Revision And Traceability Graph"
number: SPEC-002
created: "2026-07-22"
status: implemented
schema_version: spec/v1
spec_version: 1.0.0
source:
  directive: DIR-001
  bundle: BUNDLE-001
implementation:
  subject: backstop-artifact-traceability
  summary: >
    Persist complete normalized authored-artifact snapshots, project revision-qualified
    requirements-to-evidence facts, and answer deterministic completeness and stale-evidence
    queries through native OpenCode V2 EventV2 and database seams.
  scope:
    - Define durable browser-safe artifact revision import, candidate-accepted, and candidate-rejected events and register them in the native EventV2 manifest.
    - Persist immutable normalized artifact snapshots, current/candidate revision pointers, trace nodes, typed edges, and import diagnostics.
    - Import the Seed 2 fields of bundle, spec, plan, directive, and issue artifacts without claiming canonical schema validity.
    - Resolve versioned requirement supports, claim ownership, plan tasks, named tests, directive sources, and issue delivery links deterministically.
    - Query structural completeness separately from revision-pinned evidence freshness.
    - Attribute every imported fact to an explicit project, work unit, artifact file, and source revision.
  out_of_scope:
    - Reimplementing backstop-core artifact validation, plan validation, gate execution, or semantic policy in TypeScript.
    - Filesystem discovery policy beyond importing explicit canonical repository-relative paths.
    - Runtime workflow coordination, child-agent dispatch, retries, repair, pause, resume, or cancellation.
    - Command, slash-command, control-plane, or UI surfaces.
    - Executing tests or gates and creating accepted evidence; Seed 2 only consumes typed evidence records.
verification:
  level: integration
  test_command: "bun test test/backstop && bun typecheck"
  coverage_threshold: 80
  gates:
    - name: immutable-revision-storage
      description: Complete normalized snapshots and revision-qualified graph facts persist atomically and remain recoverable.
    - name: deterministic-traceability
      description: Reference resolution, completeness, and stale-evidence queries are deterministic under input reordering and restart.
    - name: authority-boundary
      description: Local parsing never claims canonical validity and no backstop-core rule is duplicated into the runtime.
  acceptance:
    - Reimporting the same revision is idempotent and any non-line-ending byte change creates a candidate with no inherited evidence.
    - Every graph node and edge identifies its source artifact revision and explicit work-unit ownership.
    - Event append, snapshot persistence, graph projection, and current/candidate pointer updates share one rollback boundary.
    - Missing, ambiguous, unsupported, and stale references remain typed diagnostics rather than silently omitted facts.
requirements:
  - id: REQ-001
    title: Persist complete immutable artifact revisions
    supports:
      - ambient-backstop-orchestration:REQ-006@1.0.0
    text: >
      The system MUST persist the complete artifact bytes after line-ending normalization together
      with the Seed 1 SHA-256 revision ID, canonical repository-relative path, artifact identity,
      schema version, project, work unit, and import time. The exact normalized snapshot MUST remain
      recoverable after the authored file changes.
    claims: [CLM-001]
  - id: REQ-002
    title: Separate current and candidate revisions
    supports:
      - ambient-backstop-orchestration:REQ-006@1.0.0
    text: >
      Reimporting identical bytes MUST be idempotent. A different revision MUST become a candidate
      without inheriting approval or evidence from the current revision, and accepting or rejecting
      a candidate MUST be represented explicitly rather than inferred from filesystem state.
    claims: [CLM-002]
  - id: REQ-003
    title: Import bounded artifact projections without duplicating canonical validation
    supports:
      - ambient-backstop-orchestration:REQ-013@1.0.0
    text: >
      The importer MUST decode only the bundle, spec, plan, directive, and issue fields required for
      traceability. Unsupported schema versions and malformed projections MUST produce typed import
      diagnostics. A successful local projection MUST retain canonical validation status as unknown
      until a revision-matched backstop-core verdict is attached.
    claims: [CLM-003]
  - id: REQ-004
    title: Project revision-qualified traceability facts
    supports:
      - ambient-backstop-orchestration:REQ-007@1.0.0
      - ambient-backstop-orchestration:REQ-016@1.0.0
    text: >
      Artifact, requirement, claim, plan-task, named-test, and evidence nodes MUST be qualified by
      stable artifact and revision identities where applicable. Typed edges MUST retain source path,
      source location, source revision, project, and work-unit attribution so repeated REQ and CLM IDs
      in different artifacts cannot collide.
    claims: [CLM-004]
  - id: REQ-005
    title: Resolve cross-artifact references deterministically
    supports:
      - ambient-backstop-orchestration:REQ-007@1.0.0
    text: >
      Versioned requirement supports, claim ownership, plan targets and task claims, directive sources,
      and issue delivery or repair links MUST resolve only against the supplied imported revision set.
      Missing, ambiguous, invalid, unsupported-version, retired, and semantically stale targets MUST be
      returned as sorted typed resolutions rather than skipped or selected by map overwrite order.
    claims: [CLM-005]
  - id: REQ-006
    title: Query complete requirements-to-evidence chains
    supports:
      - ambient-backstop-orchestration:REQ-007@1.0.0
    text: >
      A deterministic completeness query MUST report gaps from bundle requirement through supporting
      spec requirement, claim, plan task, named test or gate, and current evidence. Reactive issues MUST
      cite an affected requirement or claim or expose an explicit repair-obligation gap.
    claims: [CLM-006]
  - id: REQ-007
    title: Query evidence freshness independently from structural completeness
    supports:
      - ambient-backstop-orchestration:REQ-006@1.0.0
      - ambient-backstop-orchestration:REQ-007@1.0.0
    text: >
      Evidence queries MUST compare every cited artifact revision with current accepted revisions and
      report changed or missing revisions, changed nodes, failed or interrupted results, repair-only
      semantic scope, and repository revision mismatch. Structurally complete graphs MUST remain
      distinguishable from graphs lacking current passing evidence.
    claims: [CLM-007]
  - id: REQ-008
    title: Commit imports through one native EventV2 transaction
    supports:
      - ambient-backstop-orchestration:REQ-006@1.0.0
      - ambient-backstop-orchestration:REQ-012@1.0.0
    text: >
      Artifact revision import and candidate reconciliation MUST use registered durable native EventV2
      definitions aggregated by project-qualified work unit. Event append, immutable snapshot insertion, graph projection,
      and pointer updates MUST commit atomically under an aggregate-version fence; projector failure or a
      losing concurrent command MUST append no partial event or projection state.
    claims: [CLM-008]
  - id: REQ-009
    title: Preserve explicit project and work-unit isolation
    supports:
      - ambient-backstop-orchestration:REQ-016@1.0.0
    text: >
      Global persistence and EventV2 services MUST key every import and query by explicit project and work
      unit IDs. Filesystem reading MAY be location-scoped, but location or session focus MUST NOT implicitly
      determine durable ownership, graph joins, or evidence attribution.
    claims: [CLM-009]
  - id: REQ-010
    title: Keep Seed 2 independent from execution and control surfaces
    supports:
      - ambient-backstop-orchestration:REQ-012@1.0.0
      - ambient-backstop-orchestration:REQ-013@1.0.0
    text: >
      Seed 2 MUST expose schema, persistence, import, graph, and query contracts only. It MUST NOT launch
      workers, execute backstop-core or Bun verification, mutate lifecycle state, manufacture evidence,
      inject chat, or render workflow controls.
    claims: [CLM-010]
claims:
  - id: CLM-001
    requirement: REQ-001
    text: Normalized snapshots remain byte-complete, hash-addressed, and recoverable after source changes.
    tests:
      - "persists and recovers complete normalized artifact snapshots"
  - id: CLM-002
    requirement: REQ-002
    text: Idempotent imports and changed candidates preserve revision authority without inherited evidence.
    tests:
      - "keeps changed artifact revisions candidate and evidence-free"
  - id: CLM-003
    requirement: REQ-003
    text: Bounded projection returns explicit parse/version diagnostics and never self-certifies canonical validity.
    tests:
      - "fails closed on malformed and unsupported artifact projections"
  - id: CLM-004
    requirement: REQ-004
    text: Revision-qualified nodes and typed edges retain exact source and ownership attribution.
    tests:
      - "isolates repeated requirement and claim IDs by artifact revision"
  - id: CLM-005
    requirement: REQ-005
    text: Resolution is stable under input ordering and exposes every missing, ambiguous, invalid, stale, or retired target.
    tests:
      - "resolves cross-artifact references deterministically"
  - id: CLM-006
    requirement: REQ-006
    text: Completeness reports every missing link in the requirement-to-current-evidence chain.
    tests:
      - "reports deterministic requirements-to-evidence completeness gaps"
  - id: CLM-007
    requirement: REQ-007
    text: Evidence freshness is revision-, repository-, result-, and semantic-scope-aware.
    tests:
      - "reports stale evidence without changing structural completeness"
  - id: CLM-008
    requirement: REQ-008
    text: Native EventV2 import and projection either commit together under the expected version or fully roll back.
    tests:
      - "commits artifact import event and graph projection atomically"
      - "rejects concurrent imports at the same aggregate version"
  - id: CLM-009
    requirement: REQ-009
    text: Identical authored IDs in different projects and work units never share graph or revision state.
    tests:
      - "isolates artifact imports by project and work unit"
  - id: CLM-010
    requirement: REQ-010
    text: Seed 2 modules contain no coordinator, verifier execution, chat, or UI behavior.
    tests:
      - "keeps artifact traceability independent from runtime execution"
contracts:
  - file: packages/schema/src/backstop-event.ts
    provides:
      - name: Artifact revision imported event
        kind: constant
        signature: "const ArtifactRevisionImported = unknown"
      - name: Artifact candidate accepted event
        kind: constant
        signature: "const ArtifactCandidateAccepted = unknown"
      - name: Artifact candidate rejected event
        kind: constant
        signature: "const ArtifactCandidateRejected = unknown"
      - name: Backstop durable event union
        kind: constant
        signature: "const Durable = unknown"
  - file: packages/core/src/backstop/artifact/sql.ts
    provides:
      - name: Artifact file projection table
        kind: constant
        signature: "const ArtifactFileTable = unknown"
      - name: Artifact revision projection table
        kind: constant
        signature: "const ArtifactRevisionTable = unknown"
      - name: Trace node projection table
        kind: constant
        signature: "const TraceNodeTable = unknown"
      - name: Trace edge projection table
        kind: constant
        signature: "const TraceEdgeTable = unknown"
  - file: packages/core/src/backstop/artifact/repository.ts
    provides:
      - name: Artifact revision persistence and traceability queries
        kind: interface
        signature: "class Service extends unknown {}"
  - file: packages/opencode/src/backstop/artifact/importer.ts
    provides:
      - name: Location-scoped authored artifact importer
        kind: interface
        signature: "class Service extends unknown {}"
    consumes:
      - source: packages/core/src/backstop/artifact/repository.ts
        name: Artifact revision persistence and traceability queries
        kind: interface
---

# SPEC-002: Artifact Revision And Traceability Graph

## Overview

Seed 2 turns authored Backstop files into immutable, revision-qualified runtime facts without transferring
canonical schema authority away from `backstop-core`. The runtime persists complete normalized snapshots,
projects only the fields needed for traceability, and reports malformed or unsupported inputs explicitly.

Structural completeness and evidence freshness are separate questions. A requirement chain can be complete
while its latest evidence is stale, failed, interrupted, repair-scoped, or tied to an older repository or
artifact revision. Neither state may be inferred from lifecycle status or conversational memory.

## Requirements

The authoritative requirements are REQ-001 through REQ-010 in frontmatter. They cover immutable authored
revisions, candidate reconciliation, bounded import, revision-qualified traceability, deterministic
resolution, completeness, stale evidence, atomic EventV2 persistence, ownership isolation, and Seed 2 scope.

## Implementation

Browser-safe durable event definitions belong in `packages/schema`. Process-global persistence and EventV2
projection belong in `packages/core`, keyed by explicit project and work-unit IDs. Filesystem reading and
artifact import orchestration belong in a location-scoped OpenCode service. Projectors perform deterministic
database writes only; filesystem, CLI, model, network, and verifier effects stay outside the transaction.

Every trace node and edge cites the revision that produced it. Bare `REQ-001` and `CLM-001` values are never
global keys. The importer accepts explicit canonical repository-relative paths rather than embedding a second
artifact discovery policy. A later Seed 5 adapter attaches canonical `backstop-core` validation and gate
evidence to the exact revision; local parsing leaves that status `unknown`.

## Verification

Verification uses live in-memory SQLite, native EventV2 services, and actual projector transactions rather
than mocks. Tests cover normalized snapshot recovery, idempotence, candidate isolation, parser failures,
reference ambiguity, deterministic ordering, completeness, stale evidence, rollback, concurrency fencing,
restart behavior, and project/work-unit isolation. The installed `backstop/harness-toolchain` pack must pass
with blocking lint, build, test, and coverage dimensions.
