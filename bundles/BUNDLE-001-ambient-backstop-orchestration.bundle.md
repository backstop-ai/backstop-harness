---
title: "Ambient Backstop Orchestration on OpenCode V2"
number: BUNDLE-001
created: "2026-07-22"
schema_version: bundle/v2

bundle:
  name: ambient-backstop-orchestration
  version: "0.2.0"
  created: "2026-07-22"
  updated: "2026-07-22"
  category: tool

status:
  maturity: defined
  note: >
    The operating model and major architecture are defined from direct observation of the existing
    Backstop runtime, the current backstop-core implementation, and OpenCode V2. All seven architecture
    questions were resolved with the user on 2026-07-22, including per-work-unit event ordering with
    dynamic session focus, generic V2 child sessions, durable autonomy grants, role-scoped semantic
    commands, completion visibility, the first control-plane UI, and the harness-specific Bun verification strategy.
    Human review confirmed that local code gates are in scope from first implementation code while
    generic Bun monorepo pack extraction is deferred until the reactive slice proves the contract.

problem:
  summary: >
    The existing Backstop runtime proves that agents can preserve disciplined artifact creation,
    planning, delegated implementation, runtime gates, and review while working conversationally.
    Its integration also accumulated legacy session patches, synthetic handoffs, stringly lifecycle
    state, global target state, and overlapping continuation mechanisms. A clean OpenCode fork needs
    to retain the discipline without forcing full artifact ceremony at the start of every conversation
    or carrying forward the accidental coupling.
  user_story: >
    As a developer working with an autonomous coding agent, I want to explore, debug, and make decisions
    naturally, then have the agent enter a strict Backstop workflow when the work becomes durable, so
    that issue capture, specification, planning, implementation, verification, and review remain
    traceable without turning conversation into a form-filling exercise. I also want deterministic
    slash commands and UI controls when I do not want to rely on model interpretation.

solution:
  approach: >
    Build Backstop as an ambient orchestration and control plane on native OpenCode V2. Conversation
    remains fluid until an agent tool, slash command, or UI action submits a typed command. All control
    surfaces call the same command handlers; they never mutate lifecycle state directly. A typed state
    machine is the sole producer of lifecycle events and atomically projects current state through
    EventV2. A runtime-owned coordinator consumes committed events and executes bounded writer,
    reviewer, implementer, repair, and verification attempts in the background. Artifact revisions,
    requirement and claim traceability, attempt identity, and runtime verification evidence determine
    whether work may advance. The existing Go Backstop engine remains the canonical artifact and gate
    authority behind a strict versioned adapter while the harness is built and dogfooded.

