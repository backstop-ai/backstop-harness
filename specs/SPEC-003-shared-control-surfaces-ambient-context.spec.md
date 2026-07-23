---
title: "Shared Control Surfaces And Ambient Agent Context"
number: SPEC-003
created: "2026-07-22"
status: implemented
schema_version: spec/v1
spec_version: 1.0.0
source:
  directive: DIR-001
  bundle: BUNDLE-001
implementation:
  subject: backstop-control-registry
  summary: >
    Define one semantic Backstop command registry and generate role-scoped agent tools,
    direct slash/UI adapters, ambient context, and durable revocable autonomy grants from it.
  scope:
    - Define semantic command entries with schemas, actors, permission family, idempotency, confirmation risk, help, and legal-action metadata.
    - Route agent tools, slash commands, direct APIs, and future UI actions through one typed dispatch boundary.
    - Materialize role-scoped tools without exposing accepted verification authority to implementers.
    - Register durable focused-work-unit context through native SystemContextRegistry.
    - Persist visible revocable allow-once, work-unit, and project-command-family autonomy grants.
    - Keep freeform exploration outside a work unit until a durable capture or commitment command is submitted.
  out_of_scope:
    - Background workflow continuation, child-agent attempts, retries, repair, pause/resume execution, or restart reconciliation.
    - Implementing the lifecycle persistence coordinator behind accepted commands.
    - Running canonical validation, tests, gates, or accepted verification evidence.
    - Rendering the Seed 6 dock or detail drawer.
verification:
  level: integration
  test_command: "backstop gate all"
  coverage_threshold: 80
  acceptance:
    - Every generated surface invokes the same command entry and returns the same typed result for the same actor and input.
    - Slash and UI dispatch perform no model turn and inject no user or assistant message.
    - Role materialization omits unauthorized commands and never gives implementers accepted-gate authority.
    - Ambient context is deterministic, bounded, focused, and contains state, blockers, legal actions, active attempt, and pending decisions.
    - Grants are repository- and command-family-scoped, revocable, and cannot satisfy human gates or evidence preconditions.
requirements:
  - id: REQ-001
    title: Keep one semantic command registry
    supports:
      - ambient-backstop-orchestration:REQ-002@1.0.0
      - ambient-backstop-orchestration:REQ-018@1.0.0
    text: >
      One immutable registry MUST define each Backstop command's stable semantic ID, input schema,
      allowed actors, permission family, idempotency key policy, confirmation risk, help, and legal-action
      metadata. Duplicate IDs or incomplete entries MUST fail during layer construction.
    claims: [CLM-001]
  - id: REQ-002
    title: Converge all surfaces on one typed dispatch boundary
    supports:
      - ambient-backstop-orchestration:REQ-002@1.0.0
    text: >
      Agent tools, slash commands, direct APIs, and UI action descriptors MUST resolve a registry entry
      and invoke the same typed handler with actor, project, session, work-unit focus, command ID,
      idempotency key, and decoded input. Adapters MUST NOT mutate lifecycle state directly.
    claims: [CLM-002]
  - id: REQ-003
    title: Execute slash and direct actions without manufacturing conversation
    supports:
      - ambient-backstop-orchestration:REQ-002@1.0.0
      - ambient-backstop-orchestration:REQ-020@1.0.0
    text: >
      Slash-command and direct-action adapters MUST call dispatch directly, return structured output,
      and perform no provider/model turn or synthetic user, assistant, or tool message injection.
    claims: [CLM-003]
  - id: REQ-004
    title: Materialize role-scoped tools and verification authority
    supports:
      - ambient-backstop-orchestration:REQ-018@1.0.0
    text: >
      Tool materialization MUST expose only commands allowed for the active actor and permission rules.
      Implementers MUST NOT receive a command capable of recording accepted runtime verification;
      diagnostic reporting and runtime-owned evidence acceptance MUST remain distinct entries and actors.
    claims: [CLM-004]
  - id: REQ-005
    title: Preserve fluid exploration before durable capture
    supports:
      - ambient-backstop-orchestration:REQ-001@1.0.0
      - ambient-backstop-orchestration:REQ-010@1.0.0
    text: >
      Registry and context services MUST operate with no focused work unit. Read, explain, and capture
      discovery surfaces MAY remain available, but the system MUST NOT create durable work or require
      artifact fields until an explicit capture, decision, or commitment command is submitted.
    claims: [CLM-005]
  - id: REQ-006
    title: Provide deterministic focused Backstop system context
    supports:
      - ambient-backstop-orchestration:REQ-010@1.0.0
    text: >
      A native SystemContextRegistry source MUST render the focused work unit, lifecycle state, active
      attempt, blockers, legal actions, pending human decisions, and current verification summary from a
      typed read model. Output MUST be deterministic, bounded, and omit stale or unrelated work units.
    claims: [CLM-006]
  - id: REQ-007
    title: Ask rather than guess ambiguous command targets
    supports:
      - ambient-backstop-orchestration:REQ-010@1.0.0
    text: >
      Dispatch MUST reject missing or ambiguous target context with a typed clarification result when a
      command requires one work unit. It MUST NOT select process-global, most-recent, or conversationally
      inferred ownership implicitly.
    claims: [CLM-007]
  - id: REQ-008
    title: Persist durable revocable autonomy grants
    supports:
      - ambient-backstop-orchestration:REQ-019@1.0.0
    text: >
      Grants MUST support allow-once, allow-for-work-unit, and always-allow-command-family-in-project
      scopes. Durable grants MUST record repository, command family, optional work unit, grantor, creation,
      and revocation; list and revoke operations MUST be visible through the same registry boundary.
    claims: [CLM-008]
  - id: REQ-009
    title: Keep grants subordinate to lifecycle truth
    supports:
      - ambient-backstop-orchestration:REQ-019@1.0.0
    text: >
      Grant evaluation MAY suppress confirmation only for the matching command risk. It MUST NOT bypass
      a human lifecycle gate, pause, revocation, artifact-revision conflict, missing evidence, actor denial,
      or illegal transition, and MUST NOT expose completion as a callable command.
    claims: [CLM-009]
  - id: REQ-010
    title: Keep Seed 3 independent from execution coordination and UI rendering
    supports:
      - ambient-backstop-orchestration:REQ-012@1.0.0
    text: >
      Seed 3 MUST define control metadata, dispatch adapters, context projection, and grant policy only.
      It MUST NOT launch workers, continue workflow phases, execute verification, render the control-plane
      UI, or inject synthetic conversation.
    claims: [CLM-010]