requirements:
  - id: REQ-001
    title: Keep exploration fluid until work becomes durable
    version: "1.0.0"
    text: >
      The primary agent MUST support freeform exploration, debugging, recovery, and design discussion
      without requiring a bundle, issue, spec, or plan for every conversational branch. Structure MUST
      begin when the user or agent identifies a durable defect, requirement, decision, or commitment.
  - id: REQ-002
    title: Converge agent tools, slash commands, and UI actions on one command boundary
    version: "1.0.0"
    text: >
      Agent tools, slash commands, and direct UI actions MUST invoke the same typed Backstop command
      handlers with the same authorization, idempotency, validation, and audit behavior. Slash commands
      MUST execute those handlers directly when possible and MUST NOT work by injecting a request back
      into model conversation.
  - id: REQ-003
    title: Reserve lifecycle event authority for the state machine
    version: "1.0.0"
    text: >
      External control surfaces MUST submit commands or intent only. A typed deterministic state machine
      MUST be the sole authority that accepts or rejects commands, enforces legal transitions, emits
      lifecycle events, and updates current-state projections atomically.
  - id: REQ-004
    title: Express the product and reactive lifecycles plainly and deterministically
    version: "1.0.0"
    text: >
      The system MUST model a product path of exploration, bundle, human approval, directive, spec,
      plan, implementation, runtime verification, implementation review, and completion, plus a
      reactive path of exploration, issue, issue-backed plan, implementation, runtime verification,
      implementation review, and completion. Every transition MUST have explicit preconditions and a
      typed blocked or accepted outcome. The transition model MUST also cover validation failure,
      review changes requested, repair, retry exhaustion, interruption, restart recovery, supersession,
      abandonment, cancellation, and stale or late completion rather than defining only happy paths.
  - id: REQ-005
    title: Continue structured workflows under runtime ownership
    version: "1.0.0"
    text: >
      After a command commits structured work, a runtime-owned coordinator MUST execute the strict
      writer, validator, reviewer, implementer, repair, and verification workflow without depending on
      the conversational agent to remember or choose the next automatic step. Progress MUST stop at a
      human gate, unresolved question, blocker, pause, cancellation, bounded retry limit, or terminal
      state.
  - id: REQ-006
    title: Separate authored artifact revisions from runtime lifecycle state
    version: "1.0.0"
    text: >
      Artifact files MUST own authored content while the runtime owns lifecycle state. In v1, an artifact
      revision MUST be a persisted snapshot identified by a SHA-256 hash of the complete artifact bytes
      after line-ending normalization; any hash change is material, including an uncommitted external
      edit. Reviews, plans, implementation attempts, and verification evidence MUST cite the exact hash
      they evaluated. A changed hash MUST create a candidate revision that inherits no approval or
      evidence until explicit reconciliation accepts it, and file synchronization MUST NOT silently
      regress runtime state.
  - id: REQ-007
    title: Project complete requirements-to-evidence traceability
    version: "1.0.0"
    text: >
      The harness MUST deterministically project and validate the chain from bundle requirement to spec
      requirement and claim, plan task, named test or gate, and current evidence. Reactive issues MUST
      cite a violated requirement or claim or declare explicit repair obligations so issue-backed work
      cannot become an untraceable exception.
  - id: REQ-008
    title: Keep verification runtime-owned and provenance-bearing
    version: "1.0.0"
    text: >
      Models MUST NOT self-certify validation or gate success. The runtime MUST execute verification and
      record the artifact revision, plan task, implementation attempt, repository or worktree identity,
      command or verifier, file/diff/all scope, repair/final semantic scope, result, time, and interruption
      status. Repair-scoped evidence MUST NOT satisfy final approval unless explicitly authorized.
  - id: REQ-009
    title: Make work-unit lifecycle progress durable, resumable, cancellable, and fenced
    version: "1.0.0"
    text: >
      Writer, reviewer, implementer, repair, and verification work MUST run within durable work-unit
      lifecycle state that records the current phase, expected artifact revisions, next action, and any
      active attempt. Pause MUST remain resumable and distinct from cancellation: a paused or interrupted
      work item MUST be able to continue from recorded work-unit, plan-task, attempt, artifact-revision,
      evidence, and durable next-action context rather than from conversational memory. The coordinator
      MAY resume a previous child session or attempt when safely available, but MUST be able to start a
      replacement worker from durable state when not. Cancelled, superseded, or otherwise stale attempts
      MUST NOT advance lifecycle state even when their work completes late.
  - id: REQ-010
    title: Let the agent act naturally from explicit Backstop context
    version: "1.0.0"
    text: >
      The primary agent MUST receive structured context describing the focused work unit, current state,
      active attempt, blockers, legal actions, and pending human decisions so natural user cues such as
      capture that, proceed, pause, or explain the blocker can map to typed commands. When the intended
      work unit or transition is ambiguous, the agent MUST ask a focused question rather than guess.
  - id: REQ-011
    title: Make background workflow state visible and directly controllable
    version: "1.0.0"
    text: >
      Users MUST be able to see current phase, active attempt, task progress, validation or gate status,
      blockers, pending human gates, and terminal outcome without reading synthetic chat. The read
      surface MUST remain a projection of runtime authority and MUST expose direct pause, resume,
      cancel, inspect, and legal-next-action controls.
  - id: REQ-012
    title: Build on native OpenCode V2 seams
    version: "1.0.0"
    text: >
      New Backstop behavior MUST use native OpenCode V2 sessions, typed tools, EventV2 aggregates,
      scoped permissions, location services, and execution routing. Legacy SessionPrompt loops,
      synthetic user-message handoffs, process-global target state, and invasive provider-turn patches
      MUST NOT become the foundation of the new harness.
  - id: REQ-013
    title: Retain the Go Backstop engine as the initial canonical validator
    version: "1.0.0"
    text: >
      The implemented backstop-core CLI MUST remain the initial authority for artifact schemas, corpus
      traceability, plan validation, and gates behind a strict versioned machine-readable adapter. The
      harness MUST NOT duplicate those rules in TypeScript until a deliberate authority migration is
      specified and verified.
  - id: REQ-014
    title: Dogfood Backstop while preserving an external bootstrap authority
    version: "1.0.0"
    text: >
      The backstop-harness repository MUST consume the existing Backstop artifact and validation model
      while the new runtime is built. The new runtime MUST NOT claim authority over its own development
      until a named parity suite establishes that it preserves legal and rejected lifecycle transitions,
      artifact and claim traceability, scoped and final verification policy, pause and resume, terminal
      cancellation, retry limits, and stale or late-result suppression. Authority cutover MUST require
      both that parity suite and the reactive vertical slice to pass under the existing Go engine.
  - id: REQ-015
    title: Prove the architecture with one reactive vertical slice first
    version: "1.0.0"
    text: >
      The first integrated delivery MUST prove a freeform conversation capturing an issue, producing and
      validating an issue-backed plan, executing one supervised implementation task, recording a runtime
      final gate with code-dependent checks active from the first implementation code through a
      harness-specific local Bun verifier binding, receiving a structured implementation review, and
      returning a visible completed or blocked state. Artifact-only validation or a gate with code
      dimensions disabled MUST NOT satisfy this proof. The local binding MUST map changed files to
      OpenCode workspaces, run package-scoped typecheck/test commands, and emit Backstop-compatible
      evidence before implementation begins.
      Broader product-path automation MUST follow this proof rather than precede it.
  - id: REQ-016
    title: Isolate lifecycle history by work unit while allowing dynamic session focus
    version: "1.0.0"
    text: >
      Every Backstop command, lifecycle event, attempt, review, and evidence record MUST be attributed to
      exactly one work unit, and each work unit MUST have its own authoritative event sequence. Sessions
      MUST be able to switch focus among concurrent work units without changing their identity. A defect
      or follow-on discovered while executing another work unit MUST be capturable as a new work unit
      with a typed discovered_from citation to the source work unit and session event. Attribution
      corrections MUST be append-only, and no process-global target or ledger context may determine
      ownership implicitly.
  - id: REQ-017
    title: Keep V2 child sessions generic and Backstop attempts domain-owned
    version: "1.0.0"
    text: >
      OpenCode V2 MUST expose a minimal generic child-session primitive carrying parent session, agent,
      location, and permissions without embedding Backstop workflow semantics. Backstop MUST separately
      map a child session to its work unit, attempt, task, and lifecycle. Child completion MUST close
      through typed role-authorized commands and control-plane projection rather than synthetic parent
      chat.
  - id: REQ-018
    title: Generate comprehensive role-scoped control surfaces from one command registry
    version: "1.0.0"
    text: >
      One semantic command registry MUST define command schemas, allowed actors, permissions, idempotency,
      help, legal-action metadata, agent tools, slash commands, and UI actions across capture, revision,
      lifecycle, decomposition, planning, task closure, blocker reporting, review, signoff, verification,
      traceability, evidence, reconciliation, and work-unit focus. Runtime verification MUST execute as a
      service; implementers MUST NOT receive an accepted-gate tool, and implementer diagnostics MUST NOT
      become accepted verification evidence without runtime provenance.
  - id: REQ-019
    title: Support durable revocable autonomy grants without bypassing lifecycle truth
    version: "1.0.0"
    text: >
      Confirmation policy MUST support allow-once, allow-for-work-unit, and always-allow-this-command-
      family-in-this-project grants. Grants MUST be durable, visible, revocable, and scoped to one
      repository and command family. A greenlight-through-implementation grant MAY suppress repeated
      prompts for one work unit but MUST NOT bypass a newly required human gate, evidence precondition,
      pause, or revocation. Completion MUST be state-machine-derived from final evidence and approved
      review, not exposed as an agent or user command.
  - id: REQ-020
    title: Surface background completion without manufacturing conversation
    version: "1.0.0"
    text: >
      A background lifecycle change MUST update the control-plane UI immediately, emit a non-chat notice
      for completion or required human action, and become available through durable system context on the
      ambient agent's next turn. V1 MUST NOT automatically wake the model or inject a synthetic user
      message to announce deterministic workflow progress.
  - id: REQ-021
    title: Make multiple work units and focus visible in the first UI
    version: "1.0.0"
    text: >
      The first control-plane UI MUST provide a sidebar work-unit dock listing active and recent work
      units, current session focus, phase, active attempt, blocker or human-gate state, and latest
      verification. It MUST support focus switching and direct pause, resume, cancel, and inspect actions.
      A compact detail drawer MUST show tasks, legal next actions, and evidence; full timelines, artifact
      editing, and a dedicated dashboard are deferred.
---

# Ambient Backstop Orchestration on OpenCode V2

## Goal

Build a Backstop harness in which rigorous delivery is ambient infrastructure rather than an intake
ritual. A user should be able to work naturally with an agent, watch durable discoveries crystallize
into the correct artifact, and trust the runtime to carry committed work through a strict workflow with
current evidence.

The architecture is summarized in `specs/backstop-harness.html`, which is a portable interactive design
artifact rather than a machine-authoritative lifecycle record.

## Current Thinking

The existing runtime demonstrated an important behavioral result: a capable model can move fluidly while
still creating issues and plans, delegating execution, running gates, and requesting reviews. The desired
system should reinforce that behavior instead of replacing it with a pipeline-first interface.

The load-bearing boundary is between conversation and commitment. Before the boundary, the agent may
investigate and reason freely. At the boundary, every entry surface submits a typed command. The command
does not manufacture an event or mutate a row; the state machine evaluates the current aggregate and is
the sole authority that records what happened. Once work is committed, the runtime coordinator, not the
primary conversation, owns deterministic continuation.

OpenCode V2 already provides most of the substrate: durable prompt admission, typed tool execution,
aggregate-sequenced EventV2 events, scoped permissions, location-scoped services, background jobs, and
session execution routing. The missing product is the Backstop domain model, command boundary,
coordinator, evidence model, and read projection. Native V2 child-session semantics are also incomplete
and require a deliberate design before delegated agents can be foundational.