claims:
  - id: CLM-001
    requirement: REQ-001
    text: Registry entries are complete, unique, immutable, and mechanically projectable.
    tests: ["rejects duplicate or incomplete semantic command entries"]
  - id: CLM-002
    requirement: REQ-002
    text: Tool, slash, API, and UI descriptors share one decoded command dispatch.
    tests: ["routes every control surface through one typed command handler"]
  - id: CLM-003
    requirement: REQ-003
    text: Direct adapters produce structured results without session-message or model effects.
    tests: ["executes slash and direct actions without manufacturing conversation"]
  - id: CLM-004
    requirement: REQ-004
    text: Actor projection denies unavailable commands and separates implementer diagnostics from runtime evidence acceptance.
    tests: ["omits accepted verification authority from implementer tools"]
  - id: CLM-005
    requirement: REQ-005
    text: No-focus context retains exploration and capture capabilities without creating durable work.
    tests: ["keeps exploration fluid before a durable capture command"]
  - id: CLM-006
    requirement: REQ-006
    text: Focused ambient context is deterministic, bounded, and authority-derived.
    tests: ["renders focused Backstop state blockers actions and decisions deterministically"]
  - id: CLM-007
    requirement: REQ-007
    text: Work-unit-required commands return typed clarification instead of guessing ownership.
    tests: ["rejects ambiguous work-unit targets without global fallback"]
  - id: CLM-008
    requirement: REQ-008
    text: Durable repository and work-unit grants can be listed and revoked.
    tests: ["persists lists consumes and revokes scoped autonomy grants"]
  - id: CLM-009
    requirement: REQ-009
    text: Matching grants suppress confirmation but never legal state or evidence preconditions.
    tests: ["keeps autonomy grants subordinate to lifecycle gates and actor policy"]
  - id: CLM-010
    requirement: REQ-010
    text: Seed 3 surfaces contain no worker execution, verifier, UI renderer, or chat injection.
    tests: ["keeps shared controls independent from workflow execution"]
contracts:
  - file: packages/schema/src/backstop-control.ts
    provides:
      - name: Command identifier schema
        kind: constant
        signature: "const CommandID = unknown"
      - name: Command actor schema
        kind: constant
        signature: "const CommandActor = unknown"
      - name: Command result schema
        kind: constant
        signature: "const CommandResult = unknown"
      - name: Autonomy grant schema
        kind: constant
        signature: "const AutonomyGrant = unknown"
  - file: packages/core/src/backstop/command/registry.ts
    provides:
      - name: Semantic command registry and dispatch boundary
        kind: interface
        signature: "class Service extends unknown {}"
  - file: packages/core/src/backstop/command/grant.ts
    provides:
      - name: Durable autonomy grant repository and evaluator
        kind: interface
        signature: "class Service extends unknown {}"
  - file: packages/opencode/src/backstop/control/adapters.ts
    provides:
      - name: Tool slash direct and UI command projections
        kind: interface
        signature: "class Service extends unknown {}"
  - file: packages/opencode/src/backstop/control/context.ts
    provides:
      - name: Focused ambient Backstop context source
        kind: interface
        signature: "class Service extends unknown {}"
---

# SPEC-003: Shared Control Surfaces And Ambient Agent Context

## Overview

Seed 3 makes Backstop controllable without making conversation itself the control protocol. One semantic
registry describes commands and their authority. Agent tools, slash commands, direct APIs, and future UI
actions are projections of those entries and invoke one typed dispatch boundary.

The ambient agent receives a bounded native system-context projection when a work unit is focused, while
freeform exploration remains valid with no durable target. Durable autonomy grants reduce repetitive
confirmation but never replace state-machine legality, human gates, evidence, or revision fencing.

## Requirements

The authoritative requirements are REQ-001 through REQ-010 in frontmatter. They cover registry
completeness, shared dispatch, direct execution, role scope, exploration, ambient context, ambiguity,
durable grants, lifecycle authority, and the Seed 3 execution boundary.

## Implementation

Browser-safe control and grant contracts live in `packages/schema`. The immutable semantic registry and
durable grant repository live in `packages/core`. OpenCode adapters project those entries into native
tools, slash commands, direct action descriptors, and `SystemContextRegistry` without introducing a second
handler or lifecycle authority.

## Verification

Tests compare all generated surfaces against the same handler, verify actor and permission filtering,
assert no message/model effects in direct dispatch, exercise deterministic system-context rendering, and
use live SQLite for grant persistence, consumption, revocation, and project/work-unit isolation. The
installed harness pack remains blocking across schema, core, and opencode.