The repository is bootstrapped as a consumer using the implementation that exists today: `backstop.yml`
at the root and root-level artifact directories. The existing root `specs/` directory continues to hold
OpenCode design documents; Backstop discovers only files ending in `.spec.md`, so both uses can coexist.
A local harness-specific verifier binding and Bun pack are part of bootstrap, so changed-code gates are
active from the first implementation code. It maps changed files to OpenCode workspaces, preserves
package-scoped test and typecheck rules, and may use a baseline or waiver for inherited OpenCode warnings
when needed so upstream noise does not drown changed-code failures. Extracting this into a reusable Bun
monorepo pack is deferred until the reactive slice proves the contract.

A session is deliberately not a work unit. It can move between core product work and a newly discovered
runtime issue without mixing their histories. Each lifecycle event commits to one work-unit aggregate;
concurrent work units and independent workers may execute in parallel while lifecycle commits within one
work unit remain ordered. New offshoot work records its causal source and can become the session focus
without changing or polluting the source aggregate.

## Draft Requirements

The formal contract is REQ-001 through REQ-021 in frontmatter. In plain language, the harness must:

1. Preserve freeform exploration.
2. Route tools, slash commands, and UI controls through one typed command surface.
3. Make the state machine the sole lifecycle-event authority.
4. Execute committed workflows in the background under runtime ownership.
5. Trace every durable promise through current evidence.
6. Keep authored revisions separate from lifecycle state.
7. Treat lifecycle resume, attempts, verification, pause, cancellation, and stale completion as first-class facts.
8. Build on OpenCode V2 and reuse backstop-core rather than recreating either system.
9. Prove the design through one issue-backed vertical slice.
10. Keep concurrent work-unit histories isolated while allowing sessions to switch focus.
11. Generate comprehensive role-scoped tools, slash commands, and UI actions from one registry.
12. Support durable autonomy grants without bypassing human gates or evidence.
13. Surface background progress and multiple active work units without synthetic conversation.

## Draft Design Decisions

### DD-001: Fluid outside, deterministic at the boundaries

Conversation is not a state machine. The transition into durable work is explicit and typed; everything
after that boundary is runtime-supervised.

### DD-002: Commands enter; the state machine emits

Agent tools, slash commands, and UI actions are adapters over the same command handlers. They cannot
directly publish lifecycle events or assign lifecycle states.

### DD-003: EventV2 is the lifecycle spine

Backstop lifecycle history will use native durable EventV2 aggregates and atomic projectors rather than
a parallel ad hoc ledger. The work unit is the leading aggregate candidate so its artifacts, attempts,
reviews, and evidence share a total order.

### DD-004: Automatic continuation is a runtime job

The coordinator progresses committed work from durable state. It does not inject synthetic user messages
or depend on another primary-agent turn to decide an already-determined transition.

The first implementation is a typed Backstop lifecycle, not a generic workflow DSL: commands, states,
events, transition functions, gate and review policies, and continuation rules are explicit Backstop
domain concepts. Those concepts should still be centralized and inspectable--with command schemas,
declared roles and permissions, phase/action metadata, projectable legal actions, and runtime-owned
continuation--so future extraction into generic OpenCode workflow primitives remains possible without
designing that generic layer first.

### DD-005: Files own content; runtime owns lifecycle

Authored artifacts remain readable and reviewable files. Lifecycle state, attempts, evidence, and pause
or cancellation are runtime facts. A persisted snapshot keyed by the SHA-256 of line-ending-normalized
artifact bytes is the v1 revision identity. Every hash change, including an uncommitted external edit,
creates a candidate revision and invalidates inherited approval and evidence. Reconciliation is explicit
when file content and runtime authority disagree.

### DD-006: The Go engine remains canonical during rehydration

Artifact validation, traceability, plan validation, and gates stay in backstop-core. The new harness uses
a strict adapter and records the resulting evidence; it does not maintain a second validator by default.

### DD-007: Native V2 only for new foundations

Legacy task and session paths may be studied for behavior and migration constraints, but new Backstop
control-plane and execution behavior is designed against V2.

### DD-008: The first workflow is reactive

The issue-to-plan path is the smallest workflow that proves ambient capture, structured execution, runtime
verification, review, and return to conversation. Full product lifecycle automation follows it.

### DD-009: Current CLI layout wins during bootstrap

Backstop artifacts live in root-level `bundles/`, `directives/`, `specs/`, `plans/`, `issues/`, and
`adrs/` because that is what backstop-core implements today. `.backstop/` remains operational cache and
generated output. A future layout migration must be explicit rather than anticipated in advance.

### DD-010: One lifecycle aggregate per work unit, never one per session

Every work unit owns one ordered lifecycle stream. Different work units and independent workers may run
concurrently; racing lifecycle results commit against an expected aggregate version and losers reevaluate
against current state. Sessions carry a switchable focus only. Discovering a bug or follow-on creates a
new work unit with a typed `discovered_from` relation, and attribution corrections append a new event
rather than rewriting history.

### DD-011: Generic child sessions, domain-owned attempts

V2 gains only the generic parent/child session relationship and execution inputs. Backstop owns the
work-unit, attempt, task, closure, fencing, and result semantics in its domain tables and events.

### DD-012: Risk-tiered confirmation with durable greenlights

Read, status, explain, capture, and focus commands need no prompt when intent is clear. Retry, pause, and
resume are reversible and need no extra prompt after a user cue or slash command. Bundle approval,
directive filing, implementation start, cancellation, supersession, and abandonment require an explicit
cue or lifecycle gate. Users can save revocable project- and work-unit-scoped grants. Completion is a
derived state, not a command.

### DD-013: Semantic, role-scoped command registry

A comprehensive registry generates stable semantic agent tools, slash commands, UI actions, schemas,
help, and legal-action metadata. Commands declare allowed actors. Runtime verification is a service;
implementers do not receive accepted-gate authority, and their diagnostics cannot self-certify evidence.
Extensibility seams for commands, packs, tools, verifiers, and future capability artifacts are in scope,
but unsupported capability artifacts are not a first-slice dependency.

### DD-014: Background progress is visible but does not wake the model

Committed progress updates the UI, emits a non-chat notice, and refreshes durable system context for the
ambient agent's next turn. V1 does not inject synthetic user input or automatically spend a model turn.

### DD-015: The first UI is a multi-work-unit dock and detail drawer

The sidebar exposes active and recent work units, current focus, phase, attempts, blockers, gates, and
verification. A compact drawer provides tasks, evidence, legal actions, and direct controls. Full
timelines, artifact editing, and a dedicated dashboard wait.

### DD-016: Prove a harness-specific Bun pack before extracting the general solution

Seed 5 delivers a local pack that maps files to OpenCode workspaces, preserves package-scoped test and
typecheck rules, exposes test-name patterns, and produces Backstop-compatible evidence. Reusable monorepo
behavior is extracted into the general Bun pack only after the reactive slice proves the contract.

## Spec Seeds

### Seed 1: Backstop domain schemas and deterministic transition core

Typed IDs, lifecycle states, commands, events, legal transitions, aggregate versions, artifact revision
identity, and atomic EventV2 projections. The transition model includes rejection, validation failure,
changes requested, repair, retry exhaustion, interruption and restart recovery, supersession,
abandonment, cancellation, and stale completion. Covers REQ-003, REQ-004, and the state portion of
REQ-006. The work-unit aggregate, attribution, causal-link, conflict, and append-only correction model
covers REQ-016.

### Seed 2: Artifact revision and traceability graph

Import authored artifact revisions, project requirements and claims, resolve cross-artifact references,
and expose deterministic completeness and stale-evidence queries. Covers REQ-006 and REQ-007.

### Seed 3: Shared control surfaces and ambient agent context

Register Backstop tools, slash-command adapters, and direct command APIs over the same handlers; provide
the primary agent with focus, state, blockers, and legal actions. Generate the comprehensive role-scoped
surface and persistent autonomy-grant policy from the command registry. Covers REQ-001, REQ-002, REQ-010,
REQ-018, and REQ-019.

### Seed 4: Runtime workflow coordinator and agent attempts

Implement event-driven continuation, V2 child-agent attempts, task supervision, bounded repair, pause,
resume from recorded work-unit lifecycle, task, attempt, artifact-revision, evidence, and next-action
state, cancellation, retry, restart reconciliation, and stale-result fencing. Resume an existing child
session or attempt when safe; otherwise start a replacement attempt from durable next-action state. Supply
the lifecycle and attempt cases for the self-authority parity suite. Add the generic V2 child-session
primitive while keeping Backstop attempt semantics domain-owned. Covers REQ-005, REQ-009, REQ-012,
REQ-017, and part of REQ-014.

### Seed 5: Backstop-core adapter, Bun verifier binding, and evidence policy

Define a strict versioned protocol around artifact validation and gates, execute verifiers under runtime
ownership, and record scoped/final evidence with provenance. Establish a package-scoped Bun monorepo
verification contract as a harness-specific local pack before implementation begins: map changed files to
workspaces, preserve package-local test and typecheck rules, expose test-name patterns, handle inherited
OpenCode warnings through a baseline or waiver if needed, and run substantive checks for owned
implementation surfaces. Code-dependent Backstop gate dimensions MUST be active from the first
implementation code, then reusable behavior can be extracted only after proof. Supply verification-policy
cases for the self-authority parity suite. Covers REQ-008, REQ-013, and part of REQ-014.

### Seed 6: Control-plane projection and human workflow surface

Expose protocol endpoints and UI projections for lifecycle, attempts, tasks, blockers, human gates,
traceability, evidence, non-chat notices, and durable ambient context. Deliver the multi-work-unit sidebar
dock and compact detail drawer with focus switching and direct controls. Covers REQ-011, REQ-020, and
REQ-021.

### Seed 7: Reactive issue vertical slice

Integrate the preceding seeds into the first acceptance story: conversation to issue, issue-backed plan,
supervised implementation, substantive package-scoped final gate, structured review, and visible
completion or blocker. Run the named self-authority parity suite across lifecycle, traceability,
verification, pause, cancellation, retry, and stale completion; authority remains with the existing
runtime and Go engine until both the parity suite and this slice pass. Covers REQ-014 and REQ-015 and
proves the bundle as a coherent system.

## Resolved Questions

1. **Lifecycle aggregate:** one authoritative EventV2 aggregate per work unit. Sessions may switch focus;
   multiple work units and safe workers remain concurrent.
2. **Child execution:** add a minimal generic V2 child-session primitive. Backstop owns attempt and
   workflow semantics separately.
3. **Confirmation:** use risk-tiered confirmation with durable revocable grants scoped once, to one work
   unit, or to one command family in one project. Completion remains derived.
4. **Tool granularity:** generate comprehensive semantic, role-scoped tools and all fallback surfaces from
   one command registry. Runtime-only verification remains unavailable as accepted implementer evidence.
5. **Background completion:** update UI immediately, emit a non-chat notice, and refresh durable ambient
   context for the next turn; do not wake the model in v1.
6. **First UI:** ship a multi-work-unit sidebar dock and compact detail drawer; defer full timeline,
   artifact editing, and dedicated dashboard work.
7. **Bun verification:** build a harness-specific local pack first, then extract the reusable monorepo
   contract after the reactive slice proves it.

## Sharp Edges

- Two commands can evaluate the same aggregate version concurrently. Command acceptance MUST use
  optimistic version checks or equivalent serialization so only one legal event sequence commits and a
  loser receives a typed conflict rather than silently overwriting state.
- Event append and projection update are one atomic boundary. Projector failure MUST roll back the event
  commit; projectors MUST remain deterministic and side-effect-free, and external coordination begins
  only after commit.
- Cancellation can race with tool calls, gate subprocesses, and agent completion. Every late callback
  MUST be fenced by attempt identity and terminal state before writing progress, evidence, or lifecycle
  events.
- OpenCode V2 does not currently guarantee post-crash provider continuation. On restart, the coordinator
  MUST reconcile durable jobs and attempts without replaying ambiguous external model or tool effects;
  uncertain work becomes blocked or requires explicit retry rather than being assumed safe.
- Resuming an old agent or child session can be unsafe when its view is stale. Any resumed worker, and any
  replacement worker started instead, MUST rehydrate from current work-unit lifecycle state, durable
  next-action context, and expected artifact revisions before it may act or close an attempt.
- Artifact files can change while import, review, or implementation is active. Every operation MUST pin
  the content hash it read, reject stale completion against a newer candidate revision, and surface an
  authority conflict rather than merging file and runtime state implicitly.
- The backstop-core adapter can time out, be interrupted, emit a newer protocol version, return malformed
  JSON, or exit after partial output. These outcomes MUST record non-passing diagnostic evidence and MUST
  NOT be treated as validation or gate success.
- The bootstrap gate currently disables code-dependent dimensions. That is acceptable for authoring this
  bundle but cannot verify implementation; Seed 5 is a hard dependency before first implementation code,
  Seed 7, and authority cutover.

## Out of Scope

- Porting the legacy Backstop runtime wholesale.
- Supporting legacy OpenCode V1 as a new execution foundation.
- Clustered workers, distributed locks, or general post-crash provider replay in the first slice. Local
  durable work-unit resume remains in scope; this exclusion is only for multi-process coordination and
  replaying ambiguous provider or tool effects after a crash.
- A public generic workflow-definition language or arbitrary user-authored workflow DSL. This bundle MUST
  build the Backstop lifecycle directly as explicit typed Backstop commands, states, events, transition
  functions, gate and review policies, and continuation logic. The internal architecture should keep clean,
  inspectable seams for possible future extraction into OpenCode workflow primitives--centralized command
  schemas, declared roles and permissions, explicit phase/action metadata, projectable legal actions, and
  runtime-owned continuation--but downstream work MUST NOT start by building a generic DSL.
- A full sidebar or session-timeline redesign before the control-plane projection is proven.
- Treating the currently unimplemented Backstop ledger gate as a consumer requirement.
- Requiring currently unsupported capability artifacts for the first reactive slice while their scaffold and
  validator integration remain incomplete. The harness should still expose explicit extension seams so
  future capabilities, packs, tools, and verifiers can plug in when their artifact support is real.
- Implementing `backstop init` as part of this bundle.
- Generalizing the local harness-specific Bun verifier binding or pack into a reusable generic Bun
  monorepo pack before the reactive slice proves it. Local project gates, changed-files-to-workspace
  mapping, package-scoped typecheck/test rules, Backstop-compatible evidence, and inherited-warning
  baseline or waiver handling remain in scope from the first implementation code.

## Version History

### 0.2.0 - 2026-07-22

- Resolved all seven architecture questions with the user.
- Made work-unit isolation, dynamic session focus, causal discovery links, and append-only reattribution
  formal requirements.
- Selected generic V2 child sessions, risk-tiered durable grants, a comprehensive role-scoped command
  registry, non-chat completion visibility, and the multi-work-unit dock.
- Assigned substantive first-slice verification to a harness-specific Bun pack before general extraction.

### 0.1.0 - 2026-07-22

- Captured the ambient-orchestration operating model.
- Defined the shared command and deterministic state-machine boundary.
- Recorded native OpenCode V2, EventV2, runtime coordinator, traceability, verification, and self-hosting
  decisions.
- Sequenced seven spec seeds around one reactive vertical slice.

## References

- `specs/backstop-harness.html` - interactive architecture explainer.
- `/Users/bmanson/src/projects/backstop-runtime` - behavior and invariant reference implementation.
- `/Users/bmanson/src/projects/backstop-core` - canonical implemented artifact, traceability, and gate engine.
- `/Users/bmanson/src/projects/bclabs-portal` - most recent manually bootstrapped Backstop consumer.
- `specs/v2/session.md` - native OpenCode V2 session design.
- `specs/v2/tools.md` - native OpenCode V2 tool model.
